import json
import os
import secrets
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field, field_validator

from backend.auth_routes import current_user
from backend.config import UPLOAD_DIR
from backend.database import get_connection

router = APIRouter(prefix="/api/admin", tags=["admin"])
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024


def write_audit(user, action, entity, entity_id=None):
    with get_connection() as conn:
        conn.execute("INSERT INTO admin_audit_logs(admin_user_id, action, entity, entity_id) VALUES (?, ?, ?, ?)", (user["id"], action, entity, str(entity_id) if entity_id is not None else None))


def require_admin(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


class ProductPayload(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    brand: str = ""
    category: str = ""
    price: float | None = Field(default=None, ge=0)
    currency: str = "VND"
    image: str = ""
    description: str = ""
    skinTypes: list[str] = Field(default_factory=list)
    concerns: list[str] = Field(default_factory=list)
    ingredients: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    usage: str = ""
    cautions: str = ""
    size: str = ""
    color: str = ""
    icon: str = ""
    product_url: str = ""
    affiliate_url: str = ""
    visible: bool = True


class QuizPayload(BaseModel):
    question_order: int = 0
    title: str = Field(min_length=1, max_length=500)
    description: str = ""
    answers: list[dict] = Field(min_length=1)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value):
        if not value.strip():
            raise ValueError("Question title is required")
        return value.strip()

    @field_validator("answers")
    @classmethod
    def validate_answers(cls, answers):
        for answer in answers:
            if not isinstance(answer.get("text"), str) or not answer["text"].strip():
                raise ValueError("Every answer must contain text")
            if answer.get("type") not in {None, "dry", "normal", "oily", "combination", "sensitive"}:
                raise ValueError("Invalid skin type")
        return answers

    published: bool = False


class ContentPayload(BaseModel):
    value: str = ""


def product_row(row):
    product = json.loads(row["product_data"])
    product["visible"] = bool(row["visible"])
    return product


def missing_ingredients(product):
    ingredients = product.get("ingredients")
    if isinstance(ingredients, list):
        return not any(item is not None and str(item).strip() for item in ingredients)
    return not str(ingredients or "").strip()


PRODUCT_ALERTS = {
    "missing_image": lambda product: not str(product.get("image") or "").strip(),
    "missing_price": lambda product: (
        product.get("price") is None
        or isinstance(product.get("price"), str)
        and not product["price"].strip()
    ),
    "missing_purchase_link": lambda product: not (
        str(product.get("product_url") or "").strip()
        or str(product.get("affiliate_url") or "").strip()
    ),
    "missing_description": lambda product: not str(
        product.get("description") or ""
    ).strip(),
    "missing_ingredients": missing_ingredients,
}


@router.get("/products")
def admin_products(
    issue: str | None = Query(default=None),
    _: dict = Depends(require_admin),
):
    if issue is not None and issue not in PRODUCT_ALERTS:
        raise HTTPException(status_code=400, detail="Unknown product data alert")
    with get_connection() as conn:
        products = [
            product_row(row)
            for row in conn.execute(
                "SELECT product_data, visible FROM products ORDER BY id"
            ).fetchall()
        ]
    if issue is not None:
        products = [product for product in products if PRODUCT_ALERTS[issue](product)]
    return {"products": products}


@router.post("/products", status_code=201)
def create_product(payload: ProductPayload, admin_user: dict = Depends(require_admin)):
    product = payload.model_dump()
    with get_connection() as conn:
        cursor = conn.execute(
            """INSERT INTO products (
                name, brand, category, price, currency, image,
                affiliate_url, product_url, product_data, visible
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                product["name"],
                product["brand"],
                product["category"],
                product["price"],
                product["currency"],
                product["image"],
                product["affiliate_url"],
                product["product_url"],
                "{}",
                int(product["visible"]),
            ),
        )
        next_id = cursor.lastrowid
        product["id"] = next_id
        conn.execute(
            "UPDATE products SET product_data=? WHERE id=?",
            (json.dumps(product, ensure_ascii=False), next_id),
        )
    write_audit(admin_user, "create", "product", next_id)
    return product


@router.put("/products/{product_id}")
def update_product(product_id: int, payload: ProductPayload, admin_user: dict = Depends(require_admin)):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM products WHERE id = ?", (product_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")
        original_product = json.loads(row["product_data"])
        product = original_product.copy()
        # Older catalog JSON can omit fields that already exist in SQL columns.
        # Fill only missing fields so partial edits preserve the existing values.
        for field in ("name", "brand", "category", "price", "currency", "image", "affiliate_url", "product_url"):
            product.setdefault(field, row[field])
        product.setdefault("visible", bool(row["visible"]))
        product.update(payload.model_dump(exclude_unset=True))
        product["id"] = product_id
        conn.execute(
            """UPDATE products
            SET name=?, brand=?, category=?, price=?, currency=?, image=?,
                affiliate_url=?, product_url=?, product_data=?, visible=?,
                updated_at=CURRENT_TIMESTAMP
            WHERE id=?""",
            (
                product["name"],
                product["brand"],
                product["category"],
                product["price"],
                product["currency"],
                product["image"],
                product["affiliate_url"],
                product["product_url"],
                json.dumps(product, ensure_ascii=False),
                int(product["visible"]),
                product_id,
            ),
        )
    changed = sorted(
        key for key in payload.model_fields_set
        if key != "id" and product.get(key) != original_product.get(key)
    )
    write_audit(admin_user, "update: " + (", ".join(changed) or "no changes"), "product", product_id)
    return product


@router.delete("/products/{product_id}")
def delete_product(product_id: int, admin_user: dict = Depends(require_admin)):
    with get_connection() as conn:
        if conn.execute("DELETE FROM products WHERE id = ?", (product_id,)).rowcount == 0:
            raise HTTPException(status_code=404, detail="Product not found")
    write_audit(admin_user, "delete", "product", product_id)
    return {"status": "deleted", "id": product_id}


@router.post("/products/{product_id}/image")
async def upload_product_image(product_id: int, file: UploadFile = File(...), admin_user: dict = Depends(require_admin)):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG or WEBP images are allowed")
    data = await file.read(MAX_IMAGE_SIZE + 1)
    if len(data) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=413, detail="Image must be at most 5 MB")
    with get_connection() as conn:
        row = conn.execute("SELECT product_data FROM products WHERE id = ?", (product_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")
        product = json.loads(row["product_data"])
        filename = f"product_{product_id}_{secrets.token_hex(8)}{ALLOWED_IMAGE_TYPES[file.content_type]}"
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        (UPLOAD_DIR / filename).write_bytes(data)
        path = f"/uploads/{filename}"
        product["image"] = path
        conn.execute("UPDATE products SET image=?, product_data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", (path, json.dumps(product, ensure_ascii=False), product_id))
    write_audit(admin_user, "upload_image", "product", product_id)
    return {"image": path}


@router.get("/analytics")
def analytics(_: dict = Depends(require_admin)):
    with get_connection() as conn:
        return {"products": conn.execute("SELECT COUNT(*) FROM products").fetchone()[0], "users": conn.execute("SELECT COUNT(*) FROM users WHERE role='user'").fetchone()[0], "affiliate_clicks": conn.execute("SELECT COUNT(*) FROM affiliate_clicks").fetchone()[0], "quiz_submissions": 0, "missing_images": conn.execute("SELECT COUNT(*) FROM products WHERE image IS NULL OR image='' ").fetchone()[0]}


@router.get("/overview")
def overview(_: dict = Depends(require_admin)):
    today = date.today()
    year_start = date(today.year, 1, 1)
    year_end = date(today.year + 1, 1, 1)
    current_week = today - timedelta(days=today.weekday())
    first_week = current_week - timedelta(weeks=5)
    with get_connection() as conn:
        products = conn.execute("SELECT product_data FROM products").fetchall()
        users = conn.execute("SELECT COUNT(*) FROM users WHERE role='user'").fetchone()[0]
        affiliate_clicks = conn.execute("SELECT COUNT(*) FROM affiliate_clicks").fetchone()[0]
        quiz_published = conn.execute("SELECT COUNT(*) FROM quiz_questions WHERE published=1").fetchone()[0] > 0
        ai_requests = conn.execute("SELECT COUNT(*) FROM ai_usage_logs").fetchone()[0]
        affiliate_by_month = {
            int(row["month"]): row["total"]
            for row in conn.execute(
                """SELECT CAST(strftime('%m', clicked_at) AS INTEGER) AS month,
                          COUNT(*) AS total
                   FROM affiliate_clicks
                   WHERE clicked_at >= ? AND clicked_at < ?
                   GROUP BY month""",
                (year_start.isoformat(), year_end.isoformat()),
            ).fetchall()
        }
        ai_by_week = {
            row["week"]: row["total"]
            for row in conn.execute(
                """SELECT strftime('%Y-%W', created_at) AS week, COUNT(*) AS total
                   FROM ai_usage_logs
                   WHERE date(created_at) >= ? AND date(created_at) < ?
                   GROUP BY week""",
                (first_week.isoformat(), (current_week + timedelta(weeks=1)).isoformat()),
            ).fetchall()
        }
        products_by_category = [
            {"label": row["category"], "value": row["total"]}
            for row in conn.execute(
                """SELECT COALESCE(NULLIF(TRIM(category), ''), 'Other') AS category,
                          COUNT(*) AS total
                   FROM products
                   GROUP BY category
                   ORDER BY total DESC, category COLLATE NOCASE"""
            ).fetchall()
        ]
        alerts = {issue: 0 for issue in PRODUCT_ALERTS}
        for row in products:
            product = json.loads(row["product_data"])
            for issue, is_missing in PRODUCT_ALERTS.items():
                if is_missing(product):
                    alerts[issue] += 1
        activity = [dict(row) for row in conn.execute("SELECT l.action, l.entity, l.entity_id, l.created_at, u.username FROM admin_audit_logs l JOIN users u ON u.id=l.admin_user_id ORDER BY l.id DESC LIMIT 10").fetchall()]
        charts = {
            "affiliate_clicks_by_month": {
                "year": today.year,
                "labels": [date(today.year, month, 1).strftime("%b") for month in range(1, 13)],
                "values": [affiliate_by_month.get(month, 0) for month in range(1, 13)],
            },
            "ai_requests_by_week": {
                "labels": [
                    (first_week + timedelta(weeks=week)).strftime("%b ")
                    + str((first_week + timedelta(weeks=week)).day)
                    for week in range(6)
                ],
                "values": [
                    ai_by_week.get(
                        (first_week + timedelta(weeks=week)).strftime("%Y-%W"), 0
                    )
                    for week in range(6)
                ],
            },
            "products_by_category": products_by_category,
        }
        return {
            "cards": {"products": len(products), "users": users, "quiz_completions": None, "ai_requests": ai_requests, "affiliate_clicks": affiliate_clicks},
            "charts": charts,
            "alerts": alerts,
            "status": {"fastapi": "online", "sqlite": "online", "gemini": "configured" if os.getenv("GEMINI_API_KEY") else "not configured", "skin_quiz": "published" if quiz_published else "not published"},
            "recent_activity": activity
        }


@router.get("/audit-logs")
def audit_logs(_: dict = Depends(require_admin)):
    with get_connection() as conn:
        return {"logs": [dict(row) for row in conn.execute("SELECT l.action, l.entity, l.entity_id, l.created_at, u.username FROM admin_audit_logs l JOIN users u ON u.id=l.admin_user_id ORDER BY l.id DESC LIMIT 100").fetchall()]}


@router.get("/quiz")
def admin_quiz(_: dict = Depends(require_admin)):
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM quiz_questions ORDER BY question_order, id").fetchall()
    return {"questions": [{**dict(row), "answers": json.loads(row["answers_json"])} for row in rows]}


@router.post("/quiz", status_code=201)
def create_quiz(payload: QuizPayload, _: dict = Depends(require_admin)):
    with get_connection() as conn:
        cur = conn.execute("INSERT INTO quiz_questions (question_order,title,description,answers_json,published) VALUES (?,?,?,?,?)", (payload.question_order, payload.title, payload.description, json.dumps(payload.answers, ensure_ascii=False), int(payload.published)))
        return {"id": cur.lastrowid, **payload.model_dump()}


@router.put("/quiz/{question_id}")
def update_quiz(question_id: int, payload: QuizPayload, _: dict = Depends(require_admin)):
    with get_connection() as conn:
        if conn.execute("UPDATE quiz_questions SET question_order=?,title=?,description=?,answers_json=?,published=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?", (payload.question_order, payload.title, payload.description, json.dumps(payload.answers, ensure_ascii=False), int(payload.published), question_id)).rowcount == 0:
            raise HTTPException(status_code=404, detail="Quiz question not found")
    return {"id": question_id, **payload.model_dump()}


@router.delete("/quiz/{question_id}")
def delete_quiz(question_id: int, _: dict = Depends(require_admin)):
    with get_connection() as conn:
        if conn.execute("DELETE FROM quiz_questions WHERE id=?", (question_id,)).rowcount == 0:
            raise HTTPException(status_code=404, detail="Quiz question not found")
    return {"status": "deleted"}


@router.get("/content")
def get_content(_: dict = Depends(require_admin)):
    with get_connection() as conn:
        return {row["key"]: row["value"] for row in conn.execute("SELECT key,value FROM home_content")}


@router.put("/content/{key}")
def update_content(key: str, payload: ContentPayload, _: dict = Depends(require_admin)):
    with get_connection() as conn:
        conn.execute("INSERT INTO home_content(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP", (key, payload.value))
    return {"key": key, "value": payload.value}


@router.get("/ai/status")
def ai_status(_: dict = Depends(require_admin)):
    return {"configured": bool(os.getenv("GEMINI_API_KEY")), "message": "API key status is never exposed."}


@router.post("/ai/test")
def ai_test(_: dict = Depends(require_admin)):
    return {"status": "ready", "message": "Use the existing AI Consultant flow for a live Gemini test."}


@router.get("/users")
def users(_: dict = Depends(require_admin)):
    with get_connection() as conn:
        return {"users": [dict(row) for row in conn.execute("SELECT id, username, email, role, created_at, locked FROM users WHERE role='user' ORDER BY id DESC").fetchall()]}


@router.patch("/users/{user_id}/lock")
def lock_user(user_id: int, locked: bool, admin_user: dict = Depends(require_admin)):
    with get_connection() as conn:
        if conn.execute("UPDATE users SET locked=? WHERE id=? AND role='user'", (int(locked), user_id)).rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")
    write_audit(admin_user, "lock" if locked else "unlock", "user", user_id)
    return {"id": user_id, "locked": locked}
