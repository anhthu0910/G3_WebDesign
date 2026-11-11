
"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const list = document.getElementById("cartItems");
  const count = document.getElementById("cartCount");
  const summary = document.getElementById("summaryCount");
  const totalNode = document.getElementById("estimatedTotal");
  const clearButton = document.getElementById("clearCartButton");
  const priceNotice = document.getElementById("priceNotice");

  if (!list) return;

  let products = [];
  let isLoaded = false;

  // ==========================
  // HELPERS
  // ==========================

  function createElement(tag, className = "", text = null) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== null) {
      element.textContent = text;
    }

    return element;
  }

  function getPrice(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const price = Number(value);

    return Number.isFinite(price) && price >= 0
      ? price
      : null;
  }

  function formatPrice(value) {
    if (value === null) {
      return "Price unavailable";
    }

    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND"
    }).format(value);
  }

  function getProduct(id) {
    return products.find(
      product => String(product.id) === String(id)
    );
  }

  // ==========================
  // EMPTY CART
  // ==========================

  function renderEmptyCart() {
    const empty = createElement("div", "cart-empty");

    const icon = createElement(
      "div",
      "cart-empty-icon",
      ""
    );

    const title = createElement(
      "h3",
      "",
      "Your cart is empty"
    );

    const description = createElement(
      "p",
      "",
      "Discover skincare products and add them to your cart."
    );

    const button = createElement(
      "a",
      "cart-browse-btn",
      "Explore Products →"
    );

    button.href = "products.html";

    empty.append(icon, title, description, button);
    list.appendChild(empty);
  }

  // ==========================
  // PRODUCT CARD
  // ==========================

  function createCartItem(product, item) {
    const card = createElement("article", "cart-item");

    // IMAGE
    const imageLink = createElement("a", "cart-item-image");
    imageLink.href =
      `product_detail.html?id=${encodeURIComponent(product.id)}`;

    if (product.image) {
      const image = document.createElement("img");

      image.src = product.image;
      image.alt = product.name || "Skincare product";
      image.loading = "lazy";

      image.onerror = () => {
        imageLink.replaceChildren();
        imageLink.textContent = "🧴";
      };

      imageLink.appendChild(image);
    } else {
      imageLink.textContent = "🧴";
    }

    // PRODUCT INFO
    const info = createElement("div", "cart-item-info");

    const brand = createElement(
      "p",
      "cart-brand",
      product.brand || "Skincare"
    );

    const name = createElement(
      "a",
      "cart-product-name",
      product.name || "Product"
    );

    name.href = imageLink.href;

    const category = createElement(
      "p",
      "cart-category",
      product.category || "Skincare Product"
    );

    const price = getPrice(product.price);

    const priceText = createElement(
      "p",
      "cart-price",
      formatPrice(price)
    );

    // QUANTITY CONTROLS
    const controls = createElement("div", "cart-controls");

    const quantityGroup = createElement(
      "div",
      "cart-quantity-group"
    );

    const minus = createElement(
      "button",
      "cart-quantity-btn",
      "−"
    );

    minus.type = "button";
    minus.setAttribute(
      "aria-label",
      `Decrease quantity of ${product.name}`
    );

    const quantity = createElement(
      "span",
      "cart-quantity",
      String(item.quantity)
    );

    const plus = createElement(
      "button",
      "cart-quantity-btn",
      "+"
    );

    plus.type = "button";
    plus.disabled = item.quantity >= MAX_CART_QUANTITY;
    plus.setAttribute(
      "aria-label",
      `Increase quantity of ${product.name}`
    );

    minus.addEventListener("click", () => {
      updateCartQuantity(item.id, item.quantity - 1);
    });

    plus.addEventListener("click", () => {
      updateCartQuantity(item.id, item.quantity + 1);
    });

    quantityGroup.append(minus, quantity, plus);

    const remove = createElement(
      "button",
      "cart-remove",
      "✕ Remove"
    );

    remove.type = "button";

    remove.addEventListener("click", () => {
      removeFromCart(item.id);
    });

    controls.append(quantityGroup, remove);

    // PURCHASE ACTIONS
    const actions = createElement("div", "cart-actions");

    const detailLink = createElement(
      "a",
      "cart-details",
      "View Details"
    );

    detailLink.href = imageLink.href;
    actions.appendChild(detailLink);

    const buyLink = getPurchaseUrl(product);

    if (buyLink) {
      const buyButton = createElement("a", "cart-buy");

      buyButton.href = buyLink.href;

      // Shopee logo
      const shopeeLogo = document.createElement("img");
      shopeeLogo.src = "../images/shopee-logo.png";
      shopeeLogo.alt = "";
      shopeeLogo.className = "cart-buy-logo";
      shopeeLogo.setAttribute("aria-hidden", "true");

      // Button text
      const buyText = document.createElement("span");
      buyText.textContent = "Buy Now";

      buyButton.append(shopeeLogo, buyText);

      if (buyLink.affiliate) buyButton.dataset.affiliateProduct = product.id;
      buyButton.target = "_blank";

      buyButton.rel = buyLink.affiliate
        ? "noopener noreferrer sponsored nofollow"
        : "noopener noreferrer";

      actions.appendChild(buyButton);
    } else {
      const unavailable = createElement(
        "span",
        "cart-buy-disabled",
        "Shopping link coming soon"
      );

      actions.appendChild(unavailable);
    }

    // ITEM SUBTOTAL
    if (price !== null) {
      const subtotal = createElement(
        "p",
        "cart-item-subtotal",
        `Subtotal: ${formatPrice(price * item.quantity)}`
      );

      info.append(
        brand,
        name,
        category,
        priceText,
        controls,
        subtotal,
        actions
      );
    } else {
      info.append(
        brand,
        name,
        category,
        priceText,
        controls,
        actions
      );
    }

    card.append(imageLink, info);

    return card;
  }

  // ==========================
  // RENDER CART
  // ==========================

  function renderCart() {
    if (!isLoaded) return;

    const cart = getCart();
    list.replaceChildren();

    let total = 0;
    let hasMissingPrices = false;

    const itemCount = getCartCount();

    if (count) {
      count.textContent = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
    }

    if (summary) {
      summary.textContent = String(itemCount);
    }

    if (clearButton) {
      clearButton.disabled = cart.length === 0;
    }

    if (cart.length === 0) {
      renderEmptyCart();
    }

    cart.forEach(item => {
      const product = getProduct(item.id);

      if (!product) {
        hasMissingPrices = true;

        const missing = createElement(
          "div",
          "cart-missing-item"
        );

        const message = createElement(
          "p",
          "",
          `Product #${item.id} is no longer available.`
        );

        const remove = createElement(
          "button",
          "cart-remove",
          "Remove"
        );

        remove.type = "button";
        remove.addEventListener("click", () => {
          removeFromCart(item.id);
        });

        missing.append(message, remove);
        list.appendChild(missing);
        return;
      }

      const price = getPrice(product.price);

      if (price === null) {
        hasMissingPrices = true;
      } else {
        total += price * item.quantity;
      }

      list.appendChild(createCartItem(product, item));
    });

    if (totalNode) {
      totalNode.textContent = formatPrice(total);
    }

    if (priceNotice) {
      priceNotice.textContent = hasMissingPrices
        ? "The estimated total excludes products without prices or unavailable products."
        : "Estimated prices may differ from final seller prices.";
    }
  }

  // ==========================
  // EVENTS
  // ==========================

  window.addEventListener(
    "glowguide:cartchanged",
    renderCart
  );

  window.addEventListener("storage", event => {
    if (event.key === CART_KEY || event.key === null) {
      renderCart();
    }
  });

  if (clearButton) {
    clearButton.addEventListener("click", () => {
      if (getCart().length === 0) return;

      const confirmed = window.confirm(
        "Are you sure you want to clear your cart?"
      );

      if (confirmed) {
        clearCart();
      }
    });
  }

  // ==========================
  // LOAD REAL PRODUCTS
  // ==========================

  try {
    await cartReady;
    const response = await fetch("/api/products");
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json();

    products = Array.isArray(data)
      ? data
      : data.products;

    if (!Array.isArray(products)) {
      throw new Error("Invalid product data");
    }

    isLoaded = true;
    renderCart();
  } catch (error) {
    console.error("Cart error:", error);

    list.textContent =
      "Could not load your cart. Please try again.";
  }
});
