
from backend.database import (
    get_all_products,
    get_product_by_id
)


def list_products():
    """Return all skincare products from SQLite."""
    return get_all_products()


def find_product(product_id: int):
    """Return one product or None."""
    return get_product_by_id(product_id)
