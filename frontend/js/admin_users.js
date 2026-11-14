"use strict";
document.addEventListener("DOMContentLoaded", () => {
  const management = document.getElementById("userManagement");
  const rows = document.getElementById("adminUserRows");
  const status = document.getElementById("usersStatus");
  const loginLink = document.getElementById("adminLoginLink");
  const search = document.getElementById("userSearch");
  const filter = document.getElementById("userStatusFilter");
  let users = [];
  let busy = false;

  function render() {
    document.getElementById("totalUsers").textContent = users.length;
    document.getElementById("lockedUsers").textContent = users.filter(user => user.locked).length;
    document.getElementById("activeUsers").textContent = users.filter(user => !user.locked).length;
    const term = search.value.trim().toLowerCase();
    const filtered = users.filter(user => [user.id, user.username, user.email].some(value => String(value).toLowerCase().includes(term)) &&
      (filter.value === "all" || (filter.value === "locked" ? user.locked : !user.locked)));
    rows.replaceChildren();
    document.getElementById("userResultCount").textContent = `Showing ${filtered.length} of ${users.length} users`;
    if (!filtered.length) {
      const cell = document.createElement("td");
      cell.colSpan = 6;cell.className = "users-empty";
      cell.textContent = users.length ? "No matching users found." : "No registered users yet.";
      const row = document.createElement("tr");row.appendChild(cell);rows.appendChild(row);
      return;
    }
    filtered.forEach(user => {
      const row = document.createElement("tr");row.dataset.userId = user.id;
      [user.id, user.username, user.email, user.created_at || "Not available"].forEach(value => {
        const cell = document.createElement("td");cell.textContent = value;row.appendChild(cell);
      });
      const stateCell = document.createElement("td");
      const state = document.createElement("span");
      state.className = `users-account-status${user.locked ? " is-locked" : ""}`;
      state.textContent = user.locked ? "Locked" : "Active";stateCell.appendChild(state);row.appendChild(stateCell);
      const actionCell = document.createElement("td");
      const action = document.createElement("button");action.type = "button";
      action.textContent = user.locked ? "Unlock" : "Lock";
      action.setAttribute("aria-label", `${action.textContent} account ${user.username}`);
      action.disabled = busy;
      action.addEventListener("click", () => toggleLock(user));
      actionCell.appendChild(action);row.appendChild(actionCell);rows.appendChild(row);
    });
  }

  async function load() {
    if (busy) return;
    busy = true;management.hidden = true;loginLink.hidden = true;
    status.textContent = "Loading users...";
    try {
      const data = await authRequest("/api/admin/users");
      if (!Array.isArray(data.users)) throw new Error("Invalid user data");
      users = data.users;
      management.hidden = false;status.textContent = "Manage registered user access. Administrator accounts are not listed here.";
    } catch (error) {
      users = [];
      status.textContent = error.message;loginLink.hidden = false;
    } finally { busy = false;render(); }
  }

  async function toggleLock(user) {
    if (busy) return;
    busy = true;render();
    status.textContent = user.locked ? "Unlocking account..." : "Locking account...";
    try {
      const result = await authRequest(`/api/admin/users/${encodeURIComponent(user.id)}/lock?locked=${!user.locked}`, { method: "PATCH" });
      user.locked = result.locked;
      status.textContent = result.locked ? "Account locked." : "Account unlocked.";
    } catch (error) { status.textContent = error.message; }
    finally { busy = false;render(); }
  }

  search.addEventListener("input", render);filter.addEventListener("change", render);
  load();
});
