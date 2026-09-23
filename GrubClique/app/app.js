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
let votedIds = new Set();
let votesReady = false;
let swipeBusy = false;
let huntRevision = 0;
let huntLoad = 0;
let groupLoad = 0;
let preferredCard = null;

function accessRevoked(error) {
  return /(?:Clique|GrubHunt) membership required/i.test(String(error?.message || ''));
}
function resetHuntProgress() {
  huntRevision++; huntLoad++;
  votedIds = new Set(); votesReady = false; swipeBusy = false; preferredCard = null;
}
function currentRestaurant() {
  const eligible = filteredRestaurants().filter(r => !votedIds.has(String(r.id)));
  return eligible.find(r => String(r.id) === preferredCard) || eligible[0];
}
async function readSwipeIds(huntId, userId) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await supabase.from('swipes').select('restaurant_id').eq('clique_id', huntId).eq('user_id', userId).order('restaurant_id').range(offset, offset + 999);
    if (result.error) return result;
    rows.push(...(result.data || []));
    if ((result.data || []).length < 1000) return { data: rows, error: null };
  }
}
function clearUnavailableClique() {
  stopPolling(); groupLoad++; resetHuntProgress();
  if (clique?.id) {
    localStorage.removeItem(`grubclique-index-${clique.id}`);
    localStorage.removeItem(`grubclique-pool-${clique.id}`);
  }
  group = null; clique = null; restaurants = []; participantProgress = []; completionProgress = null;
  $('#match-card').classList.add('hidden');
  $('#chat-input').value = ''; $('#chat-list').replaceChildren();
  $('#member-list').replaceChildren(); $('#group-member-list').replaceChildren(); $('#grub-hunts-list').replaceChildren();
  if ($('#delete-clique-dialog').open) $('#delete-clique-dialog').close();
  showPanel('cliques');
  void loadCliques().then(() => {
    if (currentPanel === 'cliques' && !group) setMessage('#cliques-message', 'This Clique or GrubHunt is no longer available. It may have been deleted, or your membership changed.');
  });
}
let selectedLocation = null;
let editingHuntLocation = false;
let pendingAvatar = null;
let pollTimer = null;
let creatingAccount = false;
let installPrompt = null;
let chatMode = "hunt";
let chatOrigin = "clique";
let completionProgress = null;
let currentPanel = "home";
let activity = [];
let activityTimer = null;
let readRequest = null;
let participantProgress = [];
let pushEnabled = false;

async function refreshPushState() {
  const supported='serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  $("#enable-push").disabled=!supported;
  if(!supported) { $("#push-status").textContent='This browser does not support background notifications.'; return; }
  const registration=await navigator.serviceWorker.ready;
  let subscription=await registration.pushManager.getSubscription();
  const owner=localStorage.getItem('grubclique-push-owner');
  if(subscription && owner!==session?.user.id) { await subscription.unsubscribe(); subscription=null; localStorage.removeItem('grubclique-push-owner'); }
  pushEnabled=Boolean(subscription);
  $("#enable-push").classList.toggle('hidden',pushEnabled);
  $("#disable-push").classList.toggle('hidden',!pushEnabled);
  $("#push-status").textContent=pushEnabled?'Enabled for this account on this device.':Notification.permission==='denied'?'Notifications are blocked in your browser’s site settings.':'Background notifications are off on this device.';
}
async function disablePush() {
  if(!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const registration=await navigator.serviceWorker.ready;
  const subscription=await registration.pushManager.getSubscription();
  if(subscription) {
    await subscription.unsubscribe();
    if(session) await supabase.from('web_push_subscriptions').delete().eq('user_id',session.user.id).eq('endpoint',subscription.endpoint);
  }
  localStorage.removeItem('grubclique-push-owner'); pushEnabled=false;
}
async function signOut() { await disablePush(); await supabase.auth.signOut(); }

$("#enable-push").addEventListener('click',async()=>{
  const button=$("#enable-push"); button.disabled=true;
  let subscription;
  try {
    const permission=await Notification.requestPermission();
    if(permission!=='granted') throw new Error('Allow notifications in your browser to enable alerts.');
    const {data:key,error}=await supabase.rpc('get_web_push_key');
    if(error || !key) throw new Error('Notifications are not ready yet. Please try again shortly.');
    const raw=atob(key.replace(/-/g,'+').replace(/_/g,'/'));
    const applicationServerKey=Uint8Array.from(raw,c=>c.charCodeAt(0));
    const registration=await navigator.serviceWorker.ready;
    subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey});
    const saved=await supabase.from('web_push_subscriptions').upsert({user_id:session.user.id,endpoint:subscription.endpoint,subscription:subscription.toJSON()},{onConflict:'user_id,endpoint'});
    if(saved.error) throw new Error('Could not save notification settings. Please try again.');
    localStorage.setItem('grubclique-push-owner',session.user.id); await refreshPushState();
  } catch(error) { if(subscription) await subscription.unsubscribe(); $("#push-status").textContent=error.message || 'Notifications could not be enabled.'; }
  finally {button.disabled=false;}
});
$("#disable-push").addEventListener('click',async()=>{
  try { await disablePush(); await refreshPushState(); } catch { $("#push-status").textContent='Could not disable notifications. Please try again.'; }
});

function unreadBadge(count) {
  const badge = document.createElement("span"); badge.className = "unread-badge";
  badge.textContent = Number(count) > 99 ? "99+" : String(count);
  badge.setAttribute("aria-label", `${count} unread messages`); return badge;
}
function unreadCount(scope,id) { return Number(activity.find((item) => item.chat_scope === scope && item.target_id === id)?.unread_count || 0); }
async function refreshActivity() {
  if (!session || document.hidden) return;
  const userId = session.user.id;
  const { data, error } = await supabase.rpc("get_chat_activity");
  if (error || session?.user.id !== userId) return;
  activity = data || [];
  const count = activity.reduce((sum,item) => sum + Number(item.unread_count),0);
  const tab = $('.tab-bar button[data-view="cliques"]');
  tab.querySelector('.unread-badge')?.remove(); if(count) tab.append(unreadBadge(count));
  for (const button of [$("#open-group-chat"),$("#open-chat"),$("#swipe-chat")]) {
    button.querySelector('.unread-badge')?.remove();
    const unread = button.id === "open-group-chat" ? unreadCount("group",group?.id) : unreadCount("hunt",clique?.id);
    if(unread) button.append(unreadBadge(unread));
  }
  $$("[data-unread-group]").forEach((el) => { el.querySelector('.unread-badge')?.remove(); const unread=activity.filter((a)=>a.group_id===el.dataset.unreadGroup).reduce((sum,a)=>sum+Number(a.unread_count),0); if(unread) el.append(unreadBadge(unread)); });
  $$("[data-unread-hunt]").forEach((el) => { el.querySelector('.unread-badge')?.remove(); const unread=unreadCount('hunt',el.dataset.unreadHunt); if(unread) el.append(unreadBadge(unread)); });
}

async function acknowledgeChat() {
  if (currentPanel !== 'chat' || document.hidden || readRequest) return;
  const scope = chatMode === 'group' ? 'group' : 'hunt';
  const target = scope === 'group' ? group : clique;
  const messages = target?.state?.messages || [];
  const through = messages.map(m=>m.created_at).filter(Boolean).sort().at(-1);
  if(!through || !target) return;
  readRequest = supabase.rpc('mark_chat_read',{chat_scope:scope,target_id:target.id,through_time:through});
  try { await readRequest; await refreshActivity(); } finally { readRequest=null; }
}

function showPanel(name) {
  if (['group','huntsetup'].includes(name) && !group || ['clique','swipe','filters'].includes(name) && !clique || name === 'chat' && !(chatMode === 'group' ? group : clique)) name = 'cliques';
  currentPanel = name;
  panels.forEach((panel) => $(`#${panel}-panel`)?.classList.toggle("hidden", panel !== name));
  $(".tab-bar").classList.toggle("hidden", name === "onboarding");
  $$(".tab-bar button").forEach((button) => button.classList.toggle("active", button.dataset.view === name));
  if (['group','huntsetup'].includes(name) && group || name === "chat" && chatMode === "group" && group) startGroupPolling();
  else if (["clique", "swipe", "chat", "filters"].includes(name) && clique) startPolling();
  else stopPolling();
  window.scrollTo({ top: 0, behavior: "smooth" });
  window.RedxjakAnalytics?.track("screen_viewed", {}, { screen: `/GrubClique/app/${name}` });
  if(name === 'chat') void acknowledgeChat();
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
  clearInterval(activityTimer); void refreshActivity();
  activityTimer = setInterval(refreshActivity,10000);
  void refreshPushState().catch(() => { $("#push-status").textContent='Notification settings are temporarily unavailable.'; });
}

async function leaveApp() {
  resetHuntProgress(); groupLoad++;
  clearInterval(activityTimer); activityTimer=null; activity=[]; group=null;
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
$("#sign-out").addEventListener("click", signOut);

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

async function prepareCliqueCreation() {
  setMessage("#home-message");
  $("#clique-name").value = "";
  const list = $("#setup-friends-list"); list.textContent="Loading friends…";
  showPanel("setup");
  const {data,error}=await supabase.rpc('list_friends');
  if(error) { list.textContent='Friends could not be loaded. You can add them after creating your Clique.'; return; }
  const friends=(data||[]).filter(f=>f.status==='accepted');
  list.replaceChildren(...friends.map(friend=>{
    const label=document.createElement('label'); const input=document.createElement('input');
    input.type='checkbox'; input.name='setup-friend'; input.value=friend.username;
    label.append(input,document.createTextNode(`${friend.display_name} (@${friend.username})`)); return label;
  }));
  if(!friends.length) list.textContent='No accepted friends yet. You can invite people after creating your Clique.';
}
$("#create-clique").addEventListener("click", prepareCliqueCreation);
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
  const friend_usernames=$$('input[name="setup-friend"]:checked').map(input=>input.value);
  const { data, error } = await supabase.rpc("create_friend_clique_with_members", { clique_name: cliqueName, friend_usernames });
  submit.disabled = false;
  if (error) return setMessage("#setup-message", friendlyError(error, "We couldn't create the Clique."));
  group = { id: data[0].friend_clique_id, code: data[0].invite_code, name: cliqueName, isAdmin: true };
  setMessage("#setup-message");
  await loadGroup(true);
});

function prepareHuntLocationForm(editing = false) {
  $("#hunt-name").value = "";
  $("#hunt-name-label").classList.toggle('hidden',editing);
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
      resetHuntProgress();
      clique.status = "lobby";
      editingHuntLocation = false;
      setMessage("#hunt-setup-message");
      await loadClique(true);
      return;
    }
    const { data, error } = await supabase.rpc("create_named_grub_hunt", {
      hunt_name: $("#hunt-name").value.trim() || null,
      target_friend_clique: group.id,
      latitude: location.latitude,
      longitude: location.longitude,
      radius_m: Math.round(radiusMiles * 1609.344),
      search_area: area === "Current location" ? null : area,
    });
    if (error) throw error;
    resetHuntProgress();
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
  await refreshActivity();
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
    title.dataset.unreadGroup=entry.friend_clique_id;
    const unread=activity.filter(a=>a.group_id===entry.friend_clique_id).reduce((sum,a)=>sum+Number(a.unread_count),0);
    if(unread) title.append(unreadBadge(unread));
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

$("#cliques-create").addEventListener("click", prepareCliqueCreation);

function renderMembers(members) {
  const list = $("#member-list");
  list.replaceChildren(...members.map((member) => {
    const item = document.createElement("li");
    item.textContent = member.user_id === session.user.id ? "You" : member.display_name;
    const status=document.createElement('span');
    const text=participantProgress.find(p=>p.user_id===member.user_id)?.progress_status || (clique?.status==='lobby'?'Ready':'Updating…');
    status.className=`participant-status${text==='Finished'?' finished':''}`; status.textContent=text; item.append(status);
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
  resetHuntProgress();
  $('#match-card').classList.add('hidden');
  clique = { id: entry.id, status: entry.status, isHost: true };
  await loadClique(true);
}

async function loadGroup(openPanel = false) {
  if (!group?.id) return;
  const requestedGroup=group.id;
  const userId=session?.user.id; const request=++groupLoad;
  await refreshActivity();
  if(group?.id!==requestedGroup || session?.user.id!==userId || request!==groupLoad) return;
  const [{ data, error }, messagesResult] = await Promise.all([
    supabase.rpc("get_friend_clique_state", { target_friend_clique: group.id }),
    supabase.rpc("get_friend_clique_messages", { target_friend_clique: group.id }),
  ]);
  if(group?.id!==requestedGroup || session?.user.id!==userId || request!==groupLoad) return;
  if (error) {
    if (accessRevoked(error)) return clearUnavailableClique();
    return setMessage("#group-message", friendlyError(error, "We couldn't refresh this Clique."));
  }
  const state = data?.[0]; if (!state) return clearUnavailableClique();
  state.messages = messagesResult.error ? (group.state?.messages || []) : (messagesResult.data || []);
  // Keep focused controls intact when polling confirms that nothing has changed.
  if (!openPanel && JSON.stringify(state) === JSON.stringify(group.state)) return;
  group = { ...group, id: state.friend_clique_id, code: state.invite_code, name: state.clique_name, isAdmin: state.is_admin, state };
  $("#group-name").textContent = group.name;
  $("#group-code").textContent = `Invite code ${group.code}`;
  renderGroupMembers(state.members || []);
  if (currentPanel==='chat' && chatMode === "group") renderChat(state.messages || []);
  $("#manage-members-form").classList.toggle("hidden", !group.isAdmin);
  $("#rename-clique").classList.toggle("hidden", !group.isAdmin);
  $("#leave-group").classList.remove("hidden");
  $("#delete-group").classList.toggle("hidden", !group.isAdmin);
  const hunts = state.grub_hunts || [];
  const active = hunts.filter((hunt) => hunt.status === "lobby" || hunt.status === "swiping");
  $("#active-hunt-summary").textContent = active.length ? `${active.length} of 2 active GrubHunts` : "No active GrubHunt.";
  $("#new-grub-hunt").disabled = active.length >= 2;
  $("#new-grub-hunt").textContent = active.length >= 2 ? "Two active GrubHunts (maximum)" : "Start a new GrubHunt";
  if (group.isAdmin) await loadCliqueFriendPicker(state.members || []);
  if(group?.id!==requestedGroup || session?.user.id!==userId || request!==groupLoad) return;
  const list = $("#grub-hunts-list");
  if (!hunts.length) list.textContent = "No GrubHunts yet. Any member can start the first one.";
  else list.replaceChildren(...hunts.map((hunt) => {
    const card = document.createElement("article"); card.className = "history-card session-card";
    const copy = document.createElement("div"); const title = document.createElement("h2"); title.textContent = activity.find(a=>a.chat_scope==='hunt' && a.target_id===hunt.id)?.title || "GrubHunt";
    title.dataset.unreadHunt=hunt.id; const unread=unreadCount('hunt',hunt.id); if(unread) title.append(unreadBadge(unread));
    const meta = document.createElement("p"); meta.className = "muted"; meta.textContent = `${grubHuntStatusLabel(hunt.status)} · ${new Date(hunt.created_at).toLocaleDateString()} · ${hunt.started_by || "Member"}`;
    copy.append(title, meta);
    const open = document.createElement("button"); open.className = "secondary-button compact-button"; open.type = "button"; open.textContent = hunt.status === "finished" ? "View" : "Open";
    open.addEventListener("click", () => openGrubHunt(hunt)); card.append(copy, open); return card;
  }));
  if (openPanel) showPanel("group");
}

$("#manage-members-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const username = ($("#clique-friend-picker").value || $("#clique-friend-username").value).trim().replace(/^@/, "").toLowerCase();
  if (!username) return setMessage("#group-message", "Enter a friend's username.");
  const { error } = await supabase.rpc("add_friend_to_clique", { target_friend_clique: group.id, target_username: username });
  if (error) return setMessage("#group-message", friendlyError(error, error.message || "We couldn't add that friend."));
  $("#clique-friend-username").value = ""; $("#clique-friend-picker").value = ""; setMessage("#group-message", "Friend added to the Clique.", true); await loadGroup(false);
});

async function loadCliqueFriendPicker(members) {
  const picker = $("#clique-friend-picker");
  const groupId=group?.id; const userId=session?.user.id;
  const memberIds = new Set(members.map((member) => member.user_id));
  const { data, error } = await supabase.rpc("list_friends");
  if(group?.id!==groupId || session?.user.id!==userId) return;
  const selected=picker.value;
  const friends = error ? [] : (data || []).filter((friend) => friend.status === "accepted" && !memberIds.has(friend.user_id));
  picker.replaceChildren(new Option(friends.length ? "Select a friend" : "No other accepted friends", ""), ...friends.map((friend) => new Option(`${friend.display_name} (@${friend.username})`, friend.username)));
  picker.disabled = !friends.length;
  if(friends.some(friend=>friend.username===selected)) picker.value=selected;
}

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
  if (!clique?.id || swipeBusy) return;
  const requestedHunt=clique.id;
  const userId=session?.user.id; const revision=huntRevision; const request=++huntLoad;
  const [{ data, error }, prefResult, progressResult, hiddenResult, voteResult] = await Promise.all([
    supabase.rpc("get_clique_state", { target_clique: clique.id }),
    supabase.rpc("get_clique_preferences", { target_clique: clique.id }),
    supabase.rpc("get_grub_hunt_participant_progress", { target_clique: clique.id }),
    supabase.rpc("list_hidden_restaurants_v2"),
    readSwipeIds(requestedHunt, userId),
  ]);
  if(clique?.id!==requestedHunt || session?.user.id!==userId || revision!==huntRevision || request!==huntLoad) return;
  if (error) {
    if (accessRevoked(error)) return clearUnavailableClique();
    return setMessage("#clique-message", friendlyError(error, "We couldn't refresh this clique."));
  }
  const state = data?.[0];
  if (!state) return clearUnavailableClique();
  votesReady = !voteResult.error;
  if (votesReady) votedIds = new Set((voteResult.data || []).map(row => String(row.restaurant_id)));
  setMessage('#clique-message', votesReady ? '' : 'Could not load your saved choices. Please try again.');
  clique = { ...clique, code: state.invite_code, isHost: state.is_host, status: state.status, state };
  preferences = prefResult.data?.[0] || preferences;
  participantProgress=progressResult.error?[]:(progressResult.data||[]);
  completionProgress=participantProgress.length ? {total_members:participantProgress.length,finished_members:participantProgress.filter(p=>p.progress_status==='Finished').length}:null;
  const progressText=completionProgress ? `${completionProgress.finished_members} of ${completionProgress.total_members} finished swiping` : 'Progress unavailable';
  $("#overview-progress").textContent=progressText; $("#swipe-group-progress").textContent=progressText;
  const everyoneFinished = Number(completionProgress?.total_members || 0) > 0
    && Number(completionProgress.finished_members) === Number(completionProgress.total_members);
  const completionKey = `grubclique-complete-notified-${clique.id}`;
  if (everyoneFinished && !localStorage.getItem(completionKey)) {
    localStorage.setItem(completionKey, "true");
    if ("Notification" in window && localStorage.getItem("grubclique-match-notifications") !== "false" && Notification.permission === "granted") {
      new Notification("GrubHunt complete", { body: "Everyone has finished swiping. Check your matches!", icon: "../assets/app-icon.png" });
    }
  }
  const hiddenBrands = new Set((hiddenResult.data || []).map((entry) => entry.brand_key));
  restaurants = (state.restaurants || []).filter((restaurant) => !hiddenBrands.has(restaurantBrandKey(restaurant.name)));
  refreshCuisineOptions();
  $("#clique-code").textContent = state.title && state.title!=='GrubHunt' ? state.title : `${group?.name || "Clique"} GrubHunt`;
  renderMembers(state.members || []);
  $("#preference-summary").textContent = preferenceLabel();
  const swipeButton = $("#start-swiping");
  const hasRestaurants = filteredRestaurants().length > 0;
  if (state.status === "swiping") {
    swipeButton.disabled = !hasRestaurants || !votesReady;
    swipeButton.textContent = "Continue swiping";
  } else if (state.status === "finished") {
    swipeButton.disabled = true;
    swipeButton.textContent = "GrubHunt completed";
  } else {
    swipeButton.disabled = !hasRestaurants || !votesReady;
    swipeButton.textContent = "Start swiping";
  }
  $("#end-clique").classList.toggle("hidden", state.status === "finished");
  $("#edit-hunt-location").classList.toggle("hidden", state.status === "finished" || !state.is_host);
  if(currentPanel==='chat' && chatMode==='hunt') renderChat(state.messages || []);
  if (openPanel) showPanel("clique");
  if (!$("#swipe-panel").classList.contains("hidden")) renderRestaurant();
}

function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => loadClique(false), 2500);
}
function startGroupPolling() {
  stopPolling();
  pollTimer = setInterval(() => loadGroup(false), 2500);
}
function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }

$("#start-swiping").addEventListener("click", async () => {
  if (!clique || !votesReady || clique.status === "finished") return;
  const huntId=clique.id; const userId=session.user.id;
  if (clique.status === "lobby") {
    const { error } = await supabase.rpc("start_clique", { target_clique: clique.id });
    if (clique?.id!==huntId || session?.user.id!==userId) return;
    if (error) { if(accessRevoked(error)) return clearUnavailableClique(); return setMessage("#clique-message", friendlyError(error, "We couldn't start swiping.")); }
    window.RedxjakAnalytics?.track("clique_started");
    await loadClique(false);
  }
  if (clique?.id!==huntId || session?.user.id!==userId) return;
  showPanel("swipe");
  renderRestaurant();
});
$("#start-over").addEventListener("click", () => loadClique(false));
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
function openHuntChat(origin) {
  chatMode = "hunt"; chatOrigin = origin;
  $("#chat-eyebrow").textContent = "Your GrubHunt";
  $("#chat-title").textContent = "Chat";
  $("#chat-input").placeholder = "Message your GrubHunt";
  renderChat(clique?.state?.messages || []);
  showPanel("chat");
}

$("#open-chat").addEventListener("click", () => openHuntChat("clique"));
$("#open-group-chat").addEventListener("click", () => {
  chatMode = "group"; chatOrigin = "group";
  $("#chat-eyebrow").textContent = group.name;
  $("#chat-title").textContent = "Clique chat";
  $("#chat-input").placeholder = "Message your Clique";
  renderChat(group.state?.messages || []);
  showPanel("chat");
});
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
  if (!clique) return;
  const huntId=clique.id; const userId=session.user.id;
  localFilters = {
    cuisine: $("#cuisine-filter").value,
    maxPrice: Number($("input[name=max-price]:checked").value),
    maxDistance: Number($("#distance-filter").value),
    minimumRating: Number($("#rating-filter").value),
    openNowOnly: $("#open-filter").checked,
  };
  preferredCard = null;
  const mealPeriods = $$("input[name=meal]:checked").map((input) => input.value);
  const sortMode = $("#sort-mode").value;
  if (clique.isHost) {
    const { error } = await supabase.rpc("set_clique_preferences", { target_clique: clique.id, meal_periods: mealPeriods, sort_mode: sortMode });
    if (clique?.id!==huntId || session?.user.id!==userId) return;
    if (error) { if(accessRevoked(error)) return clearUnavailableClique(); return alert(friendlyError(error, "We couldn't save those settings.")); }
    preferences = { meal_periods: mealPeriods, sort_mode: sortMode };
  }
  $("#preference-summary").textContent = preferenceLabel();
  await loadClique(false);
  if (clique?.id!==huntId || session?.user.id!==userId) return;
  showPanel("swipe");
  renderRestaurant();
});

function priceLabel(value) {
  return { PRICE_LEVEL_FREE: "Free", PRICE_LEVEL_INEXPENSIVE: "$", PRICE_LEVEL_MODERATE: "$$", PRICE_LEVEL_EXPENSIVE: "$$$", PRICE_LEVEL_VERY_EXPENSIVE: "$$$$" }[value] || "Price unavailable";
}
function restaurantBrandKey(value) { return String(value || "").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim(); }
function distanceLabel(meters) { return Number.isFinite(meters) ? `${(meters / 1609.344).toFixed(1)} mi` : "Distance unavailable"; }
function renderRestaurant() {
  if (!clique) return;
  const visibleRestaurants = filteredRestaurants();
  const restaurant = currentRestaurant();
  const completed = visibleRestaurants.filter(r => votedIds.has(String(r.id))).length;
  $("#swipe-progress").textContent = `${completed}/${visibleRestaurants.length} reviewed`;
  $('#undo-swipe').disabled = swipeBusy || !votesReady || !votedIds.size || clique.status!=='swiping';
  if (!votesReady) {
    $('#restaurant-name').textContent='Loading saved choices';
    $('#restaurant-meta').textContent='Your progress is temporarily unavailable. We will retry automatically.';
    $('#pass').disabled=true; $('#like').disabled=true;
    $('#hide-restaurant').classList.add('hidden'); $('#restaurant-links').replaceChildren();
    return;
  }
  if (!restaurant) {
    $("#restaurant-name").textContent = "You're all caught up";
    const completeSharedList = visibleRestaurants.length === restaurants.length;
    $("#restaurant-meta").textContent = visibleRestaurants.length
      ? (completeSharedList ? "Wait for your Clique's matches or return to the GrubHunt overview." : "You finished this filtered list. Change your filters to see the remaining restaurants.")
      : "No restaurants match those filters. Change your filters to see more.";
    $("#restaurant-hours").textContent = "";
    $("#restaurant-photo").textContent = "✓";
    $("#restaurant-links").replaceChildren();
    $("#hide-restaurant").classList.add("hidden");
    const finished = Number(completionProgress?.finished_members || 0);
    const total = Number(completionProgress?.total_members || 0);
    $("#completion-progress").textContent = total ? `${finished} of ${total} members finished swiping` : "";
    $("#completion-progress").classList.toggle("hidden", !total || !completeSharedList);
    $("#pass").disabled = true; $("#like").disabled = true;
    return;
  }
  $("#pass").disabled = swipeBusy || clique.status!=='swiping'; $("#like").disabled = swipeBusy || clique.status!=='swiping';
  $("#hide-restaurant").classList.remove("hidden");
  $("#completion-progress").classList.add("hidden");
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
  const restaurant = currentRestaurant();
  if (!clique || clique.status!=='swiping' || !votesReady || swipeBusy || !restaurant) return;
  const huntId=clique.id; const userId=session.user.id;
  swipeBusy=true; const revision=++huntRevision;
  $("#pass").disabled = true; $("#like").disabled = true;
  const { data, error } = await supabase.rpc("record_swipe", { target_clique: huntId, target_restaurant: restaurant.id, liked });
  if(clique?.id!==huntId || session?.user.id!==userId || revision!==huntRevision) return;
  swipeBusy=false; huntRevision++;
  if (error) { if(accessRevoked(error)) return clearUnavailableClique(); votesReady=false; renderRestaurant(); void loadClique(false); return alert("We couldn't confirm that swipe. Refreshing your saved choices."); }
  window.RedxjakAnalytics?.track("swipe_recorded", { liked });
  votedIds.add(String(restaurant.id)); preferredCard=null;
  $("#undo-swipe").disabled = false;
  if (data?.[0]?.matched) {
    window.RedxjakAnalytics?.track("match_found");
    $("#match-name").textContent = restaurant.name;
    $("#match-card").classList.remove("hidden");
    if (!pushEnabled && "Notification" in window && localStorage.getItem("grubclique-match-notifications") !== "false" && Notification.permission === "granted") {
      new Notification("GrubClique match!", { body: `${restaurant.name} is everyone's pick.`, icon: "../assets/app-icon.png" });
    }
  }
  renderRestaurant();
}
$("#pass").addEventListener("click", () => recordSwipe(false));
$("#like").addEventListener("click", () => recordSwipe(true));
$("#swipe-chat").addEventListener("click", () => openHuntChat("swipe"));
$("#hide-restaurant").addEventListener("click", async () => {
  if (!clique || !votesReady || swipeBusy) return;
  const restaurant = currentRestaurant();
  if (!restaurant || !confirm(`Never suggest ${restaurant.name} again? This hides the restaurant across future GrubHunts until you restore it in Account.`)) return;
  const { error } = await supabase.rpc("hide_restaurant", { target_place_id: restaurant.place_id, target_name: restaurant.name, target_cuisine: restaurant.cuisine || null, target_maps_url: restaurant.maps_url || null });
  if (error) return alert(friendlyError(error, "We couldn't hide that restaurant."));
  const brandKey = restaurantBrandKey(restaurant.name);
  restaurants = restaurants.filter((item) => restaurantBrandKey(item.name) !== brandKey);
  renderRestaurant();
});
$("#undo-swipe").addEventListener("click", async () => {
  if (!clique || !votesReady || swipeBusy || clique.status!=='swiping') return;
  const huntId=clique.id; const userId=session.user.id;
  swipeBusy=true; const revision=++huntRevision;
  $("#undo-swipe").disabled = true;
  const { data, error } = await supabase.rpc("undo_last_swipe", { target_clique: clique.id });
  if(clique?.id!==huntId || session?.user.id!==userId || revision!==huntRevision) return;
  swipeBusy=false; huntRevision++;
  if (error) { if(accessRevoked(error)) return clearUnavailableClique(); votesReady=false; renderRestaurant(); void loadClique(false); return alert("We couldn't confirm Undo. Refreshing your saved choices."); }
  if (data?.length) { preferredCard=String(data[0].restaurant_id); votedIds.delete(preferredCard); }
  $("#match-card").classList.add("hidden");
  renderRestaurant();
  await loadClique(false);
});

$("#delete-group").addEventListener("click", () => {
  $("#delete-clique-title").textContent = `Delete ${group.name}?`;
  $("#delete-clique-warning").textContent = `Deleting “${group.name}” permanently removes this Clique and all of its GrubHunts, messages, swipes, matches, and related History for every member. This cannot be undone.`;
  $("#delete-clique-dialog").showModal();
});

$("#delete-clique-dialog").addEventListener("close", async (event) => {
  if (event.currentTarget.returnValue !== "delete" || !group) return;
  const { error } = await supabase.rpc("delete_friend_clique", { target_friend_clique: group.id });
  if (error) return setMessage("#group-message", friendlyError(error, "We couldn't delete this Clique."));
  group = null; clique = null; restaurants = []; await loadCliques(); showPanel("cliques");
});
$("#dismiss-match").addEventListener("click", () => $("#match-card").classList.add("hidden"));
$("#swipe-filters").addEventListener("click", () => $("#open-filters").click());
$("#match-chat").addEventListener("click", () => { $("#match-card").classList.add("hidden"); openHuntChat("match"); });
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
  void acknowledgeChat();
}
$("#chat-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = $("#chat-input").value.trim(); if (!body) return;
  const { error } = chatMode === "group"
    ? await supabase.rpc("send_friend_clique_message", { target_friend_clique: group.id, message_body: body })
    : await supabase.rpc("send_clique_message", { target_clique: clique.id, message_body: body });
  if (error) { if(accessRevoked(error)) return clearUnavailableClique(); return alert("We couldn't send that message."); }
  $("#chat-input").value = "";
  if (chatMode === "group") await loadGroup(false); else await loadClique(false);
});

$("#chat-back").addEventListener("click", async () => {
  if (chatMode === "group" || chatOrigin === "group") { await loadGroup(false); return showPanel("group"); }
  if (chatOrigin === "match") { await loadClique(false); if(!clique) return; showPanel("swipe"); renderRestaurant(); return $("#match-card").classList.remove("hidden"); }
  if (chatOrigin === "swipe") { await loadClique(false); showPanel("swipe"); return renderRestaurant(); }
  await loadClique(false); showPanel(chatOrigin === "filters" ? "filters" : "clique");
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
    const actions = document.createElement("div"); actions.className = "friend-actions";
    if (friend.status === "accepted") {
      const label = document.createElement("span"); label.className = "success-label"; label.textContent = "Friend ✓";
      actions.append(label, friendshipButton("Remove", "remove", friend));
    } else if (friend.incoming) {
      actions.append(friendshipButton("Accept", "accept", friend, "secondary-button"), friendshipButton("Decline", "decline", friend));
    } else actions.append(friendshipButton("Cancel request", "cancel", friend));
    card.append(copy, actions); return card;
  }));
}

function friendshipButton(label, action, friend, style = "danger-text") {
  const button = document.createElement("button"); button.type = "button"; button.className = `${style} compact-button`; button.textContent = label;
  button.addEventListener("click", async () => {
    if (action === "remove" && !confirm(`Remove ${friend.display_name} from your friends?`)) return;
    const { error } = await supabase.rpc("manage_friendship", { target_user: friend.user_id, requested_action: action });
    if (error) return setMessage("#friends-message", friendlyError(error, "We couldn't update that friend request."));
    setMessage("#friends-message", action === "accept" ? "Friend request accepted." : "Friends updated.", true);
    await loadFriends();
  });
  return button;
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

async function loadHiddenRestaurants() {
  const list = $("#hidden-restaurants-list");
  const { data, error } = await supabase.rpc("list_hidden_restaurants_v2");
  if (error) { list.textContent = "Hidden restaurants couldn't be loaded."; return; }
  if (!data?.length) { list.textContent = "No hidden restaurants."; return; }
  list.replaceChildren(...data.map((entry) => {
    const card = document.createElement("article"); card.className = "history-card";
    const copy = document.createElement("div"); const title = document.createElement("strong"); title.textContent = entry.restaurant_name; copy.append(title);
    const restore = document.createElement("button"); restore.type = "button"; restore.className = "secondary-button compact-button"; restore.textContent = "Restore";
    restore.addEventListener("click", async () => {
      const result = await supabase.rpc("restore_hidden_restaurant_v2", { target_brand_key: entry.brand_key });
      if (result.error) return setMessage("#settings-message", "We couldn't restore that restaurant.");
      setMessage("#settings-message", "Restaurant restored.", true); await loadHiddenRestaurants();
    });
    card.append(copy, restore); return card;
  }));
}

$("#clear-session").addEventListener("click", () => {
  stopPolling();
  if (clique?.id) localStorage.removeItem(`grubclique-index-${clique.id}`);
  resetHuntProgress(); clique = null; restaurants = [];
  localStorage.setItem(`grubclique-session-cleared-${session.user.id}`, "true");
  setMessage("#settings-message", "Saved GrubHunt cleared.", true);
});
$("#settings-sign-out").addEventListener("click", signOut);

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
  if (view === "settings") { refreshAccountControls(); await Promise.all([loadHiddenRestaurants(),refreshPushState()]); }
  showPanel(view);
}));
$$(".back-home").forEach((button) => button.addEventListener("click", () => showPanel("home")));
$$(".back-cliques").forEach((button) => button.addEventListener("click", async () => { await loadCliques(); showPanel("cliques"); }));
$$(".back-group").forEach((button) => button.addEventListener("click", async () => { await loadGroup(false); showPanel("group"); }));
$$(".back-clique").forEach((button) => button.addEventListener("click", () => showPanel("clique")));

window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPrompt = event; $("#install-app").classList.remove("hidden"); });
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) { void refreshActivity(); void acknowledgeChat(); } });
$("#install-app").addEventListener("click", async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $("#install-app").classList.add("hidden"); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js?v=23");

supabase.auth.onAuthStateChange((_event, nextSession) => {
  const changed = session?.user?.id !== nextSession?.user?.id;
  session = nextSession;
  if (changed) setTimeout(() => nextSession ? enterApp().catch((error) => setMessage("#auth-message", friendlyError(error, "We couldn't load your account."))) : leaveApp(), 0);
});

restoreSession().catch((error) => {
  $("#connection-status").textContent = "Connection problem";
  setMessage("#auth-message", friendlyError(error, "We couldn't connect to GrubClique."));
});
