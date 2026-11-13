import getpass
import sqlite3

from backend.database import get_connection, init_database
from backend.services.password_service import hash_password


def main():
    init_database()
    username = input("Admin username: ").strip()
    email = input("Admin email: ").strip().lower()
    password = getpass.getpass("Admin password: ")
    confirm = getpass.getpass("Confirm password: ")
    if len(username) < 3 or len(username) > 50:
        print("Username must contain 3-50 characters.")
        return
    if "@" not in email or len(email) > 254:
        print("Invalid email.")
        return
    if len(password) < 12 or password != confirm:
        print("Passwords must match and contain at least 12 characters.")
        return
    try:
        with get_connection() as conn:
            conn.execute("INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')", (username, email, hash_password(password)))
    except sqlite3.IntegrityError:
        print("Username or email already exists.")
        return
    print("Admin account created.")


if __name__ == "__main__":
    main()
