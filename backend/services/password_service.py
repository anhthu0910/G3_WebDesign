
from argon2 import PasswordHasher
from argon2.exceptions import (
    VerifyMismatchError,
    VerificationError,
    InvalidHashError
)

password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    if not password or len(password) < 8:
        raise ValueError("Password must have at least 8 characters")

    return password_hasher.hash(password)


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        return password_hasher.verify(stored_hash, password)
    except (
        VerifyMismatchError,
        VerificationError,
        InvalidHashError
    ):
        return False


def needs_rehash(stored_hash: str) -> bool:
    try:
        return password_hasher.check_needs_rehash(stored_hash)
    except (VerificationError, InvalidHashError):
        return False
