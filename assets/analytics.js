(() => {
  "use strict";

  const config = window.REDXJAK_ANALYTICS_CONFIG || {};
  const endpoint = config.supabaseUrl ? `${config.supabaseUrl.replace(/\/$/, "")}/functions/v1/collect` : "";
  const allowedPropertyKeys = new Set([
    "action", "category", "choice_index", "completed", "count", "destination",
    "error_type", "feature", "hero", "liked", "method", "option", "outcome",
    "story", "target", "total", "view",
  ]);
  const queue = [];
  const appId = document.documentElement.dataset.analyticsApp || "";
  const appVersion = document.documentElement.dataset.appVersion || "web";
  const sessionKey = `redxjak-analytics-session:${appId}`;
  let flushTimer = null;

  function configured() {
    return Boolean(appId && endpoint && config.publishableKey);
  }

  function getSessionId() {
    try {
      let value = sessionStorage.getItem(sessionKey);
      if (!value) {
        value = crypto.randomUUID();
        sessionStorage.setItem(sessionKey, value);
      }
      return value;
    } catch {
      return crypto.randomUUID();
    }
  }

  const sessionId = getSessionId();

  function cleanString(value, maxLength = 80) {
    return String(value ?? "").replace(/[\r\n\t]/g, " ").trim().slice(0, maxLength);
  }

  function sanitizeProperties(properties = {}) {
    const safe = {};
    for (const [key, value] of Object.entries(properties)) {
      if (!allowedPropertyKeys.has(key)) continue;
      if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) safe[key] = value;
      else if (typeof value === "string") safe[key] = cleanString(value, 60);
    }
    return safe;
  }

  function currentScreen() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    return path.slice(0, 160);
  }

  function scheduleFlush(delay = 1200) {
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, delay);
  }

  function track(eventName, properties = {}, options = {}) {
    if (!configured() || !/^[a-z][a-z0-9_]{1,63}$/.test(eventName)) return;
    queue.push({
      event_id: crypto.randomUUID(),
      app_id: appId,
      event_name: eventName,
      occurred_at: new Date().toISOString(),
      session_id: sessionId,
      screen: cleanString(options.screen || currentScreen(), 160),
      app_version: cleanString(appVersion, 40),
      properties: sanitizeProperties(properties),
    });
    if (queue.length >= 10) flush(); else scheduleFlush();
  }

  async function send(events, keepalive = false) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: config.publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ events }),
      keepalive,
      credentials: "omit",
    });
    if (!response.ok && response.status >= 500) throw new Error("analytics unavailable");
  }

  async function flush(options = {}) {
    clearTimeout(flushTimer);
    if (!configured() || !queue.length) return;
    const events = queue.splice(0, 20);
    try {
      await send(events, Boolean(options.keepalive));
    } catch {
      if (!options.retry) {
        queue.unshift(...events);
        setTimeout(() => flush({ retry: true }), 2500);
      }
    }
    if (queue.length) scheduleFlush(100);
  }

  function safeDestination(anchor) {
    try {
      const url = new URL(anchor.href, location.href);
      return url.origin === location.origin ? url.pathname.slice(0, 120) : url.hostname.slice(0, 120);
    } catch {
      return "unknown";
    }
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a[href]");
    if (!anchor) return;
    if (anchor.dataset.analyticsEvent) {
      const properties = {};
      if (anchor.dataset.analyticsTarget) properties.target = cleanString(anchor.dataset.analyticsTarget, 60);
      if (anchor.dataset.analyticsAction) properties.action = cleanString(anchor.dataset.analyticsAction, 60);
      track(anchor.dataset.analyticsEvent, properties);
      return;
    }
    const url = new URL(anchor.href, location.href);
    const project = [
      ["/GrubClique", "grubclique"], ["/FFA", "ffa"], ["/PWGen", "pwgen"],
      ["/Legends-of-Veyrindel", "veyrindel"], ["/Tales-of-Visteria", "tales-of-visteria"],
    ].find(([path]) => url.pathname.startsWith(path));
    if (appId === "portfolio" && project) {
      track("project_opened", { target: project[1] });
      return;
    }
    if (url.origin !== location.origin || anchor.dataset.analyticsAction) {
      track("outbound_link_clicked", {
        destination: safeDestination(anchor),
        action: cleanString(anchor.dataset.analyticsAction || "link", 60),
      });
    }
  }, { capture: true });

  window.addEventListener("error", (event) => {
    track("app_error", { error_type: cleanString(event.error?.name || "Error", 40) });
  });
  window.addEventListener("unhandledrejection", (event) => {
    track("app_error", { error_type: cleanString(event.reason?.name || "UnhandledRejection", 40) });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush({ keepalive: true });
  });
  window.addEventListener("pagehide", () => flush({ keepalive: true }));

  window.RedxjakAnalytics = Object.freeze({ track, flush });
  track("session_started");
  track("screen_viewed");
})();
