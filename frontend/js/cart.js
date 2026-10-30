
"use strict";

const CART_KEY = "glowguide_cart";

// Lấy danh sách sản phẩm trong Cart
function getCart() {
  try {
    const data = JSON.parse(
      localStorage.getItem(CART_KEY) || "[]"
    );

    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Lưu Cart
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));

  window.dispatchEvent(
    new CustomEvent("glowguide:cartchanged")
  );
}

// Thêm sản phẩm vào Cart
function addToCart(productId) {
  const cart = getCart();
  const id = String(productId);

  const existing = cart.find(
    item => String(item.id) === id
  );

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: id,
      quantity: 1
    });
  }

  saveCart(cart);
}

// Tăng hoặc giảm số lượng
function updateCartQuantity(productId, quantity) {
  const cart = getCart();
  const id = String(productId);

  if (quantity <= 0) {
    removeFromCart(id);
    return;
  }

  const item = cart.find(
    item => String(item.id) === id
  );

  if (item) {
    item.quantity = quantity;
    saveCart(cart);
  }
}

// Xóa một sản phẩm
function removeFromCart(productId) {
  const id = String(productId);

  const updated = getCart().filter(
    item => String(item.id) !== id
  );

  saveCart(updated);
}

// Xóa toàn bộ Cart
function clearCart() {
  saveCart([]);
}

// Tổng số lượng sản phẩm
function getCartCount() {
  return getCart().reduce(
    (total, item) => total + item.quantity,
    0
  );
}

