import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from backend.database import get_connection
from backend.services.password_service import hash_password, verify_password, needs_rehash

SESSION_DAYS = 7


class AccountLockedError(Exception):
    pass


def utc_now():
    return datetime.now(timezone.utc)


def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def public_user(row):
    if row is None:
        return None
    return {"id": row["id"], "username": row["username"], "email": row["email"], "role": row["role"]}


def create_user(username, email, password):
    username, email = username.strip(), email.strip().lower()
    with get_connection() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'user')",
                (username, email, hash_password(password)),
            )
            row = conn.execute("SELECT id, username, email, role FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
            return public_user(row)
        except Exception as error:
            if "UNIQUE" in str(error).upper():
                raise ValueError("Username or email already exists") from error
            raise


def authenticate_user(identifier, password, role=None):
    identifier = identifier.strip().lower()
    with get_connection() as conn:
        if role not in ("user", "admin"):
            role = None
        query = "SELECT * FROM users WHERE (lower(username) = ? OR lower(email) = ?)"
        params = [identifier, identifier]
        if role:
            query += " AND role = ?"
            params.append(role)
        row = conn.execute(query, params).fetchone()
        if row is None or not verify_password(password, row["password_hash"]):
            return None
        if row["locked"]:
            raise AccountLockedError()
        if needs_rehash(row["password_hash"]):
            conn.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(password), row["id"]))
        return public_user(row)


def create_session(user_id):
    token = secrets.token_urlsafe(32)
    now = utc_now()
    expires = now + timedelta(days=SESSION_DAYS)
    with get_connection() as conn:
        conn.execute("INSERT INTO sessions (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)", (user_id, token_digest(token), now.isoformat(), expires.isoformat()))
    return token, expires


def get_session_user(token):
    if not token:
        return None
    with get_connection() as conn:
        row = conn.execute("SELECT u.id, u.username, u.email, u.role, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND u.locked = 0", (token_digest(token),)).fetchone()
        if row is None or datetime.fromisoformat(row["expires_at"]) <= utc_now():
            if row is not None:
                conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_digest(token),))
            return None
        return public_user(row)


def delete_session(token):
    if token:
        with get_connection() as conn:
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (token_digest(token),))
