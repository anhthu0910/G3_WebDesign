"use strict";
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("registerForm").addEventListener("submit", async event => {
    event.preventDefault();
    const message = document.getElementById("authMessage");
    const button = document.getElementById("registerButton");
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    if (password !== confirmPassword) { message.textContent = "Passwords do not match."; return; }
    button.disabled = true;
    try {
      await authRequest("/api/auth/register", { method: "POST", body: JSON.stringify({ username: document.getElementById("username").value.trim(), email: document.getElementById("email").value.trim(), password }) });
      window.location.href = "login.html";
    } catch (error) { message.textContent = error.message; button.disabled = false; }
  });
});
