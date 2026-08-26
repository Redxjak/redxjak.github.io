import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.55.0/+esm";

const SUPABASE_URL = "https://msowbrvpziigoqlpqfuu.supabase.co";
const SUPABASE_KEY = "sb_publishable_P2OwC3HhT1lj75Lq7dQkDw_k6zDJGEb";
const APP_URL = "https://redxjak.com/GrubClique/app/";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const panels = ["home", "clique", "filters", "swipe", "chat", "history", "settings"];
let session = null;
let profile = null;
let clique = null;
let preferences = { meal_periods: [], sort_mode: "default" };
let restaurants = [];
let swipeIndex = 0;
let pollTimer = null;
let creatingAccount = false;
let installPrompt = null;

function showPanel(name) {
  panels.forEach((panel) => $(`#${panel}-panel`)?.classList.toggle("hidden", panel !== name));
  $$(".tab-bar button").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  if (["clique", "swipe", "chat"].includes(name) && clique) startPolling(); else stopPolling();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setMessage(selector, message = "", success = false) {
  const element = $(selector);
  element.textContent = message;
  element.classList.toggle("success", success);
}

function friendlyError(error, fallback) {
  const value = String(error?.message || error || "").toLowerCase();
  if (value.includes("invalid login")) return "The email or password is incorrect.";
  if (value.includes("email not confirmed")) return "Confirm your email before logging in.";
  if (value.includes("clique not found") || value.includes("invite")) return "We couldn't find that invite code.";
  if (value.includes("only the clique host")) return "Only the clique host can make that change.";
  if (value.includes("authentication")) return "Your session expired. Please sign in again.";
  return fallback;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:", "tel:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

async function ensureProfile() {
  const { data, error } = await supabase.rpc("get_my_profile");
  if (error) throw error;
  profile = data?.[0] || null;
  if (!profile) {
    const emailStem = session.user.email?.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18) || "member";
    const suffix = session.user.id.replaceAll("-", "").slice(0, 5);
    const username = `${emailStem.length >= 3 ? emailStem : "member"}_${suffix}`.slice(0, 24);
    const { error: saveError } = await supabase.rpc("set_profile_username", { new_username: username });
    if (saveError) throw saveError;
    profile = { username, display_name: username, avatar_url: null };
  }
  $("#profile-name").textContent = `@${profile.username}`;
  $("#account-email").textContent = session.user.email || "Google account";
}

async function enterApp() {
  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  $("#sign-out").classList.remove("hidden");
  $("#connection-status").textContent = "Connected";
  await ensureProfile();
  const { data, error } = await supabase.rpc("resume_clique");
  if (!error && data?.[0]) {
    clique = { id: data[0].clique_id, code: data[0].invite_code, isHost: data[0].is_host, status: data[0].status };
    $("#resume-card").classList.remove("hidden");
    $("#resume-title").textContent = `Clique ${clique.code}`;
  } else {
    $("#resume-card").classList.add("hidden");
  }
  const invite = new URLSearchParams(location.search).get("invite")?.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
  if (invite) {
    $("#join-code").value = invite;
    $("#invite-banner").textContent = `Invite ${invite} is ready. Select Join when you're ready.`;
    $("#invite-banner").classList.remove("hidden");
  }
  showPanel("home");
}

async function leaveApp() {
  stopPolling();
  clique = null;
  profile = null;
  $("#app-view").classList.add("hidden");
  $("#auth-view").classList.remove("hidden");
  $("#sign-out").classList.add("hidden");
  $("#connection-status").textContent = "Signed out";
}

async function restoreSession() {
  const { data } = await supabase.auth.getSession();
  session = data.session;
  if (session) await enterApp(); else await leaveApp();
}

$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("#auth-message");
  const email = $("#auth-email").value.trim();
  const password = $("#auth-password").value;
  const result = creatingAccount
    ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: APP_URL } })
    : await supabase.auth.signInWithPassword({ email, password });
  if (result.error) return setMessage("#auth-message", friendlyError(result.error, "We couldn't complete that request. Please try again."));
  if (creatingAccount && !result.data.session) setMessage("#auth-message", "Account created. Check your email to confirm it, then return here.", true);
});

$("#toggle-auth-mode").addEventListener("click", () => {
  creatingAccount = !creatingAccount;
  $("#email-auth").textContent = creatingAccount ? "Create account" : "Log in";
  $("#toggle-auth-mode").textContent = creatingAccount ? "Already have an account? Log in" : "Create an account";
  $("#auth-password").autocomplete = creatingAccount ? "new-password" : "current-password";
  setMessage("#auth-message");
});

$("#google-auth").addEventListener("click", async () => {
  const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: APP_URL } });
  if (error) setMessage("#auth-message", "We couldn't open Google sign-in. Please try again.");
});
$("#sign-out").addEventListener("click", () => supabase.auth.signOut());

function browserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Location is not supported by this browser."));
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => reject(new Error("Allow location access to create a nearby restaurant clique.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 },
    );
  });
}

async function addNearbyRestaurants(location) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/places-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ ...location, radiusMiles: 25, maxResults: 80 }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Restaurant search failed");
  const items = (result.places || []).map((place) => ({
    place_id: place.id, name: place.name, cuisine: place.cuisine, address: place.address,
    latitude: place.latitude, longitude: place.longitude, distance_m: Math.round(place.distanceMiles * 1609.344),
    price_level: place.priceLevel, rating: place.rating, open_now: place.openNow, source: "google_places",
    phone: place.phone, website_url: place.website, maps_url: place.mapsUrl, photo_name: place.photoName,
    user_rating_count: place.userRatingCount || 0, serves_breakfast: place.servesBreakfast,
    serves_lunch: place.servesLunch, serves_dinner: place.servesDinner,
  }));
  if (!items.length) throw new Error("No restaurants were found nearby. Try again from another location.");
  const { error } = await supabase.rpc("add_restaurants", { target_clique: clique.id, items });
  if (error) throw error;
}

$("#create-clique").addEventListener("click", async () => {
  setMessage("#home-message", "Finding your location…", true);
  $("#create-clique").disabled = true;
  try {
    const location = await browserLocation();
    const { data, error } = await supabase.rpc("create_clique", {
      display_name: profile.display_name || profile.username,
      clique_title: "Dinner Clique",
      latitude: location.latitude,
      longitude: location.longitude,
      radius_m: 40234,
    });
    if (error) throw error;
    clique = { id: data[0].clique_id, code: data[0].invite_code, isHost: true, status: "lobby" };
    setMessage("#home-message", "Finding nearby restaurants…", true);
    await addNearbyRestaurants(location);
    await loadClique(true);
  } catch (error) {
    setMessage("#home-message", friendlyError(error, error.message || "We couldn't create the clique."));
  } finally { $("#create-clique").disabled = false; }
});

$("#join-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = $("#join-code").value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
  if (code.length !== 6) return setMessage("#home-message", "Enter the complete six-character code.");
  const { data, error } = await supabase.rpc("join_clique", { invite_code: code, display_name: profile.display_name || profile.username });
  if (error) return setMessage("#home-message", friendlyError(error, "We couldn't join that clique."));
  clique = { id: data[0].clique_id, code, isHost: false, status: "lobby" };
  history.replaceState({}, "", `${location.pathname}?invite=${code}`);
  await loadClique(true);
});

$("#resume-clique").addEventListener("click", () => loadClique(true));

function renderMembers(members) {
  const list = $("#member-list");
  list.replaceChildren(...members.map((member) => {
    const item = document.createElement("li");
    item.textContent = member.user_id === session.user.id ? "You" : member.display_name;
    return item;
  }));
}

function preferenceLabel() {
  const meals = preferences.meal_periods?.length
    ? preferences.meal_periods.map((meal) => meal[0].toUpperCase() + meal.slice(1)).join(", ")
    : "Any meal";
  const sorts = { default: "Recommended", distance: "Distance", rating: "Rating", price_low_high: "Price: low to high", name: "Name: A–Z" };
  return `${meals} · ${sorts[preferences.sort_mode] || sorts.default}`;
}

async function loadClique(openPanel = false) {
  if (!clique?.id) return;
  const [{ data, error }, prefResult] = await Promise.all([
    supabase.rpc("get_clique_state", { target_clique: clique.id }),
    supabase.rpc("get_clique_preferences", { target_clique: clique.id }),
  ]);
  if (error) return setMessage("#clique-message", friendlyError(error, "We couldn't refresh this clique."));
  const state = data?.[0];
  if (!state) return;
  clique = { ...clique, code: state.invite_code, isHost: state.is_host, status: state.status, state };
  preferences = prefResult.data?.[0] || preferences;
  restaurants = state.restaurants || [];
  $("#clique-code").textContent = clique.code;
  renderMembers(state.members || []);
  $("#preference-summary").textContent = preferenceLabel();
  $("#start-swiping").disabled = !clique.isHost || !restaurants.length;
  $("#start-swiping").textContent = clique.isHost ? "Start swiping" : "Waiting for host…";
  renderChat(state.messages || []);
  if (openPanel) showPanel(state.status === "swiping" ? "swipe" : "clique");
  if (state.status === "swiping" && !["swipe", "chat", "filters"].some((name) => !$(`#${name}-panel`).classList.contains("hidden"))) showPanel("swipe");
  if (!$("#swipe-panel").classList.contains("hidden")) renderRestaurant();
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => loadClique(false), 2500);
}
function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }

$("#share-clique").addEventListener("click", async () => {
  const url = `${APP_URL}?invite=${clique.code}`;
  const data = { title: "Join my GrubClique", text: `Join my GrubClique with code ${clique.code}`, url };
  if (navigator.share) await navigator.share(data).catch(() => {});
  else { await navigator.clipboard.writeText(`${data.text}: ${url}`); setMessage("#clique-message", "Invite copied to your clipboard.", true); }
});
$("#start-swiping").addEventListener("click", async () => {
  const { error } = await supabase.rpc("start_clique", { target_clique: clique.id });
  if (error) return setMessage("#clique-message", friendlyError(error, "We couldn't start swiping."));
  swipeIndex = 0;
  localStorage.setItem(`grubclique-index-${clique.id}`, "0");
  await loadClique(true);
});
$("#open-chat").addEventListener("click", () => showPanel("chat"));
$("#open-filters").addEventListener("click", () => {
  $$("input[name=meal]").forEach((input) => { input.checked = preferences.meal_periods.includes(input.value); input.disabled = !clique.isHost; });
  $("#sort-mode").value = preferences.sort_mode;
  $("#sort-mode").disabled = !clique.isHost;
  $("#filters-form button[type=submit]").disabled = !clique.isHost;
  $("#filters-owner-note").textContent = clique.isHost ? "These settings are shared with everyone in the clique." : "Only the clique host can change these shared settings.";
  showPanel("filters");
});
$("#reset-filters").addEventListener("click", () => { if (!clique.isHost) return; $$("input[name=meal]").forEach((input) => { input.checked = false; }); $("#sort-mode").value = "default"; });
$("#filters-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const mealPeriods = $$("input[name=meal]:checked").map((input) => input.value);
  const sortMode = $("#sort-mode").value;
  const { error } = await supabase.rpc("set_clique_preferences", { target_clique: clique.id, meal_periods: mealPeriods, sort_mode: sortMode });
  if (error) return alert(friendlyError(error, "We couldn't save those settings."));
  await loadClique(false);
  showPanel("clique");
});

function priceLabel(value) {
  return { PRICE_LEVEL_FREE: "Free", PRICE_LEVEL_INEXPENSIVE: "$", PRICE_LEVEL_MODERATE: "$$", PRICE_LEVEL_EXPENSIVE: "$$$", PRICE_LEVEL_VERY_EXPENSIVE: "$$$$" }[value] || "Price unavailable";
}
function distanceLabel(meters) { return Number.isFinite(meters) ? `${(meters / 1609.344).toFixed(1)} mi` : "Distance unavailable"; }
function renderRestaurant() {
  swipeIndex = Number(localStorage.getItem(`grubclique-index-${clique.id}`) || swipeIndex || 0);
  const restaurant = restaurants[swipeIndex];
  $("#swipe-progress").textContent = `${Math.min(swipeIndex + 1, restaurants.length)}/${restaurants.length}`;
  if (!restaurant) {
    $("#restaurant-name").textContent = "You're all caught up";
    $("#restaurant-meta").textContent = "Wait for your clique's matches or return to the lobby.";
    $("#restaurant-hours").textContent = "";
    $("#restaurant-photo").textContent = "✓";
    $("#restaurant-links").replaceChildren();
    $("#pass").disabled = true; $("#like").disabled = true;
    return;
  }
  $("#pass").disabled = false; $("#like").disabled = false;
  $("#restaurant-photo").textContent = "🍽️";
  $("#restaurant-name").textContent = restaurant.name;
  $("#restaurant-meta").textContent = `${restaurant.cuisine || "Restaurant"} · ${priceLabel(restaurant.price_level)} · ${distanceLabel(restaurant.distance_m)}`;
  $("#restaurant-hours").textContent = restaurant.open_now === true ? "Open now" : restaurant.open_now === false ? "Closed" : "Hours unavailable";
  const links = [{ label: "Maps", value: restaurant.maps_url }, { label: "Website", value: restaurant.website_url }, { label: "Call", value: restaurant.phone ? `tel:${restaurant.phone}` : null }];
  $("#restaurant-links").replaceChildren(...links.flatMap(({ label, value }) => {
    const href = value && safeUrl(value); if (!href) return [];
    const link = document.createElement("a"); link.href = href; link.target = "_blank"; link.rel = "noopener"; link.textContent = label; return [link];
  }));
}

async function recordSwipe(liked) {
  const restaurant = restaurants[swipeIndex];
  if (!restaurant) return;
  $("#pass").disabled = true; $("#like").disabled = true;
  const { data, error } = await supabase.rpc("record_swipe", { target_clique: clique.id, target_restaurant: restaurant.id, liked });
  if (error) { $("#pass").disabled = false; $("#like").disabled = false; return alert("We couldn't save that swipe. Please try again."); }
  swipeIndex += 1;
  localStorage.setItem(`grubclique-index-${clique.id}`, String(swipeIndex));
  if (data?.[0]?.matched) { $("#match-name").textContent = restaurant.name; $("#match-card").classList.remove("hidden"); }
  renderRestaurant();
}
$("#pass").addEventListener("click", () => recordSwipe(false));
$("#like").addEventListener("click", () => recordSwipe(true));
$("#dismiss-match").addEventListener("click", () => $("#match-card").classList.add("hidden"));

function renderChat(messages) {
  const list = $("#chat-list");
  list.replaceChildren(...messages.map((message) => {
    const bubble = document.createElement("div"); bubble.className = `chat-bubble${message.sender_id === session.user.id ? " sent" : ""}`;
    const sender = document.createElement("strong"); sender.textContent = message.sender_id === session.user.id ? "You" : message.sender_name;
    const body = document.createElement("span"); body.textContent = message.body;
    bubble.append(sender, body); return bubble;
  }));
  list.scrollTop = list.scrollHeight;
}
$("#chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = $("#chat-input").value.trim(); if (!body) return;
  const { error } = await supabase.rpc("send_clique_message", { target_clique: clique.id, message_body: body });
  if (error) return alert("We couldn't send that message.");
  $("#chat-input").value = ""; await loadClique(false);
});

async function loadHistory() {
  const { data, error } = await supabase.rpc("list_match_history_v2");
  if (error) return setMessage("#history-message", "We couldn't load your history.");
  const list = $("#history-list");
  if (!data.length) { list.textContent = "No saved matches yet. Your next shared match will appear here."; $("#clear-history").disabled = true; return; }
  $("#clear-history").disabled = false;
  list.replaceChildren(...data.map((entry) => {
    const card = document.createElement("article"); card.className = "history-card";
    const copy = document.createElement("div"); const title = document.createElement("h2"); title.textContent = entry.name;
    const meta = document.createElement("p"); meta.className = "muted"; meta.textContent = `${entry.cuisine || "Restaurant"} · ${new Date(entry.matched_at).toLocaleDateString()}`; copy.append(title, meta);
    const remove = document.createElement("button"); remove.className = "danger-text"; remove.type = "button"; remove.textContent = "Remove";
    remove.addEventListener("click", async () => { if (!confirm(`Remove ${entry.name} from your history?`)) return; const result = await supabase.rpc("hide_match_history_item", { target_match: entry.match_id }); if (result.error) alert("We couldn't remove that match."); else loadHistory(); });
    card.append(copy, remove); return card;
  }));
}
$("#clear-history").addEventListener("click", async () => { if (!confirm("Clear your entire match history on all devices? Other members keep their own history.")) return; const { error } = await supabase.rpc("clear_match_history"); if (error) setMessage("#history-message", "We couldn't clear your history."); else loadHistory(); });

$("#delete-account").addEventListener("click", async () => {
  if (!confirm("Permanently delete your GrubClique account and account data? This cannot be undone.")) return;
  $("#delete-account").disabled = true;
  const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` } });
  if (!response.ok) { $("#delete-account").disabled = false; return setMessage("#settings-message", "We couldn't delete your account. Please try again."); }
  await supabase.auth.signOut();
});

$$(".tab-bar button").forEach((button) => button.addEventListener("click", async () => { const view = button.dataset.view; if (view === "history") await loadHistory(); showPanel(view); }));
$$(".back-home").forEach((button) => button.addEventListener("click", () => showPanel("home")));
$$(".back-clique").forEach((button) => button.addEventListener("click", () => showPanel("clique")));

window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPrompt = event; $("#install-app").classList.remove("hidden"); });
$("#install-app").addEventListener("click", async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $("#install-app").classList.add("hidden"); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js");

supabase.auth.onAuthStateChange((_event, nextSession) => {
  const changed = session?.user?.id !== nextSession?.user?.id;
  session = nextSession;
  if (changed) setTimeout(() => nextSession ? enterApp().catch((error) => setMessage("#auth-message", friendlyError(error, "We couldn't load your account."))) : leaveApp(), 0);
});

restoreSession().catch((error) => {
  $("#connection-status").textContent = "Connection problem";
  setMessage("#auth-message", friendlyError(error, "We couldn't connect to GrubClique."));
});
