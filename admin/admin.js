(() => {
  "use strict";
  const config = window.REDXJAK_ANALYTICS_CONFIG || {};
  const base = String(config.supabaseUrl || "").replace(/\/$/, "");
  const sessionKey = "redxjak-admin-owner-session";
  const legacySessionKey = "redxjak-analytics-owner-session";
  const views = ["setup-view", "login-view", "admin-view"].map((id) => document.querySelector(`#${id}`));
  const form = document.querySelector("#content-form");
  let session = null;
  let savedContent = null;

  const show = (view) => views.forEach((item) => item.classList.toggle("hidden", item !== view));
  const format = (value) => new Intl.NumberFormat().format(value || 0);
  const safe = (value) => String(value ?? "Unknown");

  function saveSession(value) {
    session = value;
    if (value) sessionStorage.setItem(sessionKey, JSON.stringify(value));
    else { sessionStorage.removeItem(sessionKey); sessionStorage.removeItem(legacySessionKey); }
  }

  async function api(path, options = {}) {
    const response = await fetch(`${base}/functions/v1/${path}`, { ...options, headers: { apikey: config.publishableKey, "Content-Type": "application/json", ...(options.headers || {}) }, credentials: "omit" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(result.error || "Request failed"); error.status = response.status; throw error; }
    return result;
  }

  async function refreshSession() {
    if (!session?.refresh_token) return false;
    const response = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: config.publishableKey, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: session.refresh_token }) });
    if (!response.ok) return false;
    const next = await response.json();
    saveSession({ ...session, access_token: next.access_token, refresh_token: next.refresh_token || session.refresh_token });
    return true;
  }

  async function authorized(path, options = {}, retry = true) {
    try { return await api(path, { ...options, headers: { Authorization: `Bearer ${session.access_token}`, ...(options.headers || {}) } }); }
    catch (error) {
      if (error.status === 401 && retry && await refreshSession()) return authorized(path, options, false);
      if ([401, 403].includes(error.status)) { saveSession(null); show(document.querySelector("#login-view")); document.querySelector("#login-message").textContent = "Your session expired. Sign in again."; }
      throw error;
    }
  }

  function navigate(name) {
    document.querySelectorAll(".page").forEach((page) => page.classList.toggle("active", page.id === `panel-${name}`));
    document.querySelectorAll(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.panel === name));
    document.querySelector("#admin-view").classList.remove("menu-open");
    history.replaceState(null, "", `#${name}`);
    if (name === "analytics") loadAnalytics();
  }

  function applyContent(content) {
    for (const [key, value] of Object.entries(content)) if (form.elements[key]) {
      if (form.elements[key].type === "checkbox") form.elements[key].checked = Boolean(value); else form.elements[key].value = value;
    }
    savedContent = { ...content };
    updatePreview();
  }

  function getContent() {
    return {
      heroEyebrow: form.elements.heroEyebrow.value, heroTitleLine1: form.elements.heroTitleLine1.value,
      heroTitleLine2: form.elements.heroTitleLine2.value, heroIntro: form.elements.heroIntro.value,
      communityTitle: form.elements.communityTitle.value, communityBody: form.elements.communityBody.value,
      announcementEnabled: form.elements.announcementEnabled.checked, announcementText: form.elements.announcementText.value,
      announcementUrl: form.elements.announcementUrl.value,
    };
  }

  function updatePreview() {
    const enabled = form.elements.announcementEnabled.checked;
    document.querySelector("#banner-preview").style.opacity = enabled ? "1" : ".35";
    document.querySelector("#preview-text").textContent = form.elements.announcementText.value || "Your announcement will appear here.";
  }

  async function loadContent() {
    try {
      const data = await authorized("admin-site");
      applyContent(data.content); document.querySelector("#owner-name").textContent = `@${data.username}`;
      document.querySelector("#content-updated").textContent = `Last published ${new Date(data.updated_at).toLocaleString()}`;
    } catch { document.querySelector("#content-updated").textContent = "Content service unavailable"; }
  }

  function rankList(id, rows) {
    const target = document.querySelector(id); target.replaceChildren();
    if (!rows.length) { const empty = document.createElement("p"); empty.className = "empty"; empty.textContent = "No data yet"; target.append(empty); return; }
    const max = Math.max(...rows.map((row) => row.value), 1);
    for (const row of rows) {
      const wrapper = document.createElement("div"); wrapper.className = "rank-row";
      const label = document.createElement("span"); label.textContent = safe(row.label); label.title = label.textContent;
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
    for (const row of rows) { const bar = document.createElement("div"); bar.className = "trend-bar"; bar.style.height = `${Math.max(2, row.events / max * 100)}%`; bar.dataset.label = `${row.date}: ${format(row.events)} events`; chart.append(bar); }
  }

  function renderErrors(rows) {
    const body = document.querySelector("#errors-body"); body.replaceChildren();
    if (!rows.length) { const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = 4; cell.className = "empty"; cell.textContent = "No errors in this range"; row.append(cell); body.append(row); return; }
    for (const item of rows) { const row = document.createElement("tr"); [new Date(item.occurred_at).toLocaleString(), item.app, item.screen, item.error_type].forEach((value) => { const cell = document.createElement("td"); cell.textContent = safe(value); row.append(cell); }); body.append(row); }
  }

  async function loadAnalytics() {
    const message = document.querySelector("#analytics-message"); message.textContent = "";
    const app = document.querySelector("#app-filter").value; const days = document.querySelector("#range-filter").value;
    try {
      const data = await authorized(`dashboard-data?app=${encodeURIComponent(app)}&days=${encodeURIComponent(days)}`);
      message.textContent = data.truncated ? "This view reached 100,000 events. Choose a shorter range for exact totals." : "";
      document.querySelector("#date-caption").textContent = `${app === "all" ? "All apps" : document.querySelector("#app-filter").selectedOptions[0].textContent} · ${days === "3650" ? "all available days" : `last ${days} days`}`;
      for (const key of ["visits", "sessions", "events", "errors"]) document.querySelector(`#metric-${key}`).textContent = format(data.totals[key]);
      document.querySelector("#overview-visits").textContent = format(data.totals.visits); document.querySelector("#overview-sessions").textContent = format(data.totals.sessions); document.querySelector("#overview-errors").textContent = format(data.totals.errors);
      const selector = document.querySelector("#app-filter"); if (selector.options.length === 1) data.apps.forEach((item) => selector.add(new Option(item.name, item.id)));
      renderChart(data.daily); rankList("#top-events", data.topEvents); rankList("#top-screens", data.topScreens); rankList("#app-totals", data.appTotals); rankList("#referrers", data.referrers); rankList("#devices", data.devices); rankList("#countries", data.countries); renderErrors(data.recentErrors);
    } catch (error) { if (![401, 403].includes(error.status)) message.textContent = "Analytics could not be loaded. Try again in a moment."; }
  }

  async function openAdmin() {
    show(document.querySelector("#admin-view"));
    await Promise.all([loadContent(), loadAnalytics()]);
    navigate(["overview", "content", "analytics"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "overview");
  }

  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault(); const button = event.currentTarget.querySelector("button"); const message = document.querySelector("#login-message"); button.disabled = true; message.textContent = "";
    try { const result = await api("dashboard-login", { method: "POST", body: JSON.stringify({ username: document.querySelector("#username").value, password: document.querySelector("#password").value }) }); saveSession(result); document.querySelector("#password").value = ""; await openAdmin(); }
    catch { message.textContent = "The username or password is incorrect."; } finally { button.disabled = false; }
  });
  form.addEventListener("input", updatePreview);
  form.addEventListener("submit", async (event) => {
    event.preventDefault(); const message = document.querySelector("#content-message"); const button = document.querySelector("#save-content"); button.disabled = true; message.textContent = "Publishing…";
    try { const data = await authorized("admin-site", { method: "PUT", body: JSON.stringify(getContent()) }); savedContent = { ...data.content }; message.textContent = `Published ${new Date(data.updated_at).toLocaleTimeString()}`; document.querySelector("#content-updated").textContent = `Last published ${new Date(data.updated_at).toLocaleString()}`; }
    catch (error) { if (![401, 403].includes(error.status)) message.textContent = error.message === "Invalid content" ? "Check the announcement link and required fields." : "Could not publish. Try again."; } finally { button.disabled = false; }
  });
  document.querySelector("#reset-content").addEventListener("click", () => savedContent && applyContent(savedContent));
  document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.panel)));
  document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => navigate(button.dataset.go)));
  document.querySelector("#app-filter").addEventListener("change", loadAnalytics); document.querySelector("#range-filter").addEventListener("change", loadAnalytics);
  document.querySelector("#menu-button").addEventListener("click", () => document.querySelector("#admin-view").classList.toggle("menu-open"));
  document.querySelector("#sign-out").addEventListener("click", () => { saveSession(null); show(document.querySelector("#login-view")); });

  if (!base || !config.publishableKey) { show(document.querySelector("#setup-view")); return; }
  try { session = JSON.parse(sessionStorage.getItem(sessionKey) || sessionStorage.getItem(legacySessionKey) || "null"); } catch { session = null; }
  if (session?.access_token) openAdmin(); else show(document.querySelector("#login-view"));
})();
