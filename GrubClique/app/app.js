import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.55.0/+esm";
import { parsePhoneNumberFromString, getCountries, getCountryCallingCode } from "https://cdn.jsdelivr.net/npm/libphonenumber-js@1.12.24/+esm";

const SUPABASE_URL = "https://msowbrvpziigoqlpqfuu.supabase.co";
const SUPABASE_KEY = "sb_publishable_P2OwC3HhT1lj75Lq7dQkDw_k6zDJGEb";
const APP_URL = "https://redxjak.com/GrubClique/app/";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const panels = ["onboarding", "home", "cliques", "setup", "group", "huntsetup", "clique", "filters", "swipe", "chat", "friends", "history", "settings"];
let session = null;
let profile = null;
let group = null;
let clique = null;
let preferences = { meal_periods: [], sort_mode: "default" };
let localFilters = { cuisine: "Any", maxPrice: 4, maxDistance: 50, minimumRating: 0, openNowOnly: false };
let restaurants = [];
let swipeIndex = 0;
let selectedLocation = null;
let editingHuntLocation = false;
let pendingAvatar = null;
let pollTimer = null;
let creatingAccount = false;
let installPrompt = null;

function showPanel(name) {
  panels.forEach((panel) => $(`#${panel}-panel`)?.classList.toggle("hidden", panel !== name));
  $(".tab-bar").classList.toggle("hidden", name === "onboarding");
  $$(".tab-bar button").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  if (["clique", "swipe", "chat"].includes(name) && clique) startPolling(); else stopPolling();
  window.scrollTo({ top: 0, behavior: "smooth" });
  window.RedxjakAnalytics?.track("screen_viewed", {}, { screen: `/GrubClique/app/${name}` });
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
  if (value.includes("only the clique admin")) return "Only the Clique admin can make that change.";
  if (value.includes("only accepted friends")) return "Add and accept this person as a friend before adding them to the Clique.";
  if (value.includes("two active GrubHunts")) return "This Clique already has the maximum of two active GrubHunts.";
  if (value.includes("already has an active")) return "This Clique already has an active GrubHunt.";
  if (value.includes("authentication")) return "Your session expired. Please sign in again.";
  return fallback;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:", "tel:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function setAvatar(element, value) {
  const avatar = typeof element === "string" ? $(element) : element;
  const image = value?.startsWith("data:image/") ? value : value && safeUrl(value);
  avatar.style.backgroundImage = image ? `url("${image.replaceAll('"', '%22')}")` : "";
  avatar.textContent = image ? "" : "GC";
  avatar.classList.toggle("has-image", Boolean(image));
}

function refreshAccountControls() {
  $("#username-display").textContent = profile?.username || "";
  $("#display-name").value = profile?.display_name || "";
  $("#match-notifications").checked = localStorage.getItem("grubclique-match-notifications") !== "false";
  $("#contact-phone").value = localStorage.getItem("grubclique-contact-phone") || "";
  pendingAvatar = localStorage.getItem("grubclique-profile-picture") || profile?.avatar_url || null;
  setAvatar("#account-avatar", pendingAvatar);
  setAvatar(".welcome-row .avatar", pendingAvatar);
}

async function ensureProfile() {
  const { data, error } = await supabase.rpc("get_my_profile");
  if (error) throw error;
  profile = data?.[0] || null;
  if (!profile?.onboarding_completed) return false;
  $("#profile-name").textContent = profile.display_name;
  $("#profile-username").textContent = `@${profile.username}`;
  $("#account-email").textContent = session.user.email || "Google account";
  refreshAccountControls();
  return true;
}

async function enterApp() {
  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  $("#sign-out").classList.remove("hidden");
  $("#connection-status").textContent = "Connected";
  const profileReady = await ensureProfile();
  if (!profileReady) {
    $("#onboarding-display-name").value = profile?.display_name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || "";
    $("#onboarding-username").value = "";
    $("#onboarding-phone").value = "";
    showPanel("onboarding");
    return;
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
  if (result.error) {
    window.RedxjakAnalytics?.track("authentication_completed", { method: creatingAccount ? "email_signup" : "email", outcome: "failure" });
    return setMessage("#auth-message", friendlyError(result.error, "We couldn't complete that request. Please try again."));
  }
  window.RedxjakAnalytics?.track("authentication_completed", { method: creatingAccount ? "email_signup" : "email", outcome: "success" });
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

async function searchNearbyRestaurants(location, radiusMiles) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/places-search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ ...location, radiusMiles, maxResults: 80 }),
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
  return { items, searchCenter: result.searchCenter || location };
}

async function addNearbyRestaurants(items) {
  const { error } = await supabase.rpc("add_restaurants", { target_clique: clique.id, items });
  if (error) throw error;
}

$("#create-clique").addEventListener("click", () => {
  setMessage("#home-message");
  $("#clique-name").value = "";
  showPanel("setup");
});
$("#setup-radius").addEventListener("input", () => { $("#setup-radius-label").textContent = $("#setup-radius").value; });
$("#use-location").addEventListener("click", async () => {
  setMessage("#hunt-setup-message", "Finding your location…", true);
  $("#use-location").disabled = true;
  try {
    selectedLocation = await browserLocation();
    $("#search-area").value = "Current location";
    setMessage("#hunt-setup-message", "Current location selected.", true);
  } catch (error) {
    setMessage("#hunt-setup-message", error.message || "We couldn't get your location.");
  } finally { $("#use-location").disabled = false; }
});
$("#search-area").addEventListener("input", () => { if ($("#search-area").value !== "Current location") selectedLocation = null; });
$("#setup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const cliqueName = $("#clique-name").value.trim();
  if (!cliqueName) return setMessage("#setup-message", "Enter a name for your Clique.");
  const submit = $("#setup-form button[type=submit]");
  submit.disabled = true; setMessage("#setup-message", "Creating Clique…", true);
  const { data, error } = await supabase.rpc("create_friend_clique", { clique_name: cliqueName });
  submit.disabled = false;
  if (error) return setMessage("#setup-message", friendlyError(error, "We couldn't create the Clique."));
  group = { id: data[0].friend_clique_id, code: data[0].invite_code, name: cliqueName, isAdmin: true };
  setMessage("#setup-message");
  await loadGroup(true);
});

function prepareHuntLocationForm(editing = false) {
  editingHuntLocation = editing;
  selectedLocation = null; $("#search-area").value = ""; $("#setup-radius").value = "25"; $("#setup-radius-label").textContent = "25";
  if (editing) {
    $("#search-area").value = clique.state?.search_area || "";
    const miles = Math.max(1, Math.min(50, Math.round(Number(clique.state?.radius_m || 40234) / 1609.344)));
    $("#setup-radius").value = String(miles); $("#setup-radius-label").textContent = String(miles);
  }
  $("#hunt-setup-eyebrow").textContent = editing ? "Current GrubHunt" : "New GrubHunt";
  $("#hunt-setup-title").textContent = editing ? "Edit location" : "Choose where to hunt";
  $("#hunt-setup-submit").textContent = editing ? "Update location" : "Create GrubHunt";
  setMessage("#hunt-setup-message"); showPanel("huntsetup");
}

$("#new-grub-hunt").addEventListener("click", async () => {
  const activeCount = (group.state?.grub_hunts || []).filter((hunt) => hunt.status === "lobby" || hunt.status === "swiping").length;
  if (activeCount >= 2) return;
  prepareHuntLocationForm(false);
});

$("#hunt-setup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const area = $("#search-area").value.trim();
  const radiusMiles = Number($("#setup-radius").value);
  if (!selectedLocation && !area) return setMessage("#hunt-setup-message", "Enter an area or choose your current location.");
  setMessage("#hunt-setup-message", "Finding nearby restaurants…", true);
  const submit = $("#hunt-setup-form button[type=submit]");
  submit.disabled = true;
  try {
    const search = await searchNearbyRestaurants(selectedLocation || { searchArea: area }, radiusMiles);
    const location = search.searchCenter;
    if (editingHuntLocation) {
      if (clique.status === "swiping" && !confirm("Changing the location will clear everyone's current swipes and matches and return this GrubHunt to the lobby. Continue?")) return;
      const { error } = await supabase.rpc("replace_grub_hunt_location", {
        target_clique: clique.id, latitude: location.latitude, longitude: location.longitude,
        radius_m: Math.round(radiusMiles * 1609.344), search_area: area === "Current location" ? null : area,
        items: search.items,
      });
      if (error) throw error;
      swipeIndex = 0;
      localStorage.setItem(`grubclique-index-${clique.id}`, "0");
      clique.status = "lobby";
      editingHuntLocation = false;
      setMessage("#hunt-setup-message");
      await loadClique(true);
      return;
    }
    const { data, error } = await supabase.rpc("create_grub_hunt", {
      target_friend_clique: group.id,
      latitude: location.latitude,
      longitude: location.longitude,
      radius_m: Math.round(radiusMiles * 1609.344),
      search_area: area === "Current location" ? null : area,
    });
    if (error) throw error;
    clique = { id: data[0].grub_hunt_id, isHost: true, status: "lobby" };
    await addNearbyRestaurants(search.items);
    window.RedxjakAnalytics?.track("clique_created");
    setMessage("#hunt-setup-message");
    await loadClique(true);
  } catch (error) {
    setMessage("#hunt-setup-message", friendlyError(error, error.message || "We couldn't create the GrubHunt."));
  } finally { submit.disabled = false; }
});

$("#join-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = $("#join-code").value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
  if (code.length !== 6) return setMessage("#home-message", "Enter the complete six-character code.");
  const { data, error } = await supabase.rpc("join_friend_clique", { target_invite_code: code });
  if (error) return setMessage("#home-message", friendlyError(error, "We couldn't join that clique."));
  group = { id: data[0].friend_clique_id, code, name: data[0].clique_name, isAdmin: false };
  window.RedxjakAnalytics?.track("clique_joined");
  history.replaceState({}, "", `${location.pathname}?invite=${code}`);
  await loadGroup(true);
});

function grubHuntStatusLabel(status) {
  return { lobby: "Lobby", swiping: "In progress", finished: "Completed" }[status] || "GrubHunt";
}

async function loadCliques() {
  setMessage("#cliques-message", "Loading Cliques…", true);
  const { data, error } = await supabase.rpc("list_friend_cliques");
  if (error) return setMessage("#cliques-message", "We couldn't load your cliques right now.");
  const entries = data || [];
  const list = $("#cliques-list");
  if (!entries.length) {
    list.textContent = "You haven't joined a clique yet. Create one or use an invite code from Home.";
    return setMessage("#cliques-message");
  }
  list.replaceChildren(...entries.map((entry) => {
    const card = document.createElement("article"); card.className = "history-card session-card";
    const copy = document.createElement("div");
    const title = document.createElement("h2"); title.textContent = entry.clique_name;
    const meta = document.createElement("p"); meta.className = "muted";
    meta.textContent = `${entry.member_count} member${Number(entry.member_count) === 1 ? "" : "s"} · ${entry.active_status ? `${grubHuntStatusLabel(entry.active_status)} GrubHunt` : "No active GrubHunt"}`;
    copy.append(title, meta);
    const open = document.createElement("button"); open.className = "secondary-button compact-button"; open.type = "button";
    open.textContent = "Open";
    open.addEventListener("click", async () => {
      group = { id: entry.friend_clique_id, code: entry.invite_code, name: entry.clique_name, isAdmin: entry.is_admin };
      await loadGroup(true);
    });
    const actions = document.createElement("div"); actions.className = "session-actions"; actions.append(open);
    card.append(copy, actions); return card;
  }));
  setMessage("#cliques-message");
}

$("#cliques-create").addEventListener("click", () => { $("#clique-name").value = ""; showPanel("setup"); });

function renderMembers(members) {
  const list = $("#member-list");
  list.replaceChildren(...members.map((member) => {
    const item = document.createElement("li");
    item.textContent = member.user_id === session.user.id ? "You" : member.display_name;
    return item;
  }));
}

function renderGroupMembers(members) {
  const list = $("#group-member-list");
  list.replaceChildren(...members.map((member) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = `${member.user_id === session.user.id ? "You" : member.display_name}${member.is_admin ? " · Admin" : ""}${member.username ? ` · @${member.username}` : ""}`;
    item.append(label);
    if (group.isAdmin && !member.is_admin) {
      const remove = document.createElement("button"); remove.className = "danger-text"; remove.type = "button"; remove.textContent = "Remove";
      remove.addEventListener("click", async () => {
        if (!confirm(`Remove ${member.display_name} from ${group.name}? They will lose access to the active GrubHunt but keep their earlier GrubHunt history.`)) return;
        const { error } = await supabase.rpc("remove_friend_from_clique", { target_friend_clique: group.id, target_user: member.user_id });
        if (error) return setMessage("#group-message", friendlyError(error, "We couldn't remove that member."));
        await loadGroup(false);
      });
      item.append(remove);
    }
    return item;
  }));
}

async function openGrubHunt(entry) {
  clique = { id: entry.id, status: entry.status, isHost: true };
  await loadClique(true);
}

async function loadGroup(openPanel = false) {
  if (!group?.id) return;
  const { data, error } = await supabase.rpc("get_friend_clique_state", { target_friend_clique: group.id });
  if (error) return setMessage("#group-message", friendlyError(error, "We couldn't refresh this Clique."));
  const state = data?.[0]; if (!state) return;
  group = { ...group, id: state.friend_clique_id, code: state.invite_code, name: state.clique_name, isAdmin: state.is_admin, state };
  $("#group-name").textContent = group.name;
  $("#group-code").textContent = `Invite code ${group.code}`;
  renderGroupMembers(state.members || []);
  $("#manage-members-form").classList.toggle("hidden", !group.isAdmin);
  $("#rename-clique").classList.toggle("hidden", !group.isAdmin);
  $("#leave-group").classList.remove("hidden");
  $("#delete-group").classList.toggle("hidden", !group.isAdmin);
  const hunts = state.grub_hunts || [];
  const active = hunts.filter((hunt) => hunt.status === "lobby" || hunt.status === "swiping");
  $("#active-hunt-summary").textContent = active.length ? `${active.length} of 2 active GrubHunts` : "No active GrubHunt.";
  $("#new-grub-hunt").disabled = active.length >= 2;
  $("#new-grub-hunt").textContent = active.length >= 2 ? "Two active GrubHunts (maximum)" : "Start a new GrubHunt";
  const list = $("#grub-hunts-list");
  if (!hunts.length) list.textContent = "No GrubHunts yet. Any member can start the first one.";
  else list.replaceChildren(...hunts.map((hunt) => {
    const card = document.createElement("article"); card.className = "history-card session-card";
    const copy = document.createElement("div"); const title = document.createElement("h2"); title.textContent = "GrubHunt";
    const meta = document.createElement("p"); meta.className = "muted"; meta.textContent = `${grubHuntStatusLabel(hunt.status)} · ${new Date(hunt.created_at).toLocaleDateString()} · ${hunt.started_by || "Member"}`;
    copy.append(title, meta);
    const open = document.createElement("button"); open.className = "secondary-button compact-button"; open.type = "button"; open.textContent = hunt.status === "finished" ? "View" : "Open";
    open.addEventListener("click", () => openGrubHunt(hunt)); card.append(copy, open); return card;
  }));
  if (openPanel) showPanel("group");
}

$("#manage-members-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const username = $("#clique-friend-username").value.trim().replace(/^@/, "").toLowerCase();
  if (!username) return setMessage("#group-message", "Enter a friend's username.");
  const { error } = await supabase.rpc("add_friend_to_clique", { target_friend_clique: group.id, target_username: username });
  if (error) return setMessage("#group-message", friendlyError(error, error.message || "We couldn't add that friend."));
  $("#clique-friend-username").value = ""; setMessage("#group-message", "Friend added to the Clique.", true); await loadGroup(false);
});

$("#rename-clique").addEventListener("click", async () => {
  const name = prompt("Rename this Clique", group.name)?.trim();
  if (!name || name === group.name) return;
  if (name.length > 40) return setMessage("#group-message", "Clique names can be up to 40 characters.");
  const { error } = await supabase.rpc("rename_friend_clique", { target_friend_clique: group.id, clique_name: name });
  if (error) return setMessage("#group-message", friendlyError(error, "We couldn't rename that Clique."));
  group.name = name;
  setMessage("#group-message", "Clique renamed.", true);
  await loadGroup(false);
});

$("#share-clique").addEventListener("click", async () => {
  const url = `${APP_URL}?invite=${group.code}`;
  const data = { title: `Join ${group.name} on GrubClique`, text: `Join ${group.name} with code ${group.code}`, url };
  if (navigator.share) await navigator.share(data).catch(() => {});
  else { await navigator.clipboard.writeText(`${data.text}: ${url}`); setMessage("#group-message", "Clique invite copied.", true); }
});

$("#leave-group").addEventListener("click", async () => {
  const transfer = group.isAdmin && (group.state?.members?.length || 0) > 1 ? " The longest-standing remaining member will become the admin." : "";
  if (!confirm(`Leave ${group.name}? You will lose access to its active GrubHunt. Your earlier GrubHunt history will remain in Matches.${transfer}`)) return;
  const { error } = await supabase.rpc("leave_friend_clique", { target_friend_clique: group.id });
  if (error) return setMessage("#group-message", friendlyError(error, "We couldn't leave this Clique."));
  group = null; clique = null; restaurants = []; await loadCliques(); showPanel("cliques");
});

function preferenceLabel() {
  const meals = preferences.meal_periods?.length
    ? preferences.meal_periods.map((meal) => meal[0].toUpperCase() + meal.slice(1)).join(", ")
    : "Any meal";
  const sorts = { default: "Recommended", distance: "Distance", rating: "Rating", price_low_high: "Price: low to high", name: "Name: A–Z" };
  const local = [localFilters.cuisine, `up to ${"$".repeat(localFilters.maxPrice)}`, `within ${localFilters.maxDistance} mi`];
  if (localFilters.minimumRating) local.push(`${localFilters.minimumRating.toFixed(1)}★+`);
  if (localFilters.openNowOnly) local.push("open now");
  return `${meals} · ${sorts[preferences.sort_mode] || sorts.default} · ${local.join(" · ")}`;
}

function priceLevelNumber(value) {
  return { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 }[value] ?? 0;
}

function filteredRestaurants() {
  const meals = preferences.meal_periods || [];
  const filtered = restaurants.filter((restaurant) => {
    const servesMeal = !meals.length || meals.some((meal) => restaurant[`serves_${meal}`] === true);
    return (localFilters.cuisine === "Any" || restaurant.cuisine === localFilters.cuisine)
      && (priceLevelNumber(restaurant.price_level) === 0 || priceLevelNumber(restaurant.price_level) <= localFilters.maxPrice)
      && (!Number.isFinite(restaurant.distance_m) || restaurant.distance_m / 1609.344 <= localFilters.maxDistance)
      && (Number(restaurant.rating) || 0) >= localFilters.minimumRating
      && (!localFilters.openNowOnly || restaurant.open_now === true)
      && servesMeal;
  });
  const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  const sorts = {
    distance: (a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity) || byName(a, b),
    rating: (a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0) || (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity),
    price_low_high: (a, b) => (priceLevelNumber(a.price_level) || Infinity) - (priceLevelNumber(b.price_level) || Infinity) || byName(a, b),
    name: byName,
  };
  return sorts[preferences.sort_mode] ? [...filtered].sort(sorts[preferences.sort_mode]) : filtered;
}

function refreshCuisineOptions() {
  const selected = localFilters.cuisine;
  const cuisines = [...new Set(restaurants.map((restaurant) => restaurant.cuisine).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  $("#cuisine-filter").replaceChildren(...["Any", ...cuisines].map((value) => {
    const option = document.createElement("option"); option.value = value; option.textContent = value; return option;
  }));
  $("#cuisine-filter").value = cuisines.includes(selected) ? selected : "Any";
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
  const poolKey = `grubclique-pool-${clique.id}`;
  const poolFingerprint = `${restaurants.length}:${restaurants[0]?.id || 0}:${restaurants.at(-1)?.id || 0}`;
  const previousPool = localStorage.getItem(poolKey);
  if (previousPool && previousPool !== poolFingerprint) {
    swipeIndex = 0;
    localStorage.setItem(`grubclique-index-${clique.id}`, "0");
    $("#undo-swipe").disabled = true;
  }
  localStorage.setItem(poolKey, poolFingerprint);
  refreshCuisineOptions();
  $("#clique-code").textContent = `${group?.name || "Clique"} GrubHunt`;
  renderMembers(state.members || []);
  $("#preference-summary").textContent = preferenceLabel();
  const swipeButton = $("#start-swiping");
  const hasRestaurants = filteredRestaurants().length > 0;
  if (state.status === "swiping") {
    swipeButton.disabled = !hasRestaurants;
    swipeButton.textContent = "Continue swiping";
  } else if (state.status === "finished") {
    swipeButton.disabled = true;
    swipeButton.textContent = "GrubHunt completed";
  } else {
    swipeButton.disabled = !hasRestaurants;
    swipeButton.textContent = "Start swiping";
  }
  $("#end-clique").classList.toggle("hidden", state.status === "finished");
  $("#edit-hunt-location").classList.toggle("hidden", state.status === "finished" || !state.is_host);
  renderChat(state.messages || []);
  if (openPanel) showPanel("clique");
  if (!$("#swipe-panel").classList.contains("hidden")) renderRestaurant();
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => loadClique(false), 2500);
}
function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }

$("#start-swiping").addEventListener("click", async () => {
  if (clique.status === "finished") return;
  if (clique.status === "lobby") {
    const { error } = await supabase.rpc("start_clique", { target_clique: clique.id });
    if (error) return setMessage("#clique-message", friendlyError(error, "We couldn't start swiping."));
    swipeIndex = 0;
    localStorage.setItem(`grubclique-index-${clique.id}`, "0");
    window.RedxjakAnalytics?.track("clique_started");
    await loadClique(false);
  }
  $("#undo-swipe").disabled = Number(localStorage.getItem(`grubclique-index-${clique.id}`) || 0) < 1;
  showPanel("swipe");
  renderRestaurant();
});
$("#start-over").addEventListener("click", () => {
  swipeIndex = 0;
  localStorage.setItem(`grubclique-index-${clique.id}`, "0");
  $("#undo-swipe").disabled = true;
  showPanel("swipe");
  renderRestaurant();
});
async function endClique(targetClique, title) {
  if (!confirm(`End this GrubHunt? Members will no longer be able to continue swiping. Matches and chat history will be preserved.`)) return;
  const { error } = await supabase.rpc("finish_clique", { target_clique: targetClique });
  if (error) return alert(friendlyError(error, "We couldn't complete that GrubHunt. Please try again."));
  if (clique?.id === targetClique) { stopPolling(); clique.status = "finished"; }
  window.RedxjakAnalytics?.track("clique_finished");
  await loadGroup(true);
}
$("#end-clique").addEventListener("click", () => endClique(clique.id));
$("#edit-hunt-location").addEventListener("click", () => prepareHuntLocationForm(true));
$("#open-chat").addEventListener("click", () => showPanel("chat"));
$("#open-filters").addEventListener("click", () => {
  $$("input[name=meal]").forEach((input) => { input.checked = preferences.meal_periods.includes(input.value); input.disabled = !clique.isHost; });
  $("#sort-mode").value = preferences.sort_mode;
  $("#sort-mode").disabled = !clique.isHost;
  $("#filters-form button[type=submit]").disabled = false;
  $("#cuisine-filter").value = localFilters.cuisine;
  $$('input[name="max-price"]').forEach((input) => { input.checked = Number(input.value) === localFilters.maxPrice; });
  $("#distance-filter").value = localFilters.maxDistance;
  $("#distance-filter-label").textContent = localFilters.maxDistance;
  $("#rating-filter").value = localFilters.minimumRating;
  $("#rating-filter-label").textContent = localFilters.minimumRating ? `Rating ${localFilters.minimumRating.toFixed(1)} or higher` : "Any rating";
  $("#open-filter").checked = localFilters.openNowOnly;
  $("#filters-owner-note").textContent = clique.isHost ? "Meal and sorting are shared with everyone. The other filters only change your list." : "The host controls meal and sorting. The other filters only change your list.";
  showPanel("filters");
});
$("#distance-filter").addEventListener("input", () => { $("#distance-filter-label").textContent = $("#distance-filter").value; });
$("#rating-filter").addEventListener("input", () => { const value = Number($("#rating-filter").value); $("#rating-filter-label").textContent = value ? `Rating ${value.toFixed(1)} or higher` : "Any rating"; });
$("#reset-filters").addEventListener("click", () => {
  $("#cuisine-filter").value = "Any";
  $$('input[name="max-price"]').forEach((input) => { input.checked = input.value === "4"; });
  $("#distance-filter").value = "50"; $("#distance-filter-label").textContent = "50";
  $("#rating-filter").value = "0"; $("#rating-filter-label").textContent = "Any rating";
  $("#open-filter").checked = false;
  if (clique.isHost) { $$("input[name=meal]").forEach((input) => { input.checked = false; }); $("#sort-mode").value = "default"; }
});
$("#filters-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  localFilters = {
    cuisine: $("#cuisine-filter").value,
    maxPrice: Number($("input[name=max-price]:checked").value),
    maxDistance: Number($("#distance-filter").value),
    minimumRating: Number($("#rating-filter").value),
    openNowOnly: $("#open-filter").checked,
  };
  swipeIndex = 0;
  localStorage.setItem(`grubclique-index-${clique.id}`, "0");
  $("#undo-swipe").disabled = true;
  const mealPeriods = $$("input[name=meal]:checked").map((input) => input.value);
  const sortMode = $("#sort-mode").value;
  if (clique.isHost) {
    const { error } = await supabase.rpc("set_clique_preferences", { target_clique: clique.id, meal_periods: mealPeriods, sort_mode: sortMode });
    if (error) return alert(friendlyError(error, "We couldn't save those settings."));
    preferences = { meal_periods: mealPeriods, sort_mode: sortMode };
  }
  $("#preference-summary").textContent = preferenceLabel();
  showPanel("swipe");
  renderRestaurant();
});

function priceLabel(value) {
  return { PRICE_LEVEL_FREE: "Free", PRICE_LEVEL_INEXPENSIVE: "$", PRICE_LEVEL_MODERATE: "$$", PRICE_LEVEL_EXPENSIVE: "$$$", PRICE_LEVEL_VERY_EXPENSIVE: "$$$$" }[value] || "Price unavailable";
}
function distanceLabel(meters) { return Number.isFinite(meters) ? `${(meters / 1609.344).toFixed(1)} mi` : "Distance unavailable"; }
function renderRestaurant() {
  const visibleRestaurants = filteredRestaurants();
  swipeIndex = Number(localStorage.getItem(`grubclique-index-${clique.id}`) || swipeIndex || 0);
  const restaurant = visibleRestaurants[swipeIndex];
  $("#swipe-progress").textContent = `${Math.min(swipeIndex + 1, visibleRestaurants.length)}/${visibleRestaurants.length}`;
  if (!restaurant) {
    $("#restaurant-name").textContent = "You're all caught up";
    $("#restaurant-meta").textContent = visibleRestaurants.length ? "Wait for your clique's matches or return to the lobby." : "No restaurants match those filters. Change your filters to see more.";
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
  const links = [{ label: "Maps", value: restaurant.maps_url }, { label: "Website", value: restaurant.website_url }, { label: "Call", value: restaurant.phone ? `tel:${restaurant.phone}` : null }, { label: "Menu", value: restaurant.menu_url }];
  $("#restaurant-links").replaceChildren(...links.flatMap(({ label, value }) => {
    const href = value && safeUrl(value); if (!href) return [];
    const link = document.createElement("a"); link.href = href; link.target = "_blank"; link.rel = "noopener"; link.textContent = label; return [link];
  }));
}

async function recordSwipe(liked) {
  const restaurant = filteredRestaurants()[swipeIndex];
  if (!restaurant) return;
  $("#pass").disabled = true; $("#like").disabled = true;
  const { data, error } = await supabase.rpc("record_swipe", { target_clique: clique.id, target_restaurant: restaurant.id, liked });
  if (error) { $("#pass").disabled = false; $("#like").disabled = false; return alert("We couldn't save that swipe. Please try again."); }
  window.RedxjakAnalytics?.track("swipe_recorded", { liked });
  swipeIndex += 1;
  localStorage.setItem(`grubclique-index-${clique.id}`, String(swipeIndex));
  $("#undo-swipe").disabled = false;
  if (data?.[0]?.matched) {
    window.RedxjakAnalytics?.track("match_found");
    $("#match-name").textContent = restaurant.name;
    $("#match-card").classList.remove("hidden");
    if ("Notification" in window && localStorage.getItem("grubclique-match-notifications") !== "false" && Notification.permission === "granted") {
      new Notification("GrubClique match!", { body: `${restaurant.name} is everyone's pick.`, icon: "../assets/app-icon.png" });
    }
  }
  renderRestaurant();
}
$("#pass").addEventListener("click", () => recordSwipe(false));
$("#like").addEventListener("click", () => recordSwipe(true));
$("#swipe-chat").addEventListener("click", () => showPanel("chat"));
$("#undo-swipe").addEventListener("click", async () => {
  $("#undo-swipe").disabled = true;
  const { data, error } = await supabase.rpc("undo_last_swipe", { target_clique: clique.id });
  if (error) { $("#undo-swipe").disabled = false; return alert("We couldn't undo that swipe. Please try again."); }
  if (!data?.length) return;
  swipeIndex = Math.max(0, swipeIndex - 1);
  localStorage.setItem(`grubclique-index-${clique.id}`, String(swipeIndex));
  $("#match-card").classList.add("hidden");
  renderRestaurant();
});

$("#delete-group").addEventListener("click", async () => {
  if (!confirm(`Permanently delete ${group.name}? This removes the Clique and all of its GrubHunts, messages, swipes, and shared match history for every member. This cannot be undone.`)) return;
  const typedName = prompt(`Type ${group.name} to confirm deletion.`);
  if (typedName !== group.name) return setMessage("#group-message", "Clique deletion canceled. The name did not match.");
  const { error } = await supabase.rpc("delete_friend_clique", { target_friend_clique: group.id });
  if (error) return setMessage("#group-message", friendlyError(error, "We couldn't delete this Clique."));
  group = null; clique = null; restaurants = []; await loadCliques(); showPanel("cliques");
});
$("#dismiss-match").addEventListener("click", () => $("#match-card").classList.add("hidden"));
$("#swipe-filters").addEventListener("click", () => $("#open-filters").click());
$("#match-chat").addEventListener("click", () => { $("#match-card").classList.add("hidden"); showPanel("chat"); });
$("#finish-session").addEventListener("click", () => { $("#match-card").classList.add("hidden"); showPanel("clique"); });

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

function friendError(error) {
  const value = String(error?.message || error || "").toLowerCase();
  if (value.includes("cannot add yourself")) return "You can't add yourself.";
  if (value.includes("not found")) return "We couldn't find a GrubClique account with that information.";
  if (value.includes("already")) return "That person is already a friend or has a pending request.";
  return "We couldn't send that friend request. Please try again.";
}

function renderFriends(friends) {
  const list = $("#friends-list");
  if (!friends.length) { list.textContent = "No friends or pending requests yet."; return; }
  list.replaceChildren(...friends.map((friend) => {
    const card = document.createElement("article"); card.className = "history-card friend-card";
    const copy = document.createElement("div");
    const title = document.createElement("h2"); title.textContent = friend.display_name;
    const meta = document.createElement("p"); meta.className = "muted"; meta.textContent = `@${friend.username}`;
    copy.append(title, meta);
    const status = document.createElement(friend.status === "accepted" ? "span" : friend.incoming ? "button" : "span");
    status.textContent = friend.status === "accepted" ? "Friend ✓" : friend.incoming ? "Accept" : "Requested";
    if (status.tagName === "BUTTON") {
      status.type = "button"; status.className = "text-button";
      status.addEventListener("click", async () => { await sendFriendRequest(friend.username); });
    } else status.className = friend.status === "accepted" ? "success-label" : "muted";
    card.append(copy, status); return card;
  }));
}

async function loadFriends() {
  const { data, error } = await supabase.rpc("list_friends");
  if (error) return setMessage("#friends-message", "We couldn't load your friends.");
  renderFriends(data || []);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizePhone(value, region) {
  const phone = parsePhoneNumberFromString(value.trim(), region);
  return phone?.isValid() ? phone.number : null;
}

async function phoneHashes(canonical) {
  const values = [{ scheme: "e164_v1", hash: await sha256(canonical) }];
  const digits = canonical.replace(/\D/g, "");
  if (canonical.startsWith("+1") && digits.length === 11) values.push({ scheme: "legacy_last10_v1", hash: await sha256(digits.slice(-10)) });
  return values;
}

async function sendFriendRequest(entered) {
  const value = entered.trim(); if (!value) return;
  setMessage("#friends-message", "Sending request…", true);
  const digits = value.replace(/\D/g, "");
  const looksLikePhone = digits.length >= 7 && /^[\d\s+().-]+$/.test(value);
  let phone_hashes = [];
  let lookup_value = value.replace(/^@/, "").toLowerCase();
  if (looksLikePhone) {
    const canonical = normalizePhone(value, $("#phone-country").value);
    if (!canonical) return setMessage("#friends-message", "Enter a complete phone number, including the country code when needed.");
    phone_hashes = await phoneHashes(canonical); lookup_value = "";
  }
  const { error } = await supabase.rpc("request_friend_v2", { lookup_value, phone_hashes });
  if (error) return setMessage("#friends-message", friendError(error));
  setMessage("#friends-message", "Friend request updated.", true);
  $("#friend-query").value = "";
  await loadFriends();
}

$("#friend-form").addEventListener("submit", async (event) => { event.preventDefault(); await sendFriendRequest($("#friend-query").value); });

function populateCountries() {
  const names = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames([navigator.language], { type: "region" }) : null;
  const options = getCountries().map((region) => ({ region, label: `${names?.of(region) || region} (+${getCountryCallingCode(region)})` })).sort((a, b) => a.label.localeCompare(b.label));
  const region = navigator.language?.split("-")[1]?.toUpperCase();
  ["#phone-country", "#onboarding-country"].forEach((selector) => {
    $(selector).replaceChildren(...options.map(({ region: code, label }) => { const option = document.createElement("option"); option.value = code; option.textContent = label; return option; }));
    $(selector).value = getCountries().includes(region) ? region : "US";
  });
}
populateCountries();

$("#onboarding-username").addEventListener("input", () => {
  $("#onboarding-username").value = $("#onboarding-username").value.toLowerCase().replace(/^@/, "").slice(0, 24);
});
$("#onboarding-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const new_username = $("#onboarding-username").value.trim();
  const new_display_name = $("#onboarding-display-name").value.trim();
  const enteredPhone = $("#onboarding-phone").value.trim();
  if (!/^[a-z0-9_]{3,24}$/.test(new_username)) return setMessage("#onboarding-message", "Username must be 3–24 lowercase letters, numbers, or underscores.");
  if (!new_display_name || new_display_name.length > 40) return setMessage("#onboarding-message", "Display name must be 1–40 characters.");
  const canonicalPhone = enteredPhone ? normalizePhone(enteredPhone, $("#onboarding-country").value) : null;
  if (enteredPhone && !canonicalPhone) return setMessage("#onboarding-message", "Enter a valid phone number for the selected country, or leave it blank.");
  const submit = $("#onboarding-form button[type=submit]");
  submit.disabled = true; setMessage("#onboarding-message", "Creating your profile…", true);
  const { data, error } = await supabase.rpc("complete_profile_onboarding", {
    new_username,
    new_display_name,
    phone_hashes: canonicalPhone ? await phoneHashes(canonicalPhone) : [],
  });
  if (error) {
    submit.disabled = false;
    const details = String(error.message || "").toLowerCase();
    const message = details.includes("username") && (details.includes("taken") || details.includes("unique"))
      ? "That username is already taken. Choose another one."
      : details.includes("phone number is already")
        ? "That phone number is already linked to another account."
        : "We couldn't create your profile. Check your connection and try again.";
    return setMessage("#onboarding-message", message);
  }
  profile = data?.[0];
  if (canonicalPhone) localStorage.setItem("grubclique-contact-phone", canonicalPhone);
  setMessage("#onboarding-message");
  submit.disabled = false;
  await enterApp();
});
$("#onboarding-sign-out").addEventListener("click", () => supabase.auth.signOut());

$("#profile-picture").addEventListener("change", () => {
  const file = $("#profile-picture").files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/") || file.size > 3 * 1024 * 1024) return setMessage("#settings-message", "Choose an image smaller than 3 MB.");
  const reader = new FileReader(); reader.onload = () => { pendingAvatar = String(reader.result); setAvatar("#account-avatar", pendingAvatar); }; reader.readAsDataURL(file);
});
$("#remove-picture").addEventListener("click", () => { pendingAvatar = null; setAvatar("#account-avatar", null); });

$("#save-settings").addEventListener("click", async () => {
  const displayName = $("#display-name").value.trim();
  if (!displayName || displayName.length > 40) return setMessage("#settings-message", "Display name must be 1–40 characters.");
  $("#save-settings").disabled = true; setMessage("#settings-message", "Saving…", true);
  const { error } = await supabase.rpc("update_profile_display_name", { new_display_name: displayName });
  if (error) {
    $("#save-settings").disabled = false;
    return setMessage("#settings-message", "We couldn't save your display name. Please try again.");
  }
  profile = { ...profile, display_name: displayName };
  $("#profile-name").textContent = displayName;
  if (pendingAvatar) localStorage.setItem("grubclique-profile-picture", pendingAvatar); else localStorage.removeItem("grubclique-profile-picture");
  setAvatar(".welcome-row .avatar", pendingAvatar);
  const notifications = $("#match-notifications").checked;
  localStorage.setItem("grubclique-match-notifications", String(notifications));
  if (notifications && "Notification" in window && Notification.permission === "default") await Notification.requestPermission();
  $("#save-settings").disabled = false; setMessage("#settings-message", "Changes saved.", true);
});

$("#save-phone").addEventListener("click", async () => {
  const canonical = normalizePhone($("#contact-phone").value, $("#phone-country").value);
  if (!canonical) return setMessage("#settings-message", "Enter a valid phone number for the selected country.");
  $("#save-phone").disabled = true; setMessage("#settings-message", "Saving contact number…", true);
  const { error } = await supabase.rpc("set_contact_phone_v2", { phone_hashes: await phoneHashes(canonical) });
  $("#save-phone").disabled = false;
  if (error) return setMessage("#settings-message", "We couldn't save that contact number. Please try again.");
  localStorage.setItem("grubclique-contact-phone", canonical); $("#contact-phone").value = canonical;
  setMessage("#settings-message", "Contact number saved for discovery.", true);
});

$("#clear-session").addEventListener("click", () => {
  stopPolling();
  if (clique?.id) localStorage.removeItem(`grubclique-index-${clique.id}`);
  clique = null; restaurants = []; swipeIndex = 0;
  localStorage.setItem(`grubclique-session-cleared-${session.user.id}`, "true");
  setMessage("#settings-message", "Saved GrubHunt cleared.", true);
});
$("#settings-sign-out").addEventListener("click", () => supabase.auth.signOut());

$("#delete-account").addEventListener("click", async () => {
  if (!confirm("Permanently delete your GrubClique account and account data? This cannot be undone.")) return;
  $("#delete-account").disabled = true;
  const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, { method: "POST", headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` } });
  if (!response.ok) { $("#delete-account").disabled = false; return setMessage("#settings-message", "We couldn't delete your account. Please try again."); }
  await supabase.auth.signOut();
});

$$(".tab-bar button").forEach((button) => button.addEventListener("click", async () => {
  const view = button.dataset.view;
  if (view === "cliques") await loadCliques();
  if (view === "history") await loadHistory();
  if (view === "friends") await loadFriends();
  if (view === "settings") refreshAccountControls();
  showPanel(view);
}));
$$(".back-home").forEach((button) => button.addEventListener("click", () => showPanel("home")));
$$(".back-cliques").forEach((button) => button.addEventListener("click", async () => { await loadCliques(); showPanel("cliques"); }));
$$(".back-group").forEach((button) => button.addEventListener("click", async () => { await loadGroup(false); showPanel("group"); }));
$$(".back-clique").forEach((button) => button.addEventListener("click", () => showPanel("clique")));

window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPrompt = event; $("#install-app").classList.remove("hidden"); });
$("#install-app").addEventListener("click", async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $("#install-app").classList.add("hidden"); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js?v=17");

supabase.auth.onAuthStateChange((_event, nextSession) => {
  const changed = session?.user?.id !== nextSession?.user?.id;
  session = nextSession;
  if (changed) setTimeout(() => nextSession ? enterApp().catch((error) => setMessage("#auth-message", friendlyError(error, "We couldn't load your account."))) : leaveApp(), 0);
});

restoreSession().catch((error) => {
  $("#connection-status").textContent = "Connection problem";
  setMessage("#auth-message", friendlyError(error, "We couldn't connect to GrubClique."));
});
