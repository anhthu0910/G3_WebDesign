"use strict";

// Serve the frontend through FastAPI so session cookies and APIs share an origin.
const AUTH_API = "";

async function authRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  let response;
  try { response = await fetch(AUTH_API + path, {
    ...options,
    credentials: "include",
    headers: isFormData ? (options.headers || {}) : { "Content-Type": "application/json", ...(options.headers || {}) }
  }); } catch {
    throw new Error("Could not connect. Please try again.");
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 404) {
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    const guidance = local
      ? "Please open http://127.0.0.1:8000/ to continue."
      : "This feature is unavailable. Please try again later.";
    throw new Error(guidance);
  }
  if (!response.ok) {
    if (path === "/api/auth/login" && response.status === 403 && data.detail === "account_locked") {
      throw new Error("Your account has been locked. Please contact an administrator.");
    }
    const messages = {
      400: "Please check your information.",
      401: path === "/api/auth/login" ? "Incorrect username or password." : "Please sign in to continue.",
      403: "You do not have permission to do this.",
      409: "Username or email is already in use.",
      413: "Please choose an image under 5 MB.",
      422: "Please check your information.",
      429: "Too many attempts. Please try again later."
    };
    const message = response.status === 400 && path.endsWith("/image")
      ? "Please choose a JPG, PNG or WEBP image."
      : messages[response.status] || "Something went wrong. Please try again later.";
    throw new Error(message);
  }
  return data;
}

async function getCurrentUser() {
  try { return (await authRequest("/api/auth/me")).user; } catch { return null; }
}

async function logoutUser() {
  await authRequest("/api/auth/logout", { method: "POST" });
  window.location.href = "/frontend/html/index.html";
}

async function updateAccountNavigation() {
  const area = document.getElementById("accountArea");
  const user = await getCurrentUser();
  if (!user) {
    document.querySelectorAll('a[href$="cart.html"]').forEach(link => link.remove());
  }
  if (!area) return;
  const pageBase = ["/login", "/admin/login"].includes(window.location.pathname) ? "/frontend/html/" : "";
  area.replaceChildren();
  if (!user) {
    const link = document.createElement("a");
    const adminPage = /\/admin_(index|users)\.html$/.test(window.location.pathname);
    link.href = adminPage ? "/admin/login" : "/login";
    link.textContent = adminPage ? "Admin Login" : "Login / Sign Up";
    area.appendChild(link);
    return;
  }
  const welcome = document.createElement("span");
  welcome.textContent = `Hi, ${user.username}`;
  area.appendChild(welcome);
  if (user.role === "user") {
    const link = document.createElement("a");
    link.href = `${pageBase}profile.html`;
    link.textContent = "My Profile";
    area.appendChild(link);
  }
  if (user.role === "admin") {
    const nav = document.querySelector(".navbar nav");
    if (nav && !nav.querySelector('a[href$="admin_users.html"]')) {
      const users = document.createElement("a");
      users.href = `${pageBase}admin_users.html`;users.textContent = "Users";
      nav.insertBefore(users, area);
    }
    document.querySelectorAll("nav a").forEach(link => {
      if (link.textContent.trim() === "Home") {
        link.href = `${pageBase}admin_index.html`;
        link.textContent = "Admin Home";
      }
    });
    document.querySelectorAll("a.logo[href$='index.html']").forEach(link => {
      link.href = `${pageBase}admin_index.html`;
    });
    document.querySelectorAll('a[href$="ai_consultant.html"]').forEach(link => link.remove());
    document.querySelectorAll('a[href$="cart.html"]').forEach(link => link.remove());
    if (window.location.pathname.endsWith("/ai_consultant.html")) {
      window.location.replace("products.html");
      return;
    }
  }
  const logout = document.createElement("button");
  logout.type = "button";
  logout.className = "account-logout";
  logout.textContent = "Logout";
  logout.addEventListener("click", () => logoutUser().catch(error => alert(error.message)));
  area.appendChild(logout);
}

document.addEventListener("DOMContentLoaded", updateAccountNavigation);

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".guest-link").forEach(link => link.addEventListener("click", async event => {
    event.preventDefault();
    try {
      await authRequest("/api/auth/logout", { method: "POST" });
      window.location.href = link.href;
    } catch (error) { document.getElementById("authMessage").textContent = error.message; }
  }));
});

function trackAffiliateClick(event) {
  const link = event.target.closest("a[data-affiliate-product]");
  if (!link || (event.type === "auxclick" && event.button !== 1)) return;
  fetch(`/api/products/${encodeURIComponent(link.dataset.affiliateProduct)}/affiliate-click`, {
    method: "POST", credentials: "include", keepalive: true
  }).catch(error => console.warn("Could not record affiliate click", error));
}
document.addEventListener("click", trackAffiliateClick);
document.addEventListener("auxclick", trackAffiliateClick);
