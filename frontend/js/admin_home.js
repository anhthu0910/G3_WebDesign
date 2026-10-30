"use strict";

const chartColors = ["#c96583", "#ed91a7", "#f4b4bd", "#f8d0d1", "#d9a1ae", "#b984a0"];
const escapeChartText = value => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character]);

function renderLineChart(chart) {
  const width = 480, height = 145, left = 34, right = 470, top = 14, bottom = 105;
  const max = Math.max(...chart.values, 1);
  const points = chart.values.map((value, index) => ({
    x: left + (right - left) * index / Math.max(chart.values.length - 1, 1),
    y: bottom - (bottom - top) * value / max,
    value,
    label: chart.labels[index]
  }));
  const path = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const grid = [0, 0.5, 1].map(ratio => {
    const y = bottom - (bottom - top) * ratio;
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-grid-line"/><text x="${left - 7}" y="${y + 4}" text-anchor="end" class="chart-axis-label">${Math.round(max * ratio)}</text>`;
  }).join("");
  const labels = points.map(point => `<text x="${point.x}" y="128" text-anchor="middle" class="chart-axis-label">${escapeChartText(point.label)}</text>`).join("");
  const markers = points.map(point => `<circle cx="${point.x}" cy="${point.y}" r="3.5" class="chart-line-marker"><title>${escapeChartText(point.label)}: ${point.value} clicks</title></circle>`).join("");
  return `<svg class="admin-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Affiliate clicks by month in ${chart.year}">${grid}<path d="${path}" class="chart-line-path"/>${markers}${labels}</svg>`;
}

function renderBarChart(chart) {
  const width = 480, height = 145, left = 34, right = 470, top = 14, bottom = 105;
  const max = Math.max(...chart.values, 1);
  const slot = (right - left) / chart.values.length;
  const grid = [0, 0.5, 1].map(ratio => {
    const y = bottom - (bottom - top) * ratio;
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-grid-line"/><text x="${left - 7}" y="${y + 4}" text-anchor="end" class="chart-axis-label">${Math.round(max * ratio)}</text>`;
  }).join("");
  const bars = chart.values.map((value, index) => {
    const barHeight = (bottom - top) * value / max;
    const x = left + slot * index + slot * 0.16;
    const y = bottom - barHeight;
    return `<rect x="${x}" y="${y}" width="${slot * 0.68}" height="${barHeight}" rx="2" class="chart-bar"><title>${escapeChartText(chart.labels[index])}: ${value} requests</title></rect><text x="${left + slot * (index + 0.5)}" y="128" text-anchor="middle" class="chart-axis-label">${escapeChartText(chart.labels[index])}</text>`;
  }).join("");
  return `<svg class="admin-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="AI requests by week">${grid}${bars}</svg>`;
}

function renderCategoryChart(categories) {
  const total = categories.reduce((sum, item) => sum + item.value, 0);
  let accumulated = 0;
  const segments = categories.map((item, index) => {
    const start = total ? accumulated / total * 100 : 0;
    accumulated += item.value;
    const end = total ? accumulated / total * 100 : 0;
    return `${chartColors[index % chartColors.length]} ${start}% ${end}%`;
  });
  const donutStyle = total
    ? `background: conic-gradient(${segments.join(", ")})`
    : "background: #f0e4e8";
  const legend = categories.length
    ? categories.map((item, index) => `<li><span class="chart-legend-dot" style="--chart-color:${chartColors[index % chartColors.length]}" aria-hidden="true"></span><span class="chart-legend-label">${escapeChartText(item.label)}</span><strong>${item.value} (${total ? Math.round(item.value / total * 100) : 0}%)</strong></li>`).join("")
    : '<li class="chart-empty">No products available</li>';
  return `<div class="category-chart-content"><div class="category-donut" style="${donutStyle}" role="img" aria-label="Products by category, ${total} products"><div><strong>${total}</strong><span>products</span></div></div><ul class="category-chart-legend">${legend}</ul></div>`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const user = typeof getCurrentUser === "function" ? await getCurrentUser() : null;
  const main = document.querySelector("main");
  if (!main) return;
  if (!user || user.role !== "admin") {
    main.innerHTML = '<section class="admin-home-overview"><h1>Admin access required</h1><p>Please sign in with an administrator account to view this page.</p><a href="login.html">Go to Login</a></section>';
    return;
  }
  main.replaceChildren();
  const page = document.createElement("section");
  page.className = "admin-home-overview";
  page.innerHTML = '<p>Loading admin overview...</p>';
  main.appendChild(page);
  try {
    const data = await authRequest("/api/admin/overview");
    const val = value => value == null ? "Not tracked" : value;
    const cards = [["Cosmetics", data.cards.products], ["Users", data.cards.users], ["Quiz Completions", data.cards.quiz_completions], ["AI Requests", data.cards.ai_requests], ["Affiliate Clicks", data.cards.affiliate_clicks]];
    const cardHtml = cards.map(([label, number]) => `<article class="home-overview-card"><div><span>${label}</span><strong>${val(number)}</strong></div></article>`).join("");
    const statuses = [["FastAPI Backend", data.status.fastapi], ["SQLite Database", data.status.sqlite], ["Gemini AI", data.status.gemini], ["Skin Quiz", data.status.skin_quiz]];
    const statusHtml = statuses.map(([label, status]) => `<tr><td>${label}</td><td>${status}</td></tr>`).join("");
    const alerts = Object.entries(data.alerts).filter(([, count]) => count > 0);
    const alertHtml = alerts.length ? alerts.map(([issue, count]) => `<tr><td><a class="data-alert-link" href="products.html?issue=${encodeURIComponent(issue)}" title="Click to view and edit affected products">${issue.replaceAll("_", " ")} <span class="data-alert-arrow" aria-hidden="true">→</span></a></td><td><strong>${count}</strong></td></tr>`).join("") : '<tr><td colspan="2">No data alerts.</td></tr>';
    const activityHtml = data.recent_activity.length ? data.recent_activity.map(item => `<tr><td>${item.created_at}</td><td>${item.username}</td><td>${item.action}</td><td>${item.entity}${item.entity_id ? ` #${item.entity_id}` : ""}</td></tr>`).join("") : '<tr><td colspan="4" class="empty-activity"><strong>No activity recorded yet.</strong><small>There are no recent admin actions.</small></td></tr>';
    const charts = data.charts;
    page.innerHTML = `<div class="home-overview-heading"><p>GLOWGUIDE ADMIN</p><h1>Home Overview</h1><span>Live management summary from SQLite.</span></div><div class="home-overview-cards">${cardHtml}</div><section class="home-chart-grid" aria-label="Store analytics"><article class="home-chart-panel"><h2>Affiliate Clicks by Month</h2><div class="chart-visual">${renderLineChart(charts.affiliate_clicks_by_month)}</div></article><article class="home-chart-panel"><h2>AI Requests by Week</h2><div class="chart-visual">${renderBarChart(charts.ai_requests_by_week)}</div></article><article class="home-chart-panel"><h2>Products by Category</h2><div class="chart-visual">${renderCategoryChart(charts.products_by_category)}</div></article></section><div class="home-overview-grid"><section class="home-overview-panel"><h2>System Status</h2><p>Current status of key components.</p><table><tbody>${statusHtml}</tbody></table></section><section class="home-overview-panel"><h2>Data Alerts</h2><p>Issues found in current data.</p><table><thead><tr><th>Issue Type</th><th>Count</th></tr></thead><tbody>${alertHtml}</tbody></table></section></div><section class="home-overview-panel activity-panel"><h2>Recent Activity</h2><p>Latest admin actions from audit logs.</p><table><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>${activityHtml}</tbody></table></section>`;
  } catch (error) { page.innerHTML = `<p class="overview-error">Could not load admin overview: ${error.message}</p>`; }
});
