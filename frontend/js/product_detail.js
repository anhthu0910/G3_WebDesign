
"use strict";

// ==========================================
// GLOWGUIDE - PRODUCT DETAIL
// Data source: FastAPI /api/products
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {

  const API_BASE_URL = "";

  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");

  const detail = document.getElementById("productDetail");
  const notFound = document.getElementById("notFound");
  const loadingState = document.getElementById("loadingState");

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  function setText(elementId, value, fallback = "Not available") {
    const element = document.getElementById(elementId);

    if (!element) return;

    element.textContent =
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
        ? String(value)
        : fallback;
  }

  function formatPrice(price) {
    if (
      price === null ||
      price === undefined ||
      price === ""
    ) {
      return "Price unavailable";
    }

    const numericPrice = Number(price);

    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return "Price unavailable";
    }

    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND"
    }).format(numericPrice);
  }

  function formatLabel(value) {
    return String(value ?? "")
      .replace(/-/g, " ")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  function getArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function getSafeUrl(value) {
    if (!value || typeof value !== "string") {
      return null;
    }

    try {
      const url = new URL(value, window.location.href);

      if (
        url.protocol === "https:" ||
        url.protocol === "http:"
      ) {
        return url.href;
      }

    } catch (error) {
      return null;
    }

    return null;
  }

  function showError(message) {
    if (loadingState) {
      loadingState.hidden = true;
    }

    if (detail) {
      detail.hidden = true;
    }

    if (notFound) {
      notFound.hidden = false;
    }

    setText(
      "notFoundMessage",
      message,
      "Could not load products. Please try again."
    );
  }

  // ==========================================
  // FETCH PRODUCT DATA
  // ==========================================

  async function fetchProduct(id) {
    const response = await fetch(
      `${API_BASE_URL}/api/products/${encodeURIComponent(id)}`
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(
        `Product API error: ${response.status}`
      );
    }

    return await response.json();
  }

  async function fetchAllProducts() {
    const response = await fetch(
      `${API_BASE_URL}/api/products`
    );

    if (!response.ok) {
      throw new Error(
        `Products API error: ${response.status}`
      );
    }

    const data = await response.json();

    if (Array.isArray(data)) {
      return data;
    }

    if (data && Array.isArray(data.products)) {
      return data.products;
    }

    throw new Error("Invalid products API response");
  }

  // ==========================================
  // RENDER SKIN TAGS
  // ==========================================

  function renderTags(elementId, values) {
    const container = document.getElementById(elementId);

    if (!container) return;

    container.replaceChildren();

    const tags = getArray(values);

    if (tags.length === 0) {
      const fallback = document.createElement("span");
      fallback.className = "detail-tag";
      fallback.textContent = "Not specified";

      container.appendChild(fallback);
      return;
    }

    tags.forEach((value) => {
      const tag = document.createElement("span");

      tag.className = "detail-tag";
      tag.textContent = formatLabel(value);

      container.appendChild(tag);
    });
  }

  // ==========================================
  // RENDER INGREDIENTS AND BENEFITS
  // ==========================================

  function renderList(elementId, values) {
    const container = document.getElementById(elementId);

    if (!container) return;

    container.replaceChildren();

    const items = getArray(values);

    if (items.length === 0) {
      const item = document.createElement("li");

      item.textContent = "Information not yet available.";

      container.appendChild(item);
      return;
    }

    items.forEach((value) => {
      const item = document.createElement("li");

      item.textContent = String(value);
      container.appendChild(item);
    });
  }

  // ==========================================
  // RENDER PRODUCT IMAGE
  // ==========================================

  function renderProductImage(product) {
    const visual = document.getElementById("productVisual");

    if (!visual) return;

    visual.replaceChildren();

    if (
      typeof product.color === "string" &&
      /^#[0-9a-fA-F]{6}$/.test(product.color)
    ) {
      visual.style.backgroundColor = product.color;
    }

    const imageUrl = getSafeUrl(product.image);

    if (imageUrl) {
      const image = document.createElement("img");

      image.src = imageUrl;
      image.alt = product.name || "Skincare product";
      image.loading = "eager";

      image.style.width = "100%";
      image.style.height = "100%";
      image.style.objectFit = "contain";

      image.onerror = () => {
        visual.replaceChildren();

        const fallback = document.createElement("span");
        fallback.id = "productIcon";
        fallback.textContent = product.icon || "🧴";

        visual.appendChild(fallback);
      };

      visual.appendChild(image);

    } else {
      const fallback = document.createElement("span");

      fallback.id = "productIcon";
      fallback.textContent = product.icon || "🧴";

      visual.appendChild(fallback);
    }
  }

  // ==========================================
  // RENDER BASIC PRODUCT INFORMATION
  // ==========================================

  function renderProduct(product) {
    document.title =
      `${product.name || "Product Detail"} | GlowGuide`;

    setText("breadcrumbName", product.name);
    setText("productBrand", product.brand);
    setText("productName", product.name);
    setText("productCategory", product.category);
    setText("productPrice", formatPrice(product.price));
    setText("productSummary", product.description);

    renderProductImage(product);

    renderTags("skinTags", product.skinTypes);
    renderTags("concernTags", product.concerns);

    renderList("ingredients", product.ingredients);
    renderList("benefits", product.benefits);

    setText(
      "usage",
      product.usage,
      "Usage instructions not yet available."
    );

    setText(
      "cautions",
      product.cautions,
      "Please refer to the official product label."
    );

    // Ingredient verification notice
    const disclaimer = document.getElementById(
      "ingredientDisclaimer"
    );

    if (disclaimer) {
      disclaimer.textContent = product.verified === true
        ? "Check the product packaging for the latest ingredient list."
        : "Ingredient information has not yet been fully verified.";
    }

    // Ask Gemini about this product
    const askAI = document.getElementById("askAI");

    if (askAI) {
      askAI.href =
        `ai_consultant.html?product=${encodeURIComponent(product.id)}`;
    }

    const cartButton = document.getElementById("cartButton");

    if (cartButton) {
      function updateCartButton() {
        const isAdded = getCart().some(
          item => String(item.id) === String(product.id)
        );

        cartButton.textContent = isAdded
          ? "Added to Cart"
          : "Add to Cart";
        cartButton.classList.toggle("added", isAdded);
        cartButton.setAttribute("aria-pressed", String(isAdded));
      }

      cartButton.onclick = () => {
        const isAdded = getCart().some(
          item => String(item.id) === String(product.id)
        );

        if (isAdded) removeFromCart(product.id);
        else addToCart(product.id);

        updateCartButton();
      };

      window.addEventListener("glowguide:cartchanged", updateCartButton);
      updateCartButton();
    }

    // ==========================================
    // AFFILIATE BUTTON
    // ==========================================

    const buyButton = document.getElementById("buyProduct");

    if (buyButton) {
      const affiliateUrl = getSafeUrl(product.affiliate_url);

      if (affiliateUrl) {
        buyButton.href = affiliateUrl;
        buyButton.dataset.affiliateProduct = product.id;
        buyButton.hidden = false;

        const buyLabel = buyButton.querySelector("[data-buy-label]");

        if (buyLabel) {
          buyLabel.textContent = product.affiliate_platform
            ? `Buy on ${formatLabel(product.affiliate_platform)}`
            : "Buy This Product";
        }

      } else {
        // Hide button until a real affiliate link exists.
        buyButton.hidden = true;
        buyButton.removeAttribute("href");
      }
    }

    if (loadingState) {
      loadingState.hidden = true;
    }

    if (notFound) {
      notFound.hidden = true;
    }

    if (detail) {
      detail.hidden = false;
    }
  }

  // ==========================================
  // SIMILAR PRODUCTS
  // ==========================================

  function calculateSimilarity(currentProduct, candidate) {
    const currentSkinTypes = getArray(
      currentProduct.skinTypes
    );

    const currentConcerns = getArray(
      currentProduct.concerns
    );

    const candidateSkinTypes = getArray(
      candidate.skinTypes
    );

    const candidateConcerns = getArray(
      candidate.concerns
    );

    const skinScore = candidateSkinTypes.filter(
      (type) => currentSkinTypes.includes(type)
    ).length;

    const concernScore = candidateConcerns.filter(
      (concern) => currentConcerns.includes(concern)
    ).length;

    return skinScore + concernScore * 2;
  }

  function renderSimilarProducts(currentProduct, products) {
    const container = document.getElementById(
      "similarProducts"
    );

    if (!container) return;

    container.replaceChildren();

    const related = products
      .filter(
        (product) =>
          String(product.id) !== String(currentProduct.id)
      )
      .map((product) => ({
        product,
        score: calculateSimilarity(currentProduct, product)
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (related.length === 0) {
      container.textContent =
        "No similar products available.";
      return;
    }

    related.forEach(({ product }) => {
      const card = document.createElement("a");

      card.className = "related-card";
      card.href =
        `product_detail.html?id=${encodeURIComponent(product.id)}`;

      // Product image
      const media = document.createElement("div");
      media.className = "related-image";

      const imageUrl = getSafeUrl(product.image);

      if (imageUrl) {
        const image = document.createElement("img");

        image.src = imageUrl;
        image.alt = product.name || "Product";
        image.loading = "lazy";

        image.style.width = "100%";
        image.style.height = "100%";
        image.style.objectFit = "contain";

        image.onerror = () => {
          media.replaceChildren();
          media.textContent = product.icon || "🧴";
        };

        media.appendChild(image);

      } else {
        media.textContent = product.icon || "🧴";
      }

      if (
        typeof product.color === "string" &&
        /^#[0-9a-fA-F]{6}$/.test(product.color)
      ) {
        media.style.backgroundColor = product.color;
      }

      // Product information
      const info = document.createElement("div");
      info.className = "related-info";

      const brand = document.createElement("small");
      brand.textContent = product.brand || "";

      const name = document.createElement("h3");
      name.textContent = product.name || "Product";

      const price = document.createElement("p");
      price.textContent = formatPrice(product.price);

      info.append(brand, name, price);

      card.append(media, info);
      container.appendChild(card);
    });
  }

  // ==========================================
  // INITIALIZE PAGE
  // ==========================================

  if (!productId || !/^\d+$/.test(productId)) {
    showError("Product not found.");
    return;
  }

  try {
    // Load selected product
    const product = await fetchProduct(productId);

    if (!product) {
      showError("Product not found.");
      return;
    }

    // Display product details immediately
    renderProduct(product);

    // Load similar products separately
    // If this fails, product detail still remains visible.
    try {
      const allProducts = await fetchAllProducts();

      renderSimilarProducts(product, allProducts);

    } catch (relatedError) {
      console.error(
        "Failed to load similar products:",
        relatedError
      );

      const relatedContainer = document.getElementById(
        "similarProducts"
      );

      if (relatedContainer) {
        relatedContainer.textContent =
          "Similar products are unavailable.";
      }
    }

  } catch (error) {
    console.error(
      "Failed to load product detail:",
      error
    );

    showError(
      "Could not load products. Please try again."
    );
  }
});
