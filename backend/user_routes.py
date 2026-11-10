"""Session-owned account preferences and latest quiz result."""
import json
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator
from backend.auth_routes import current_user
from backend.database import get_connection

router = APIRouter(prefix="/api/user", tags=["user"])


def require_user(user=Depends(current_user)):
    if user["role"] != "user":
        raise HTTPException(403, "User account required")
    return user


class SkinProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")
    skinType: Literal["dry", "normal", "oily", "combination", "sensitive"] | None = None
    concern: str = Field(default="", max_length=100)


class QuizResult(SkinProfile):
    inconclusive: StrictBool


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: str | None = Field(default=None, min_length=3, max_length=254)
    skin_profile: SkinProfile | None = None
    quiz_result: QuizResult | None = None

    @field_validator("username", "email", mode="before")
    @classmethod
    def trim_identity(cls, value):
        if not isinstance(value, str) or not value.strip():
            raise ValueError("Account information is required")
        return value.strip()

    @field_validator("email")
    @classmethod
    def validate_email(cls, value):
        if value.count("@") != 1 or any(c.isspace() for c in value) or not all(value.split("@")):
            raise ValueError("Invalid email")
        return value.lower()


def response_data(user, row):
    return {"user": user, **{field: json.loads(row[field]) if row and row[field] else None for field in ("skin_profile", "quiz_result")}}


@router.get("/profile")
def profile(user=Depends(require_user)):
    with get_connection() as conn:
        row = conn.execute("SELECT skin_profile,quiz_result FROM user_profiles WHERE user_id=?", (user["id"],)).fetchone()
    return response_data(user, row)


@router.put("/profile")
def update_profile(payload: ProfileUpdate, user=Depends(require_user)):
    with get_connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT skin_profile,quiz_result FROM user_profiles WHERE user_id=?", (user["id"],)).fetchone()
        data = response_data(user, row)
        for field in ("username", "email"):
            if field in payload.model_fields_set:
                value = getattr(payload, field)
                if conn.execute(f"SELECT 1 FROM users WHERE lower({field})=lower(?) AND id!=?", (value, user["id"])).fetchone():
                    raise HTTPException(409, "Username or email already exists")
                conn.execute(f"UPDATE users SET {field}=? WHERE id=?", (value, user["id"]))
                data["user"][field] = value
        for field in ("skin_profile", "quiz_result"):
            if field in payload.model_fields_set:
                value = getattr(payload, field)
                data[field] = value.model_dump() if value else None
        if payload.quiz_result and "skin_profile" not in payload.model_fields_set:
            data["skin_profile"] = payload.quiz_result.model_dump(exclude={"inconclusive"})
        conn.execute("""INSERT INTO user_profiles(user_id,skin_profile,quiz_result) VALUES (?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET skin_profile=excluded.skin_profile,quiz_result=excluded.quiz_result""",
            (user["id"], *[json.dumps(data[field]) if data[field] else None for field in ("skin_profile", "quiz_result")]))
    return data
