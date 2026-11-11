"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const button = form.querySelector("#loginButton");
  const message = document.getElementById("authMessage");
  const role = form.dataset.loginRole;
  const identifier = form.querySelector("#identifier");
  const password = form.querySelector("#password");
  const showPassword = form.querySelector("#showPassword");

  if (showPassword && password) {
    showPassword.addEventListener("change", () => {
      password.type = showPassword.checked ? "text" : "password";
    });
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!button || !message || !identifier || !password) {
      console.error("Login form is missing a required element.");
      if (message) message.textContent = "Login form is incomplete. Please refresh and try again.";
      return;
    }

    button.disabled = true;
    message.textContent = "Signing in...";
    try {
      const data = await authRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier: identifier.value.trim(), password: password.value, role })
      });
      window.location.href = data.user?.role === "admin" ? "/frontend/html/admin_index.html" : "/frontend/html/index.html";
    }
    catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  });
});
