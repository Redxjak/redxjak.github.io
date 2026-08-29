(() => {
  "use strict";
  const config = window.REDXJAK_ANALYTICS_CONFIG || {};
  const base = String(config.supabaseUrl || "").replace(/\/$/, "");
  if (!base || !config.publishableKey) return;
  const targets = {
    heroEyebrow: "#hero-eyebrow", heroTitleLine1: "#hero-title-line-1", heroTitleLine2: "#hero-title-line-2",
    heroIntro: "#hero-intro", communityTitle: "#community-title", communityBody: "#community-body",
  };
  fetch(`${base}/functions/v1/site-content`, { headers: { apikey: config.publishableKey }, credentials: "omit" })
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then(({ content }) => {
      for (const [key, selector] of Object.entries(targets)) {
        if (typeof content?.[key] === "string" && content[key]) document.querySelector(selector).textContent = content[key];
      }
      const banner = document.querySelector("#site-announcement");
      if (content?.announcementEnabled && content.announcementText) {
        document.querySelector("#announcement-text").textContent = content.announcementText;
        banner.href = content.announcementUrl || "#projects";
        if (/^https:\/\//i.test(content.announcementUrl || "")) { banner.target = "_blank"; banner.rel = "noreferrer"; }
        banner.hidden = false;
      }
    }).catch(() => {});
})();
