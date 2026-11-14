// Service worker: makes the app installable (Chrome and Edge on computers, Android).
// It does not cache anything, so the app always shows the latest version from the server.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
