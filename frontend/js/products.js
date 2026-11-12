
document.addEventListener("DOMContentLoaded", async () => {
  let products = [];
  let alertFilter = "";
  let cartButtonUpdates = [];
  window.addEventListener("glowguide:cartchanged", () => {
    cartButtonUpdates.forEach(update => update());
  });
  const productGrid = document.getElementById("productGrid");
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");
  const resultCount = document.getElementById("resultCount");
  const emptyState = document.getElementById("emptyState");
  const params = new URLSearchParams(window.location.search);
  const requestedQuery = params.get("q");
  const requestedAlert = params.get("issue");
  const supportedAlerts = new Set([
    "missing_image",
    "missing_price",
    "missing_purchase_link",
    "missing_description",
    "missing_ingredients"
  ]);
  const user = typeof getCurrentUser === "function" ? await getCurrentUser() : null;
  const isAdmin = user?.role === "admin";

  try {
    if (isAdmin) {
      document.body.classList.add("admin-product-mode");
      alertFilter = supportedAlerts.has(requestedAlert) ? requestedAlert : "";
      const query = alertFilter ? `?issue=${encodeURIComponent(alertFilter)}` : "";
      products = (await authRequest(`/api/admin/products${query}`)).products;
    } else {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const catalog = await response.json();
      products = Array.isArray(catalog) ? catalog : catalog.products;
      if (!Array.isArray(products)) throw new Error("Invalid catalog format");
    }
  } catch (error) {
    console.error("Could not load products:", error);
    emptyState.hidden = false;
    resultCount.textContent = "Could not load products. Please try again.";
    return;
  }

  const skinCheckboxes = document.querySelectorAll(
    'input[name="skinType"]'
  );

  const concernCheckboxes = document.querySelectorAll(
    'input[name="concern"]'
  );

  function formatPrice(price) {
    if (price == null) return "Price unavailable";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND"
    }).format(price);
  }

  function createProductCard(product) {
    const card = document.createElement("article");
    card.className = "product-card";
    card.dataset.productId = product.id;

    const image = document.createElement("div");
    image.className = "product-image";

    if (/^#[0-9a-fA-F]{6}$/.test(product.color)) {
      image.style.backgroundColor = product.color;
    }

    const badge = document.createElement("span");
    badge.className = "demo-badge";
    badge.textContent = "DEMO PRODUCT";

    image.appendChild(badge);

    if (product.image) {
      const img = document.createElement("img");
      img.src = product.image;
      img.alt = product.name || "Skincare product";
      img.loading = "lazy";
      img.onerror = () => {
        image.replaceChildren(badge, createFallbackIcon(product));
      };
      image.appendChild(img);
    } else {
      image.appendChild(createFallbackIcon(product));
    }

    const info = document.createElement("div");
    info.className = "product-info";

    const brand = document.createElement("p");
    brand.className = "product-brand";
    brand.textContent = product.brand;

    const name = document.createElement("h3");
    name.textContent = product.name;

    const category = document.createElement("p");
    category.className = "product-category";
    category.textContent = product.category;

    const price = document.createElement("p");
    price.className = "product-price";
    price.textContent = formatPrice(product.price);

    const buttons = document.createElement("div");
    buttons.className = "product-buttons";

    const detailLink = document.createElement("a");
    detailLink.className = "details-btn";
    detailLink.href =
      `product_detail.html?id=${encodeURIComponent(product.id)}`;
    detailLink.textContent = "View Details";

    const buyLink = createPurchaseLink(product, "buy-btn");
    buttons.append(detailLink, buyLink);
    info.append(brand, name, category, price, buttons);
    card.append(image, info);

    const cartButton = document.createElement("button");
    cartButton.type = "button";
    cartButton.className = "product-cart-btn";

    function updateCartButtonState() {
      const isAdded = getCart().some(
        item => String(item.id) === String(product.id)
      );
      cartButton.textContent = isAdded
        ? "Added to Cart"
        : "Add to Cart";
      cartButton.classList.toggle("added", isAdded);
    }

    cartButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isAdded = getCart().some(
        item => String(item.id) === String(product.id)
      );
      if (isAdded) removeFromCart(product.id);
      else addToCart(product.id);
      updateCartButtonState();
    });

    cartButtonUpdates.push(updateCartButtonState);
    updateCartButtonState();
    card.appendChild(cartButton);

    if (isAdmin) {
      const adminActions = document.createElement("div");
      adminActions.className = "admin-product-actions";
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Edit";
      editButton.addEventListener("click", () => editProduct(product));
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", () => deleteProduct(product));
      adminActions.append(editButton, deleteButton);
      card.appendChild(adminActions);
    }

    return card;
  }

  async function adminRequest(path, options = {}) {
    return authRequest(`/api/admin${path}`, options);
  }

  async function editProduct(product) {
    const modal = document.createElement("div");
    modal.className = "product-editor-overlay";
    modal.innerHTML = `<form class="product-editor"><h2>Edit Product</h2>
      <label>
        <span>Name <span class="required-asterisk">*</span></span>
        <input name="name" required maxlength="200">
      </label>
      <label>Brand<input name="brand"></label>
      <label>
        <span> Category <span class="required-asterisk">*</span></span>
        <input name="category" required>
      </label>
      <label>Price<input name="price" type="number" min="0"></label>
      <label>Description<textarea name="description"></textarea></label>
      <label>Ingredients <small>comma separated</small><textarea name="ingredients"></textarea></label>
      <label>Benefits <small>comma separated</small><textarea name="benefits"></textarea></label>
      <label>
        <span> Skin types <span class="required-asterisk">*</span></span>
        <small>comma separated</small>
        <input name="skinTypes" required>
      </label>
      <label>
        <span> Concerns <span class="required-asterisk">*</span></span>
        <small>comma separated</small>
        <input name="concerns" required>
      </label>
      <label>Usage<textarea name="usage"></textarea></label>
      <label>Cautions<textarea name="cautions"></textarea></label>
      <label>Product URL<input name="product_url"></label>
      <label>
        <span> Affiliate URL <span class="required-asterisk">*</span></span>
        <input name="affiliate_url" type="url" required>
      </label>
      <div class="product-editor-image-field">
        <label>Replace image</label>

        <div class="admin-create-image-options">
          <label class="admin-create-image-url">
            <input name="image" type="url" placeholder="Paste image URL">
          </label>

          <span class="admin-create-image-or">or</span>

          <label class="admin-create-image-upload">
            <input name="imageFile" type="file"
              accept="image/jpeg,image/png,image/webp">
          </label>
        </div>

        <img class="product-editor-preview"
          data-image-preview alt="Image preview">
      </div>
      <div class="product-editor-actions"><button type="submit">Save changes</button><button type="button" data-close>Cancel</button></div></form>`;
    document.body.appendChild(modal);
    const form = modal.querySelector("form");
    const values = { ...product, ingredients: (product.ingredients || []).join(", "), benefits: (product.benefits || []).join(", "), skinTypes: (product.skinTypes || []).join(", "), concerns: (product.concerns || []).join(", ") };
    Object.entries(values).forEach(([key, value]) => { if (form.elements[key]) form.elements[key].value = value ?? ""; });
    const imageAddress = form.elements.image;
    const imageFile = form.elements.imageFile;
    const preview = form.querySelector("[data-image-preview]");

    let previewObjectUrl = "";

    const setPreview = (source, isObjectUrl = false) => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }

      previewObjectUrl = isObjectUrl ? source : "";

      if (source) {
        preview.src = source;
        preview.hidden = false;
      } else {
        preview.removeAttribute("src");
        preview.hidden = true;
      }
    };

    // Display current product image
    imageAddress.value = product.image || "";
    setPreview(product.image || "");

    // When URL is entered, clear selected file
    imageAddress.addEventListener("input", () => {
      if (imageAddress.value.trim()) {
        imageFile.value = "";
      }

      setPreview(imageAddress.value.trim());
    });

    // When file is selected, clear URL
    imageFile.addEventListener("change", () => {
      const file = imageFile.files[0];

      if (file) {
        imageAddress.value = "";
        setPreview(URL.createObjectURL(file), true);
      }
    });
    modal.querySelector("[data-close]").onclick = () => modal.remove();
    form.onsubmit = async event => { event.preventDefault(); const data = new FormData(form); const updated = { ...product, ...Object.fromEntries(data.entries()), price: Number(data.get("price")) || null, ingredients: data.get("ingredients").split(",").map(x => x.trim()).filter(Boolean), benefits: data.get("benefits").split(",").map(x => x.trim()).filter(Boolean), skinTypes: data.get("skinTypes").split(",").map(x => x.trim()).filter(Boolean), concerns: data.get("concerns").split(",").map(x => x.trim()).filter(Boolean), visible: product.visible !== false }; delete updated.id; delete updated.currency; delete updated.imageFile; try { await adminRequest(`/products/${product.id}`, { method: "PUT", body: JSON.stringify(updated) }); if (imageFile.files[0]) { const upload = new FormData(); upload.append("file", imageFile.files[0]); const result = await adminRequest(`/products/${product.id}/image`, { method: "POST", body: upload, headers: {} }); updated.image = result.image; } modal.remove(); Object.assign(product, updated); filterProducts(); } catch (error) { alert(error.message); } };
  }

  async function deleteProduct(product) {
    if (!confirm(`Delete ${product.name}?`)) return;
    try {
      await adminRequest(`/products/${product.id}`, { method: "DELETE" });
      products = products.filter(item => String(item.id) !== String(product.id));
      filterProducts();
    } catch (error) { alert(error.message); }
  }

  function createFallbackIcon(product) {
    const emoji = document.createElement("span");
    emoji.className = "product-emoji";
    emoji.textContent = product.icon || "🧴";
    return emoji;
  }

  function renderProducts(productList) {
    cartButtonUpdates = [];
    productGrid.replaceChildren();

    productList.forEach(product => {
      productGrid.appendChild(createProductCard(product));
    });

    const alertLabel = alertFilter
      ? ` missing ${alertFilter.replaceAll("_", " ")}`
      : "";
    resultCount.textContent =
      `Showing ${productList.length} of ${products.length} products${alertLabel}`;

    emptyState.hidden = productList.length > 0;
  }

  function getSelectedValues(checkboxes) {
    return Array.from(checkboxes)
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.value);
  }

  function filterProducts() {
    const keyword = searchInput.value.trim().toLowerCase();
    const skinTypes = getSelectedValues(skinCheckboxes);
    const concerns = getSelectedValues(concernCheckboxes);
    const sortBy = sortSelect.value;

    let filtered = products.filter(product => {
      const matchesSearch =
        String(product.name || "").toLowerCase().includes(keyword) ||
        String(product.brand || "").toLowerCase().includes(keyword) ||
        String(product.category || "").toLowerCase().includes(keyword);

      const matchesSkin =
        skinTypes.length === 0 ||
        skinTypes.some(type => (product.skinTypes || []).includes(type));

      const matchesConcern =
        concerns.length === 0 ||
        concerns.some(concern =>
          (product.concerns || []).includes(concern)
        );

      return matchesSearch && matchesSkin && matchesConcern;
    });

    if (sortBy === "price-asc") {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      filtered.sort((a, b) => b.price - a.price);
    } else if (sortBy === "name") {
      filtered.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    }

    renderProducts(filtered);
  }

  function resetFilters() {
    searchInput.value = "";
    sortSelect.value = "default";

    [...skinCheckboxes, ...concernCheckboxes].forEach(
      checkbox => checkbox.checked = false
    );
    filterProducts();
  }

  searchInput.addEventListener("input", filterProducts);
  sortSelect.addEventListener("change", filterProducts);

  [...skinCheckboxes, ...concernCheckboxes].forEach(
    checkbox => checkbox.addEventListener(
      "change",
      filterProducts
    )
  );

  document.getElementById("resetFilters")
    .addEventListener("click", resetFilters);

  document.getElementById("emptyReset")
    .addEventListener("click", resetFilters);

  const skin = params.get("skin");
  const concern = params.get("concern");

  if (requestedQuery && searchInput) {
    searchInput.value = requestedQuery;
  }

  const skinInput = Array.from(skinCheckboxes)
    .find(input => input.value === skin);
  if (skinInput) skinInput.checked = true;

  const concernInput = Array.from(concernCheckboxes)
    .find(input => input.value === concern);
  if (concernInput) concernInput.checked = true;

  if (isAdmin) setupAdminProductTools();
  filterProducts();

  function setupAdminProductTools() {
    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "admin-add-product-button";
    addButton.textContent = "Add Product";
    addButton.setAttribute("aria-expanded", "false");

    const status = document.createElement("p");
    status.className = "admin-create-product-status";
    status.setAttribute("aria-live", "polite");

    const form = document.createElement("form");
    form.className = "admin-create-product";
    form.hidden = true;
    form.innerHTML = `
      <h2>Add Product</h2>
      <div class="admin-create-product-grid">
        <label>Name<input name="name" required maxlength="200"></label>
        <label>Brand<input name="brand"></label>
        <label>Category<input name="category"></label>
        <label>Price (VND)<input name="price" type="number" min="0" step="1"></label>
        <label class="admin-create-full-width">Description<textarea name="description"></textarea></label>
        <label class="admin-create-full-width">Ingredients <small>Comma separated</small><textarea name="ingredients"></textarea></label>
        <label class="admin-create-full-width">Benefits <small>Comma separated</small><textarea name="benefits"></textarea></label>
        <label>Skin types <small>Comma separated</small><input name="skinTypes"></label>
        <label>Concerns <small>Comma separated</small><input name="concerns"></label>
        <label class="admin-create-full-width">Product URL<input name="product_url" type="url"></label>
        <label class="admin-create-full-width">Affiliate URL<input name="affiliate_url" type="url"></label>
        <label class="admin-create-full-width">Usage<textarea name="usage"></textarea></label>
        <label class="admin-create-full-width">Cautions<textarea name="cautions"></textarea></label>
        <div class="admin-create-full-width admin-create-image-field">
          <label>Product Image <small>Choose one method: paste a direct image URL or upload an image file.</small></label>
          <div class="admin-create-image-options">
            <label class="admin-create-image-url">
              <input name="image" type="url" placeholder="https://...">
            </label>

            <span class="admin-create-image-or">or</span>

            <label class="admin-create-image-upload">
              <input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp">
            </label>
          </div>
          <img class="product-editor-preview" data-image-preview alt="Product image preview" hidden>
        </div>
      </div>
      <p class="admin-create-product-message" aria-live="polite"></p>
      <div class="admin-create-product-actions">
        <button type="submit">Save Product</button>
        <button type="button" data-cancel>Cancel</button>
      </div>`;
    const productContent = document.querySelector(".product-content");
    productContent.prepend(form);
    productContent.prepend(addButton);
    addButton.after(status);

    const imageAddress = form.elements.image;
    const imageFileInput = form.elements.imageFile;
    const imagePreview = form.querySelector("[data-image-preview]");
    let previewObjectUrl = "";
    const setImagePreview = (source, isObjectUrl = false) => {
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = isObjectUrl ? source : "";
      imagePreview.hidden = !source;
      if (source) imagePreview.src = source;
      else imagePreview.removeAttribute("src");
    };
    imagePreview.addEventListener("error", () => {
      imagePreview.hidden = true;
    });
    imageAddress.addEventListener("input", () => {
      if (imageAddress.value.trim()) imageFileInput.value = "";
      setImagePreview(imageAddress.value.trim());
    });
    imageFileInput.addEventListener("change", () => {
      const file = imageFileInput.files[0];
      if (file) {
        imageAddress.value = "";
        setImagePreview(URL.createObjectURL(file), true);
      } else {
        setImagePreview("");
      }
    });

    addButton.addEventListener("click", () => {
      form.hidden = !form.hidden;
      addButton.setAttribute("aria-expanded", String(!form.hidden));
      if (!form.hidden) {
        status.textContent = "";
        form.querySelector(".admin-create-product-message").textContent = "";
        form.elements.name.focus();
      }
    });
    form.querySelector("[data-cancel]").addEventListener("click", () => {
      form.reset();
      setImagePreview("");
      form.hidden = true;
      addButton.setAttribute("aria-expanded", "false");
      status.textContent = "";
      form.querySelector(".admin-create-product-message").textContent = "";
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const saveButton = form.querySelector('[type="submit"]');
      const message = form.querySelector(".admin-create-product-message");
      const data = new FormData(form);
      const list = field => String(data.get(field) || "")
        .split(",").map(value => value.trim()).filter(Boolean);
      const priceValue = String(data.get("price") || "").trim();
      const product = {
        name: String(data.get("name")).trim(),
        brand: String(data.get("brand") || "").trim(),
        category: String(data.get("category") || "").trim(),
        price: priceValue ? Number(priceValue) : null,
        image: String(data.get("image") || "").trim(),
        description: String(data.get("description") || "").trim(),
        ingredients: list("ingredients"),
        benefits: list("benefits"),
        skinTypes: list("skinTypes"),
        concerns: list("concerns"),
        product_url: String(data.get("product_url") || "").trim(),
        affiliate_url: String(data.get("affiliate_url") || "").trim(),
        usage: String(data.get("usage") || "").trim(),
        cautions: String(data.get("cautions") || "").trim(),
        visible: true
      };
      const imageFile = data.get("imageFile");
      saveButton.disabled = true;
      message.textContent = "";
      let createdProduct;
      try {
        createdProduct = await authRequest("/api/admin/products", {
          method: "POST",
          body: JSON.stringify(product)
        });
      } catch (error) {
        message.textContent = error.message;
        saveButton.disabled = false;
        return;
      }

      let uploadError;
      if (imageFile.size > 0) {
        const upload = new FormData();
        upload.append("file", imageFile);
        try {
          await authRequest(`/api/admin/products/${createdProduct.id}/image`, {
            method: "POST",
            body: upload
          });
        } catch (error) {
          uploadError = error;
        }
      }

      form.reset();
      setImagePreview("");
      form.hidden = true;
      addButton.setAttribute("aria-expanded", "false");
      status.textContent = uploadError
        ? `Product saved, but image upload failed: ${uploadError.message}`
        : "Product saved.";
      try {
        const query = alertFilter ? `?issue=${encodeURIComponent(alertFilter)}` : "";
        products = (await authRequest(`/api/admin/products${query}`)).products;
        filterProducts();
      } catch (error) {
        status.textContent = uploadError
          ? `Product saved, but image upload failed: ${uploadError.message}. Please refresh the list.`
          : "Product saved. Please refresh the list.";
      }
      saveButton.disabled = false;
    });
  }
});
