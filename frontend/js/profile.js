"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("profileForm");
  const status = document.getElementById("profileStatus");
  const retry = document.getElementById("reloadProfile");
  const save = document.getElementById("saveProfile");
  function render(data) {
    document.getElementById("profileUsername").value = data.user.username;
    document.getElementById("profileEmail").value = data.user.email;
    document.getElementById("profileSkinType").value = data.skin_profile?.skinType || "";
    document.getElementById("profileConcern").value = data.skin_profile?.concern || "";
    form.hidden = false;
  }
  async function load() {
    retry.hidden = true;
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (response.status === 401) { window.location.replace("/login"); return; }
      if (!response.ok) throw new Error("Could not load your account. Please retry.");
      if ((await response.json()).user.role !== "user") { window.location.replace("admin_index.html"); return; }
      render(await authRequest("/api/user/profile"));
      status.textContent = "";
    } catch (error) { status.textContent = error.message; retry.hidden = false; }
  }
  retry.addEventListener("click", load);
  form.addEventListener("submit", async event => {
    event.preventDefault();save.disabled = true;
    try {
      render(await authRequest("/api/user/profile", { method: "PUT", body: JSON.stringify({
        username: document.getElementById("profileUsername").value.trim(),
        email: document.getElementById("profileEmail").value.trim(),
        skin_profile: { skinType: document.getElementById("profileSkinType").value || null, concern: document.getElementById("profileConcern").value.trim() }
      }) }));
      await updateAccountNavigation();status.textContent = "Profile saved.";
    } catch (error) { status.textContent = error.message; }
    finally { save.disabled = false; }
  });
  load();
});
