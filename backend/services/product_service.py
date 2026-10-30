
import json

from backend.database import (
    get_all_products as db_get_all_products,
    get_product_by_id as db_get_product_by_id
)


def get_all_products():
    """Get all skincare products from SQLite."""
    return db_get_all_products()


def get_product_by_id(product_id: int):
    """Get a product by ID from SQLite."""
    return db_get_product_by_id(product_id)


def get_product_context():
    """
    Provide relevant product information to Gemini.
    Keep the same format as the original implementation.
    """
    allowed_fields = [
        "id",
        "name",
        "brand",
        "category",
        "price",
        "skinTypes",
        "concerns",
        "ingredients",
        "description",
        "verified"
    ]

    products = get_all_products()

    safe_products = [
        {
            key: product.get(key)
            for key in allowed_fields
        }
        for product in products
    ]

    return json.dumps(
        safe_products,
        ensure_ascii=False,
        indent=2
    )
