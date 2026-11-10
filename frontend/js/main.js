
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
