
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
  link.textContent = "Buy Now";
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

  function updateHomeCartButtons() {
    const ids = new Set(getCart().map(item => String(item.id)));
    container.querySelectorAll(".home-cart-btn[data-product-id]").forEach(button => {
      const isAdded = ids.has(button.dataset.productId);
      button.textContent = isAdded ? "Added to Cart" : "Add to Cart";
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
      link.textContent = "View Analysis";
      const buyLink = createPurchaseLink(product, "home-buy-link");
      const cartButton = document.createElement("button");
      cartButton.type = "button";
      cartButton.className = "home-cart-btn";

      cartButton.dataset.productId = product.id;
      card.append(media, brand, name, link, buyLink, cartButton);
      container.appendChild(card);
    });
    updateHomeCartButtons();
  } catch (error) {
    console.error("Featured products error:", error);
  }
});


document.addEventListener("DOMContentLoaded", () => {
  const homeSearchInput = document.getElementById("homeSearchInput");
  const homeSearchButton = document.getElementById("homeSearchButton");

  if (homeSearchInput && homeSearchButton) {
    window.addEventListener("pageshow", () => {
      homeSearchButton.disabled = false;
      homeSearchButton.textContent = "Search";
    });

    const handleHomeSearch = async () => {
      const term = homeSearchInput.value.trim();

      if (!term) {
        window.location.href = "products.html";
        return;
      }

      if (homeSearchButton.disabled) return;
      homeSearchButton.disabled = true;
      homeSearchButton.textContent = "Searching...";

      try {
        const response = await fetch("/api/products");
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }

        const catalog = await response.json();
        const products = Array.isArray(catalog) ? catalog : catalog.products;
        if (!Array.isArray(products)) {
          throw new Error("Invalid product data");
        }

        const keyword = term.toLowerCase();
        const matches = products
          .map(product => {
            const name = String(product.name || "").toLowerCase();
            const brand = String(product.brand || "").toLowerCase();
            const category = String(product.category || "").toLowerCase();
            const ingredients = Array.isArray(product.ingredients)
              ? product.ingredients.join(" ").toLowerCase()
              : String(product.ingredients || "").toLowerCase();
            const description = String(product.description || "").toLowerCase();
            let score = 0;

            if (name === keyword) score = 100;
            else if (name.startsWith(keyword)) score = 90;
            else if (brand === keyword) score = 80;
            else if (brand.startsWith(keyword)) score = 70;
            else if (name.includes(keyword)) score = 60;
            else if (brand.includes(keyword)) score = 50;
            else if (category.includes(keyword)) score = 40;
            else if (ingredients.includes(keyword)) score = 30;
            else if (description.includes(keyword)) score = 20;

            return { product, score };
          })
          .filter(match => match.score > 0)
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
        alert("Không thể tìm sản phẩm lúc này. Vui lòng thử lại.");
        homeSearchButton.disabled = false;
        homeSearchButton.textContent = "Search";
      }
    };

    homeSearchButton.addEventListener("click", handleHomeSearch);
    homeSearchInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleHomeSearch();
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
