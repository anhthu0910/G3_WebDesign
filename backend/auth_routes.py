from backend.config import COOKIE_SECURE
from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from typing import Literal

from backend.services.auth_service import authenticate_user, create_session, create_user, delete_session, get_session_user, SESSION_DAYS

router = APIRouter(prefix="/api/auth")
admin_router = APIRouter(prefix="/api/admin")
COOKIE_NAME = "glowguide_session"


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        if "@" not in value:
            raise ValueError("Invalid email")
        return value


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)
    # Optional keeps older cached Login pages compatible. The new page sends
    # an explicit role, which is enforced by authenticate_user().
    role: Literal["user", "admin"] | None = None


def current_user(session: str | None = Cookie(default=None, alias=COOKIE_NAME)):
    user = get_session_user(session)
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


@router.post("/register", status_code=201)
def register(request: RegisterRequest):
    try:
        return {"user": create_user(request.username, request.email, request.password)}
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error))


@router.post("/login")
def login(request: LoginRequest, response: Response):
    user = authenticate_user(request.identifier, request.password, request.role)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token, _ = create_session(user["id"])
    response.set_cookie(COOKIE_NAME, token, max_age=SESSION_DAYS * 86400, httponly=True, samesite="lax", secure=COOKIE_SECURE, path="/")
    return {"user": user}


@router.get("/me")
def me(user=Depends(current_user)):
    return {"user": user}


@router.post("/logout")
def logout(response: Response, session: str | None = Cookie(default=None, alias=COOKIE_NAME)):
    delete_session(session)
    response.delete_cookie(COOKIE_NAME, path="/", secure=COOKIE_SECURE, httponly=True, samesite="lax")
    return {"status": "ok"}


@admin_router.get("/me")
def admin_me(user=Depends(current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return {"user": user}
