
document.addEventListener("DOMContentLoaded", () => {
  console.log("GlowGuide website initialized!");

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

  try {
    const urls = ["/api/products"];
    let data;
    for (const url of urls) {
      const response = await fetch(url);
      if (response.ok) {
        data = await response.json();
        break;
      }
    }
    if (!data) throw new Error("Cannot load products.json");
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
      const aiLink = document.createElement("a");
      aiLink.href = `ai_consultant.html?product=${encodeURIComponent(product.id)}`;
      aiLink.className = "home-ai-link";
      aiLink.textContent = "Ask AI";
      const cartButton = document.createElement("button");
      cartButton.type = "button";
      cartButton.className = "home-cart-btn";

      function updateHomeCartButton() {
        const isAdded = getCart().some(
          item => String(item.id) === String(product.id)
        );
        cartButton.textContent = isAdded ? "Added to Cart" : "Add to Cart";
        cartButton.classList.toggle("added", isAdded);
        cartButton.setAttribute("aria-pressed", String(isAdded));
      }

      cartButton.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        const isAdded = getCart().some(
          item => String(item.id) === String(product.id)
        );
        if (isAdded) removeFromCart(product.id);
        else addToCart(product.id);
        updateHomeCartButton();
      });

      window.addEventListener("glowguide:cartchanged", updateHomeCartButton);
      updateHomeCartButton();
      card.append(media, brand, name, link, aiLink, cartButton);
      container.appendChild(card);
    });
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

document.addEventListener("DOMContentLoaded", () => {
  const cartButtons = document.querySelectorAll(
    ".featured-products .home-cart-btn[data-product-id]"
  );
  if (!cartButtons.length) return;

  const updateCartButtons = () => {
    cartButtons.forEach(button => {
      const isAdded = getCart().some(
        item => String(item.id) === button.dataset.productId
      );
      button.textContent = isAdded ? "Added to Cart" : "Add to Cart";
      button.classList.toggle("added", isAdded);
      button.setAttribute("aria-pressed", String(isAdded));
    });
  };

  cartButtons.forEach(button => {
    button.addEventListener("click", () => {
      const id = button.dataset.productId;
      const isAdded = getCart().some(item => String(item.id) === id);
      if (isAdded) removeFromCart(id);
      else addToCart(id);
      updateCartButtons();
    });
  });

  window.addEventListener("glowguide:cartchanged", updateCartButtons);
  updateCartButtons();
});
