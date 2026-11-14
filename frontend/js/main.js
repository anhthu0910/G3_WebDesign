
function getPurchaseUrl(product) {
  for (const field of ["affiliate_url", "product_url"]) {
    if (typeof product[field] !== "string" || !product[field].trim()) continue;
    try {
      const url = new URL(product[field]);
      if (!["http:", "https:"].includes(url.protocol)) continue;
      return { href: url.href, affiliate: field === "affiliate_url" };
    } catch { /* Try the next purchase URL. */ }
  }
  return null;
}

function createPurchaseLink(product, className) {
  const link = document.createElement("a");
  link.className = className;
  // Shopee logo
  const shopeeLogo = document.createElement("img");
  shopeeLogo.src = "../images/shopee-logo.png";
  shopeeLogo.alt = "";
  shopeeLogo.className = "home-buy-logo";
  shopeeLogo.setAttribute("aria-hidden", "true");

  // Button text
  const buyText = document.createElement("span");
  buyText.textContent = "Buy Now";
  link.append(shopeeLogo, buyText);

  const purchase = getPurchaseUrl(product);
  if (purchase) {
    link.href = purchase.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    if (purchase.affiliate) {
      link.rel += " sponsored nofollow";
      link.dataset.affiliateProduct = product.id;
    }
    return link;
  }

  link.setAttribute("aria-disabled", "true");
  link.title = "Purchase link unavailable";
  return link;
}

document.addEventListener("DOMContentLoaded", () => {
  const navbar = document.querySelector(".navbar");
  const nav = navbar?.querySelector("nav");

  if (navbar && nav) {
    const toggle = document.createElement("button");

    toggle.type = "button";
    toggle.className = "nav-menu-toggle";
    toggle.textContent = "☰";
    toggle.setAttribute("aria-label", "Toggle navigation");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", "mainNavigation");

    nav.id = "mainNavigation";
    navbar.insertBefore(toggle, navbar.firstElementChild);

    toggle.addEventListener("click", () => {
      const isOpen = nav.classList.toggle("nav-open");

      toggle.textContent = isOpen ? "✕" : "☰";
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.addEventListener("click", event => {
      if (event.target.closest("a")) {
        nav.classList.remove("nav-open");
        toggle.textContent = "☰";
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("click", event => {
      if (!navbar.contains(event.target)) {
        nav.classList.remove("nav-open");
        toggle.textContent = "☰";
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }
  const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll("nav a").forEach(link => {
    const linkPage = link.getAttribute("href");

    if (linkPage === currentPage) {
      link.style.color = "#d98e9e";
      link.style.fontWeight = "700";
    }
  });
});

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.querySelector(".featured-products .product-list");
  if (!container) return;
  
  // Add Shopee logo to static HTML buttons (API fallback)
  container.querySelectorAll(".home-buy-link").forEach(link => {
    // Avoid adding the logo more than once
    if (link.querySelector(".home-buy-logo")) return;

    const logo = document.createElement("img");
    logo.src = "../images/shopee-logo.png";
    logo.alt = "";
    logo.className = "home-buy-logo";
    logo.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.textContent = "Buy Now";

    link.replaceChildren(logo, text);
  });


  function updateHomeCartButtons() {
    const ids = new Set(getCart().map(item => String(item.id)));
    container.querySelectorAll(".home-cart-btn[data-product-id]").forEach(button => {
      const isAdded = ids.has(button.dataset.productId);
      button.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 3h3l3 12h11l3-9H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>`;
      button.setAttribute("aria-label", isAdded ? "Remove from cart" : "Add to cart");
      button.title = isAdded ? "Remove from cart" : "Add to cart";
      button.setAttribute("aria-pressed", String(isAdded));
      button.classList.toggle("added", isAdded);
      button.setAttribute("aria-pressed", String(isAdded));
    });
  }

  container.addEventListener("click", event => {
    const button = event.target.closest(".home-cart-btn[data-product-id]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const id = button.dataset.productId;
    if (getCart().some(item => String(item.id) === id)) removeFromCart(id);
    else addToCart(id);
    updateHomeCartButtons();
  });
  window.addEventListener("glowguide:cartchanged", updateHomeCartButtons);
  updateHomeCartButtons();

  try {
    const response = await fetch("/api/products");
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json();
    const products = Array.isArray(data) ? data : data.products;
    if (!Array.isArray(products)) throw new Error("Invalid product data");

    container.replaceChildren();
    products.slice(0, 3).forEach(product => {
      const card = document.createElement("article");
      card.className = "product-card";
      const media = document.createElement("div");
      media.className = "product-image";
      if (product.image) {
        const img = document.createElement("img");
        img.src = product.image;
        img.alt = product.name || "Skincare product";
        img.loading = "lazy";
        img.onerror = () => media.textContent = product.icon || "🧴";
        media.appendChild(img);
      } else media.textContent = product.icon || "🧴";
      const brand = document.createElement("p");
      brand.className = "product-brand";
      brand.textContent = product.brand || "";
      const name = document.createElement("h3");
      name.textContent = product.name || "";
      const link = document.createElement("a");
      link.href = `product_detail.html?id=${encodeURIComponent(product.id)}`;
      link.textContent = "View";
      const buyLink = createPurchaseLink(product, "home-buy-link");
      const cartButton = document.createElement("button");
      cartButton.type = "button";
      cartButton.className = "home-cart-btn";

      cartButton.dataset.productId = product.id;
      const actions = document.createElement("div");
      actions.className = "home-purchase-actions";
      actions.append(buyLink, cartButton);
      card.append(media, brand, name, link, actions);
      container.appendChild(card);
    });
    updateHomeCartButtons();
  } catch (error) {
    console.error("Featured products error:", error);
  }
});


document.addEventListener("DOMContentLoaded", () => {
  const homeSearchForm = document.getElementById("homeSearchForm");
  const homeSearchInput = document.getElementById("homeSearchInput");
  const homeSearchButton = document.getElementById("homeSearchButton");
  const homeSearchSuggestions = document.getElementById("homeSearchSuggestions");

  if (homeSearchForm && homeSearchInput && homeSearchButton && homeSearchSuggestions) {
    let productCatalogPromise;
    let suggestionRequestId = 0;

    window.addEventListener("pageshow", () => {
      homeSearchButton.disabled = false;
      homeSearchButton.removeAttribute("aria-busy");
    });

    function loadProducts() {
      if (!productCatalogPromise) {
        productCatalogPromise = (async () => {
          const response = await fetch("/api/products");
          if (!response.ok) {
            throw new Error(`${response.status} ${response.statusText}`);
          }

          const catalog = await response.json();
          const products = Array.isArray(catalog) ? catalog : catalog.products;
          if (!Array.isArray(products)) {
            throw new Error("Invalid product data");
          }

          return products;
        })().catch(error => {
          productCatalogPromise = null;
          throw error;
        });
      }

      return productCatalogPromise;
    }

    function getProductMatchScore(product, keyword) {
      const name = String(product.name || "").toLowerCase();
      const brand = String(product.brand || "").toLowerCase();
      const category = String(product.category || "").toLowerCase();
      const ingredients = Array.isArray(product.ingredients)
        ? product.ingredients.join(" ").toLowerCase()
        : String(product.ingredients || "").toLowerCase();
      const description = String(product.description || "").toLowerCase();

      if (name === keyword) return 100;
      if (name.startsWith(keyword)) return 90;
      if (brand === keyword) return 80;
      if (brand.startsWith(keyword)) return 70;
      if (name.includes(keyword)) return 60;
      if (brand.includes(keyword)) return 50;
      if (category.includes(keyword)) return 40;
      if (ingredients.includes(keyword)) return 30;
      if (description.includes(keyword)) return 20;
      return 0;
    }

    function closeSuggestions() {
      suggestionRequestId += 1;
      homeSearchSuggestions.hidden = true;
      homeSearchInput.setAttribute("aria-expanded", "false");
    }

    async function updateSuggestions(term) {
      const requestId = ++suggestionRequestId;
      if (!term) {
        closeSuggestions();
        return;
      }

      homeSearchSuggestions.replaceChildren();
      homeSearchSuggestions.hidden = false;
      homeSearchInput.setAttribute("aria-expanded", "true");
      const loading = document.createElement("p");
      loading.className = "search-suggestions-message";
      loading.textContent = "Loading suggestions...";
      homeSearchSuggestions.appendChild(loading);

      try {
        const products = await loadProducts();
        if (requestId !== suggestionRequestId) return;

        const matches = products
          .map(product => ({
            product,
            score: getProductMatchScore(product, term.toLowerCase())
          }))
          .filter(match => match.score > 0 && match.product.id != null)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        homeSearchSuggestions.replaceChildren();
        if (!matches.length) {
          const emptyMessage = document.createElement("p");
          emptyMessage.className = "search-suggestions-message";
          emptyMessage.textContent = "No matching products found.";
          homeSearchSuggestions.appendChild(emptyMessage);
          return;
        }

        matches.forEach(({ product }) => {
          const suggestion = document.createElement("a");
          suggestion.className = "search-suggestion";
          suggestion.role = "option";
          suggestion.href =
            `product_detail.html?id=${encodeURIComponent(product.id)}`;

          const name = document.createElement("span");
          name.className = "search-suggestion-name";
          name.textContent = product.name || "Skincare product";

          const detail = document.createElement("span");
          detail.className = "search-suggestion-detail";
          detail.textContent = [product.brand, product.category]
            .filter(Boolean)
            .join(" · ");

          suggestion.append(name, detail);
          homeSearchSuggestions.appendChild(suggestion);
        });
      } catch (error) {
        if (requestId !== suggestionRequestId) return;
        console.error("Could not load product suggestions:", error);
        homeSearchSuggestions.replaceChildren();
        const errorMessage = document.createElement("p");
        errorMessage.className = "search-suggestions-message";
        errorMessage.textContent = "Could not load suggestions. Please try again.";
        homeSearchSuggestions.appendChild(errorMessage);
      }
    }

    homeSearchInput.addEventListener("input", () => {
      homeSearchInput.setCustomValidity("");
      updateSuggestions(homeSearchInput.value.trim());
    });

    homeSearchInput.addEventListener("keydown", event => {
      if (event.key === "Escape") closeSuggestions();
    });

    document.addEventListener("click", event => {
      if (!homeSearchForm.contains(event.target)) closeSuggestions();
    });

    homeSearchForm.addEventListener("submit", async event => {
      event.preventDefault();
      const term = homeSearchInput.value.trim();
      if (!term) {
        homeSearchInput.setCustomValidity("Please enter a product, brand, or ingredient.");
        homeSearchInput.reportValidity();
        return;
      }

      homeSearchInput.setCustomValidity("");
      if (homeSearchButton.disabled) return;
      homeSearchButton.disabled = true;
      homeSearchButton.setAttribute("aria-busy", "true");
      closeSuggestions();

      try {
        const products = await loadProducts();
        const matches = products
          .map(product => ({
            product,
            score: getProductMatchScore(product, term.toLowerCase())
          }))
          .filter(match => match.score > 0 && match.product.id != null)
          .sort((a, b) => b.score - a.score);

        if (matches.length) {
          const destination = new URL("product_detail.html", window.location.href);
          destination.searchParams.set("id", matches[0].product.id);
          window.location.href = destination.toString();
          return;
        }

        const destination = new URL("products.html", window.location.href);
        destination.searchParams.set("q", term);
        window.location.href = destination.toString();
      } catch (error) {
        console.error("Could not search products:", error);
        alert("Could not search products right now. Please try again.");
        homeSearchButton.disabled = false;
        homeSearchButton.removeAttribute("aria-busy");
      }
    });
  }

  const skinButtons = document.querySelectorAll("[data-skin]");
  const concernButtons = document.querySelectorAll("[data-concern]");
  let selectedSkin = "";
  let selectedConcern = "";

  skinButtons.forEach(button => {
    button.addEventListener("click", () => {
      selectedSkin = button.dataset.skin;
      skinButtons.forEach(item => item.classList.toggle("selected", item === button));
    });
  });

  concernButtons.forEach(button => {
    button.addEventListener("click", () => {
      selectedConcern = button.dataset.concern;
      concernButtons.forEach(item => item.classList.toggle("selected", item === button));
    });
  });

  const findButton = document.getElementById("findMyProducts");
  if (findButton) {
    findButton.addEventListener("click", () => {
      const params = new URLSearchParams();
      if (selectedSkin) params.set("skin", selectedSkin);
      if (selectedConcern) params.set("concern", selectedConcern);

      const query = params.toString();
      window.location.href = `products.html${query ? `?${query}` : ""}`;
    });
  }
});
