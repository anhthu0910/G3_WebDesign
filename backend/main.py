
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from backend.config import FRONTEND_DIR, UPLOAD_DIR, PRODUCTION
from backend.database import import_products_from_json
import os
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal
from uuid import UUID
from google.genai.errors import ServerError
from backend.auth_routes import router as auth_router, admin_router, COOKIE_NAME
from backend.services.auth_service import get_session_user
from backend.admin_routes import router as admin_management_router
from backend.user_routes import router as user_router
from backend.database import init_database

from backend.services.ai_service import generate_skincare_reply
from backend.services.product_service import (
    get_all_products,
    get_product_by_id
)
import json
from backend.database import get_connection

app = FastAPI(title="GlowGuide API", docs_url=None if PRODUCTION else "/docs", redoc_url=None if PRODUCTION else "/redoc", openapi_url=None if PRODUCTION else "/openapi.json")
init_database()
import_products_from_json()
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(admin_management_router)
app.include_router(user_router)

# Allow frontend development servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "" if PRODUCTION else "http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000,http://127.0.0.1:3000").split(",") if origin.strip()],
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
    ],
    allow_credentials=True,
)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1500)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1500)
    history: list[ChatMessage] = Field(
        default_factory=list,
        max_length=10
    )


@app.get("/")
def home():
    return RedirectResponse("/frontend/html/index.html", status_code=307)


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return FileResponse(FRONTEND_DIR / "images" / "favicon.svg", media_type="image/svg+xml")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.post("/api/chat")
def chat(request: ChatRequest):
    with get_connection() as conn:
        log_id = conn.execute("INSERT INTO ai_usage_logs(status) VALUES ('requested')").lastrowid
    try:
        reply = generate_skincare_reply(
            message=request.message,
            history=[
                item.model_dump()
                for item in request.history
            ]
        )

        with get_connection() as conn:
            conn.execute("UPDATE ai_usage_logs SET status='success' WHERE id=?", (log_id,))
        return {
            "reply": reply,
            "status": "success"
        }

    except ServerError:
        with get_connection() as conn:
            conn.execute("UPDATE ai_usage_logs SET status='failed' WHERE id=?", (log_id,))
        import logging
        logging.exception("Gemini server unavailable")

        raise HTTPException(
            status_code=503,
            detail="Gemini is currently busy. Please try again shortly."
        )

    except Exception:
        with get_connection() as conn:
            conn.execute("UPDATE ai_usage_logs SET status='failed' WHERE id=?", (log_id,))
        import logging
        logging.exception("AI consultation failed")

        raise HTTPException(
            status_code=503,
            detail="AI consultation is temporarily unavailable."
        )

@app.get("/api/products")
def list_products():
    return {
        "products": get_all_products()
    }


@app.get("/api/products/{product_id}")
def product_detail(product_id: int):
    product = get_product_by_id(product_id)

    if product is None:
        raise HTTPException(
            status_code=404,
            detail="Product not found"
        )

    return product


@app.get("/api/quiz")
def public_quiz():
    with get_connection() as conn:
        rows = conn.execute("SELECT id, question_order, title, description, answers_json, version FROM quiz_questions WHERE published=1 ORDER BY question_order, id").fetchall()
    return {"questions": [{"id": row["id"], "order": row["question_order"], "title": row["title"], "description": row["description"], "answers": json.loads(row["answers_json"]), "version": row["version"]} for row in rows]}


class QuizCompletion(BaseModel):
    completion_id: UUID


@app.post("/api/quiz/completions")
def record_quiz_completion(payload: QuizCompletion):
    with get_connection() as conn:
        conn.execute("INSERT OR IGNORE INTO quiz_completions(completion_id) VALUES (?)", (str(payload.completion_id),))
    return {"status": "recorded"}


@app.post("/api/products/{product_id}/affiliate-click")
def affiliate_click(product_id: int):
    with get_connection() as conn:
        if conn.execute("SELECT 1 FROM products WHERE id=?", (product_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Product not found")
        conn.execute("INSERT INTO affiliate_clicks(product_id) VALUES (?)", (product_id,))
    return {"status": "recorded"}


@app.middleware("http")
async def protect_requests(request: Request, call_next):
    # Reject cross-origin browser writes, including cookie-authenticated uploads.
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        allowed = {str(request.base_url).rstrip("/")}
        allowed.update(o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip())
        if not PRODUCTION:
            allowed.update({"http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000", "http://127.0.0.1:3000"})
        if (origin and origin not in allowed) or request.headers.get("sec-fetch-site") == "cross-site":
            return JSONResponse({"detail": "Cross-origin write rejected"}, status_code=403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.url.path.startswith(("/api/auth", "/api/admin", "/api/user")):
        response.headers["Cache-Control"] = "no-store"
    if PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response


# Mount only public assets. Never mount the repository root or data directory.
@app.get("/login", include_in_schema=False)
def user_login_page():
    return FileResponse(FRONTEND_DIR / "html" / "login.html")


@app.get("/admin/login", include_in_schema=False)
def admin_login_page():
    return FileResponse(FRONTEND_DIR / "html" / "admin_login.html")


UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
for prefix in ("", "/frontend"):
    for directory in ("css", "js", "images"):
        app.mount(f"{prefix}/{directory}", StaticFiles(directory=FRONTEND_DIR / directory), name=f"{prefix}-{directory}")

@app.get("/{page}.html", include_in_schema=False)
@app.get("/frontend/html/{page}.html", include_in_schema=False)
def frontend_page(page: str, request: Request):
    if page == "cart":
        user = get_session_user(request.cookies.get(COOKIE_NAME))
        if not user:
            return RedirectResponse("/login", status_code=307, headers={"Cache-Control": "no-store"})
    if page == "login":
        return RedirectResponse("/login", status_code=307)
    # Explicit allowlist prevents exposing other repository files.
    if page not in {"index", "products", "product_detail", "skin_quiz", "ai_consultant", "cart", "login", "register", "admin_index", "admin_users", "profile"}:
        raise HTTPException(status_code=404)
    return FileResponse(FRONTEND_DIR / "html" / f"{page}.html", headers={"Cache-Control": "no-store"} if page == "cart" else None)
