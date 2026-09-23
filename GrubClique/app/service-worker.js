const CACHE = "grubclique-web-v075-swipe-recovery-23";
const SHELL = ["./", "app.css?v=23", "app.js?v=23", "../../assets/analytics-config.js", "../../assets/analytics.js", "manifest.webmanifest", "../assets/app-icon.png"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL))));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('grubclique-web-') && key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener("fetch", (event) => {
  const requestUrl=new URL(event.request.url);
  if (event.request.method !== "GET" || requestUrl.origin !== self.location.origin || !requestUrl.pathname.startsWith('/GrubClique/')) return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request)));
});
self.addEventListener('push',event=>{
  let payload={}; try { payload=event.data?.json()||{}; } catch {}
  event.waitUntil(self.registration.showNotification('GrubClique',{
    body:payload.body || 'You have a GrubClique update.',
    icon:'../assets/app-icon.png',tag:payload.tag || 'grubclique-update',
    data:{url:new URL('./',self.registration.scope).href}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const client=windows.find(c=>c.url.startsWith(self.registration.scope));
    if(client) return client.focus();
    return self.clients.openWindow(new URL('./',self.registration.scope).href);
  })());
});
