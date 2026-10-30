"use strict";

// Use the same hostname as the frontend so localhost/127.0.0.1 cookies match.
const AUTH_API = "";

async function authRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(AUTH_API + path, {
    ...options,
    credentials: "include",
    headers: isFormData ? (options.headers || {}) : { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : `Request failed: ${response.status}`);
  return data;
}

async function getCurrentUser() {
  try { return (await authRequest("/api/auth/me")).user; } catch { return null; }
}

async function logoutUser() {
  await authRequest("/api/auth/logout", { method: "POST" });
  window.location.href = "index.html";
}

async function updateAccountNavigation() {
  const area = document.getElementById("accountArea");
  if (!area) return;
  const user = await getCurrentUser();
  area.replaceChildren();
  if (!user) {
    const link = document.createElement("a");
    link.href = "login.html";
    link.textContent = "Login / Sign Up";
    area.appendChild(link);
    return;
  }
  const welcome = document.createElement("span");
  welcome.textContent = `Hi, ${user.username}`;
  area.appendChild(welcome);
  if (user.role === "admin") {
    document.querySelectorAll("nav a").forEach(link => {
      if (link.textContent.trim() === "Home") {
        link.href = "admin_index.html";
        link.textContent = "Admin Home";
      }
    });
    document.querySelectorAll("a.logo[href='index.html']").forEach(link => {
      link.href = "admin_index.html";
    });
    document.querySelectorAll('a[href="ai_consultant.html"]').forEach(link => link.remove());
    document.querySelectorAll('a[href="cart.html"]').forEach(link => link.remove());
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
