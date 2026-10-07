// Minimal service worker: lets the dashboard install as an app and keeps the shell available offline.
// API and websocket traffic is never cached; the live data always comes from the network.
const SHELL = "neurolab-shell-v1";
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(["/", "/icon.svg", "/manifest.webmanifest"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api") || url.pathname.startsWith("/socket.io") || url.pathname === "/health") return;
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) caches.open(SHELL).then((cache) => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request).then((hit) => hit || caches.match("/"))),
  );
});
