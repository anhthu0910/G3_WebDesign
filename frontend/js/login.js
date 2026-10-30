"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const button = document.getElementById("loginButton");
  const message = document.getElementById("authMessage");
  const roleInput = document.getElementById("loginRole");
  document.querySelectorAll(".role-button").forEach(roleButton => roleButton.addEventListener("click", () => {
    document.querySelectorAll(".role-button").forEach(item => item.classList.toggle("active", item === roleButton));
    roleInput.value = roleButton.dataset.role;
    button.textContent = `Login as ${roleButton.dataset.role[0].toUpperCase()}${roleButton.dataset.role.slice(1)}`;
  }));
  document.getElementById("showPassword").addEventListener("change", event => { document.getElementById("password").type = event.target.checked ? "text" : "password"; });
  form.addEventListener("submit", async event => {
    event.preventDefault(); button.disabled = true; message.textContent = "Signing in...";
    try { const data = await authRequest("/api/auth/login", { method: "POST", body: JSON.stringify({ identifier: document.getElementById("identifier").value.trim(), password: document.getElementById("password").value, role: roleInput.value }) }); window.location.href = data.user?.role === "admin" ? "admin_index.html" : "index.html"; }
    catch (error) { message.textContent = error.message; button.disabled = false; }
  });
});
