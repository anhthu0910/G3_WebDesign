"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const button = document.getElementById("loginButton");
  const message = document.getElementById("authMessage");
  const role = form.dataset.loginRole;
  document.getElementById("showPassword").addEventListener("change", event => { document.getElementById("password").type = event.target.checked ? "text" : "password"; });
  form.addEventListener("submit", async event => {
    event.preventDefault(); button.disabled = true; message.textContent = "Signing in...";
    try {
      const data = await authRequest("/api/auth/login", { method: "POST", body: JSON.stringify({ identifier: document.getElementById("identifier").value.trim(), password: document.getElementById("password").value, role }) });
      window.location.href = data.user?.role === "admin" ? "/frontend/html/admin_index.html" : "/frontend/html/index.html";
    }
    catch (error) { message.textContent = error.message; button.disabled = false; }
  });
});
