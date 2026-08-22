(() => {
  const endpoint = "https://msowbrvpziigoqlpqfuu.supabase.co/functions/v1/report-issue";
  const form = document.querySelector("#issue-form");
  const status = document.querySelector("#form-status");
  const submit = document.querySelector("#submit-button");
  const diagnosticsPreview = document.querySelector("#diagnostics-preview");
  const siteKey = document.querySelector('meta[name="turnstile-site-key"]')?.content.trim() || "";
  const loadedAt = new Date().toISOString();
  let turnstileWidget = null;

  diagnosticsPreview.textContent = `Source: website · Timestamp: ${loadedAt}`;

  function show(message, kind = "") {
    status.textContent = message;
    status.className = `form-status ${kind}`.trim();
  }

  function renderTurnstile() {
    if (!siteKey || !window.turnstile || turnstileWidget !== null) return;
    turnstileWidget = window.turnstile.render("#turnstile-widget", {
      sitekey: siteKey,
      theme: "auto",
      action: "grubclique_issue_report",
      callback: () => show(""),
      "expired-callback": () => show("Please complete the anti-bot check again.", "error"),
      "error-callback": () => show("The anti-bot check could not load. Please refresh and try again.", "error"),
    });
  }

  window.addEventListener("turnstile-ready", renderTurnstile);
  if (window.turnstile) renderTurnstile();
  if (!siteKey) {
    submit.disabled = true;
    show("Online issue reporting is being configured. Please use redxjak@gmail.com in the meantime.", "error");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    show("");
    if (!form.reportValidity()) return;
    const screenshot = form.elements.screenshot.files[0];
    if (screenshot && (!new Set(["image/png", "image/jpeg", "image/webp"]).has(screenshot.type) || screenshot.size > 3 * 1024 * 1024)) {
      show("Screenshot must be a PNG, JPEG, or WebP file up to 3 MB.", "error");
      return;
    }
    if (form.elements.allow_follow_up.checked && !form.elements.contact_email.value.trim()) {
      show("Add a contact email if you would like a follow-up.", "error");
      form.elements.contact_email.focus();
      return;
    }
    const token = window.turnstile?.getResponse(turnstileWidget) || "";
    if (!token) {
      show("Please complete the anti-bot check.", "error");
      return;
    }

    submit.disabled = true;
    submit.textContent = "Submitting…";
    try {
      const data = new FormData(form);
      data.set("allow_follow_up", form.elements.allow_follow_up.checked ? "true" : "false");
      data.set("idempotency_key", crypto.randomUUID());
      data.set("diagnostics", JSON.stringify({ source: "website", submitted_at: loadedAt }));
      const response = await fetch(endpoint, { method: "POST", body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The report could not be submitted.");
      form.reset();
      show(`Report submitted. Your reference is ${result.reference}.`, "success");
      window.turnstile?.reset(turnstileWidget);
    } catch (error) {
      show(error.message || "The report could not be submitted. Check your connection and try again.", "error");
      window.turnstile?.reset(turnstileWidget);
    } finally {
      submit.disabled = false;
      submit.textContent = "Submit report";
    }
  });
})();
