
"use strict";

let CART_KEY = null;
let CART_USER = null;
const MAX_CART_QUANTITY = 999;
function cartProductId(value) {
  if (!["number", "string"].includes(typeof value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? String(id) : null;
}
function normalizeCart(items) {
  const result = new Map();
  if (!Array.isArray(items)) return [];
  for (const item of items) {
    const id = cartProductId(item?.id);
    if (id && Number.isSafeInteger(item?.quantity) && item.quantity > 0) {
      result.set(id, Math.min(MAX_CART_QUANTITY, (result.get(id) || 0) + item.quantity));
    }
  }
  return [...result].map(([id, quantity]) => ({ id, quantity }));
}
const cartReady = (async () => {
  // Never assign a signed-in cart to the guest when the session API fails.
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (!response.ok && response.status !== 401) throw new Error("Unable to identify cart owner");
  const user = response.ok ? (await response.json()).user : null;
  CART_USER = user;
  CART_KEY = user ? `glowguide_cart:user:${user.id}` : "glowguide_cart:guest";
  window.dispatchEvent(new CustomEvent("glowguide:cartchanged"));
})();
cartReady.catch(error => console.error(error));

// Lấy danh sách sản phẩm trong Cart
function getCart() {
  if (!CART_KEY || CART_USER?.role !== "user") return [];
  try {
    const data = JSON.parse(
      localStorage.getItem(CART_KEY) || "[]"
    );

    return normalizeCart(data);
  } catch {
    return [];
  }
}

// Lưu Cart
function saveCart(cart) {
  if (!CART_KEY || CART_USER?.role !== "user") return;
  try { localStorage.setItem(CART_KEY, JSON.stringify(normalizeCart(cart))); }
  catch { alert("Could not save cart. Please check browser storage and retry."); return; }

  window.dispatchEvent(
    new CustomEvent("glowguide:cartchanged")
  );
}

// Thêm sản phẩm vào Cart
function addToCart(productId) {
  if (!cartProductId(productId)) return;
  if (!CART_KEY) { cartReady.then(() => addToCart(productId)).catch(() => alert("Cart unavailable. Please refresh the page.")); return; }
  if (CART_USER?.role !== "user") {
    alert("Please log in to add items to your cart.");
    return;
  }
  const cart = getCart();
  const id = cartProductId(productId);

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
  if (!Number.isSafeInteger(quantity)) return;
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

// Hiển thị số lượng sản phẩm trên Cart ở navbar
function updateCartBadge() {
  const cartLinks = document.querySelectorAll(
    'nav a[href$="cart.html"]'
  );

  cartLinks.forEach(link => {
    let badge = link.querySelector(".cart-badge");

    if (!badge) {
      badge = document.createElement("span");
      badge.className = "cart-badge";
      badge.setAttribute("aria-hidden", "true");
      link.appendChild(badge);
    }

    const count = getCartCount();

    badge.textContent = count;
    badge.hidden = count === 0;

    link.setAttribute(
      "aria-label",
      count > 0 ? `Cart, ${count} items` : "Cart"
    );
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await cartReady;
    updateCartBadge();
  } catch (error) {
    console.error("Unable to update cart badge:", error);
  }
});

window.addEventListener("glowguide:cartchanged", updateCartBadge);
window.addEventListener("storage", event => {
  if (event.key === CART_KEY || event.key === null) updateCartBadge();
});
