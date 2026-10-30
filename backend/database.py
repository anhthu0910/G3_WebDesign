
import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from backend.config import BASE_DIR, DATA_DIR, DB_PATH

JSON_PATH = BASE_DIR / "data" / "products.seed.json"


@contextmanager
def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")

    try:
        with conn:
            yield conn
    finally:
        conn.close()


def init_database():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                brand TEXT,
                category TEXT,
                price REAL,
                currency TEXT DEFAULT 'VND',
                image TEXT,
                affiliate_url TEXT,
                product_url TEXT,
                product_data TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user'
                    CHECK (role IN ('user', 'admin')),
                locked INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id)
                    REFERENCES users(id)
                    ON DELETE CASCADE
            )
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_user_id
            ON sessions(user_id)
        """)

        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
            ON sessions(expires_at)
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS affiliate_clicks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                clicked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS quiz_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question_order INTEGER NOT NULL DEFAULT 0,
                title TEXT NOT NULL,
                description TEXT,
                answers_json TEXT NOT NULL,
                published INTEGER NOT NULL DEFAULT 0,
                version INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS home_content (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS ai_usage_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                status TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS admin_audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_user_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                entity TEXT NOT NULL,
                entity_id TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_user_id) REFERENCES users(id)
            )
        """)

        user_columns = {row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
        if "locked" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN locked INTEGER NOT NULL DEFAULT 0")

        product_columns = {row[1] for row in conn.execute("PRAGMA table_info(products)").fetchall()}
        if "visible" not in product_columns:
            conn.execute("ALTER TABLE products ADD COLUMN visible INTEGER NOT NULL DEFAULT 1")

        conn.commit()

    print("SQLite database initialized:", DB_PATH)


def import_products_from_json():
    if not JSON_PATH.exists():
        print("products.json not found. Import skipped.")
        return

    with JSON_PATH.open("r", encoding="utf-8") as file:
        products = json.load(file)

    if isinstance(products, dict):
        products = products.get("products", [])

    if not isinstance(products, list):
        raise ValueError("Invalid products.json format")

    with get_connection() as conn:
        existing_count = conn.execute(
            "SELECT COUNT(*) FROM products"
        ).fetchone()[0]

        if existing_count > 0:
            print(
                "Products already exist in SQLite. "
                "Import skipped to protect existing data."
            )
            return

        for product in products:
            conn.execute("""
                INSERT INTO products (
                    id, name, brand, category,
                    price, currency, image,
                    affiliate_url, product_url,
                    product_data
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                product["id"],
                product["name"],
                product.get("brand"),
                product.get("category"),
                product.get("price"),
                product.get("currency", "VND"),
                product.get("image"),
                product.get("affiliate_url", ""),
                product.get("product_url", ""),
                json.dumps(product, ensure_ascii=False)
            ))

        conn.commit()

    print(f"Imported {len(products)} products into SQLite.")


def get_all_products():
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT product_data
            FROM products
            WHERE visible = 1
            ORDER BY id
        """).fetchall()

    return [
        json.loads(row["product_data"])
        for row in rows
    ]


def get_product_by_id(product_id: int):
    with get_connection() as conn:
        row = conn.execute("""
            SELECT product_data
            FROM products
            WHERE id = ? AND visible = 1
        """, (product_id,)).fetchone()

    if row is None:
        return None

    return json.loads(row["product_data"])


if __name__ == "__main__":
    init_database()
    import_products_from_json()

    print("Products in database:", len(get_all_products()))
