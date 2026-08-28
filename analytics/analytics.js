(() => {
  "use strict";
  const config = window.REDXJAK_ANALYTICS_CONFIG || {};
  const base = String(config.supabaseUrl || "").replace(/\/$/, "");
  const sessionKey = "redxjak-analytics-owner-session";
  const setupView = document.querySelector("#setup-view");
  const loginView = document.querySelector("#login-view");
  const dashboardView = document.querySelector("#dashboard-view");
  const message = document.querySelector("#dashboard-message");
  let session = null;

  const show = (view) => [setupView, loginView, dashboardView].forEach((item) => item.classList.toggle("hidden", item !== view));
  const format = (value) => new Intl.NumberFormat().format(value || 0);
  const escapeText = (value) => String(value ?? "Unknown");

  function saveSession(value) {
    session = value;
    if (value) sessionStorage.setItem(sessionKey, JSON.stringify(value)); else sessionStorage.removeItem(sessionKey);
  }

  async function api(path, options = {}) {
    const response = await fetch(`${base}/functions/v1/${path}`, {
      ...options,
      headers: { apikey: config.publishableKey, "Content-Type": "application/json", ...(options.headers || {}) },
      credentials: "omit",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(result.error || "Request failed"); error.status = response.status; throw error; }
    return result;
  }

  async function refreshSession() {
    if (!session?.refresh_token) return false;
    const response = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: { apikey: config.publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!response.ok) return false;
    const next = await response.json();
    saveSession({ ...session, access_token: next.access_token, refresh_token: next.refresh_token || session.refresh_token });
    return true;
  }

  function rankList(id, rows) {
    const target = document.querySelector(id);
    target.replaceChildren();
    if (!rows.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "No data yet"; target.append(empty); return; }
    const max = Math.max(...rows.map((row) => row.value), 1);
    for (const row of rows) {
      const wrapper = document.createElement("div"); wrapper.className = "rank-row";
      const label = document.createElement("span"); label.textContent = escapeText(row.label); label.title = label.textContent;
      const value = document.createElement("strong"); value.textContent = format(row.value);
      const track = document.createElement("div"); track.className = "rank-track";
      const bar = document.createElement("i"); bar.style.width = `${Math.max(2, row.value / max * 100)}%`;
      track.append(bar); wrapper.append(label, value, track); target.append(wrapper);
    }
  }

  function renderChart(rows) {
    const chart = document.querySelector("#trend-chart"); chart.replaceChildren();
    if (!rows.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "No activity in this range"; chart.append(empty); return; }
    const max = Math.max(...rows.map((row) => row.events), 1);
    for (const row of rows) {
      const bar = document.createElement("div"); bar.className = "trend-bar";
      bar.style.height = `${Math.max(2, row.events / max * 100)}%`;
      bar.dataset.label = `${row.date}: ${format(row.events)} events`;
      chart.append(bar);
    }
  }

  function renderErrors(rows) {
    const body = document.querySelector("#errors-body"); body.replaceChildren();
    if (!rows.length) { const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = 4; cell.className = "empty"; cell.textContent = "No errors in this range"; row.append(cell); body.append(row); return; }
    for (const item of rows) {
      const row = document.createElement("tr");
      [new Date(item.occurred_at).toLocaleString(), item.app, item.screen, item.error_type].forEach((value) => { const cell = document.createElement("td"); cell.textContent = escapeText(value); row.append(cell); });
      body.append(row);
    }
  }

  async function loadDashboard(allowRefresh = true) {
    message.textContent = "";
    const app = document.querySelector("#app-filter").value;
    const days = document.querySelector("#range-filter").value;
    try {
      const data = await api(`dashboard-data?app=${encodeURIComponent(app)}&days=${encodeURIComponent(days)}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      message.textContent = data.truncated ? "This view reached 100,000 events. Choose a shorter range for exact totals." : "";
      document.querySelector("#owner-name").textContent = `@${data.username}`;
      document.querySelector("#dashboard-title").textContent = app === "all" ? "Analytics for every project." : `${document.querySelector("#app-filter").selectedOptions[0].textContent} analytics.`;
      document.querySelector("#date-caption").textContent = `${app === "all" ? "All apps" : document.querySelector("#app-filter").selectedOptions[0].textContent} · last ${days === "3650" ? "all available days" : `${days} days`}`;
      for (const key of ["visits", "sessions", "events", "errors"]) document.querySelector(`#metric-${key}`).textContent = format(data.totals[key]);
      const selector = document.querySelector("#app-filter");
      if (selector.options.length === 1) data.apps.forEach((item) => selector.add(new Option(item.name, item.id)));
      renderChart(data.daily); rankList("#top-events", data.topEvents); rankList("#top-screens", data.topScreens);
      rankList("#app-totals", data.appTotals); rankList("#referrers", data.referrers); rankList("#devices", data.devices); rankList("#countries", data.countries); renderErrors(data.recentErrors);
      show(dashboardView);
    } catch (error) {
      if (error.status === 401 && allowRefresh && await refreshSession()) return loadDashboard(false);
      if (error.status === 401 || error.status === 403) { saveSession(null); show(loginView); document.querySelector("#login-message").textContent = "Your session expired. Sign in again."; return; }
      message.textContent = "Analytics could not be loaded. Try again in a moment.";
    }
  }

  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const button = event.currentTarget.querySelector("button"); const loginMessage = document.querySelector("#login-message");
    button.disabled = true; loginMessage.textContent = "";
    try {
      const result = await api("dashboard-login", { method: "POST", body: JSON.stringify({ username: document.querySelector("#username").value, password: document.querySelector("#password").value }) });
      saveSession(result); document.querySelector("#password").value = ""; await loadDashboard();
    } catch { loginMessage.textContent = "The username or password is incorrect."; }
    finally { button.disabled = false; }
  });
  document.querySelector("#sign-out").addEventListener("click", () => { saveSession(null); show(loginView); });
  document.querySelector("#app-filter").addEventListener("change", () => loadDashboard());
  document.querySelector("#range-filter").addEventListener("change", () => loadDashboard());

  if (!base || !config.publishableKey) { show(setupView); return; }
  try { session = JSON.parse(sessionStorage.getItem(sessionKey) || "null"); } catch { session = null; }
  if (session?.access_token) loadDashboard(); else show(loginView);
})();
