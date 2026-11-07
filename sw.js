/* Image Guesser service worker — caches the app shell and Wikimedia images so
   repeat questions open instantly and the game still starts offline. */
const SHELL = "ig-shell-v1";
const IMGS = "ig-images-v1";
const SHELL_FILES = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== SHELL && k !== IMGS).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  // Wikimedia images: cache first, they never change.
  if (/(^|\.)wikimedia\.org$/.test(url.hostname)) {
    e.respondWith(
      caches.open(IMGS).then(c => c.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        if (res && (res.ok || res.type === "opaque")) c.put(e.request, res.clone());
        return res;
      }).catch(() => hit)))
    );
    return;
  }

  // Wikipedia API: network first, fall back to any cached answer.
  if (/(^|\.)wikipedia\.org$/.test(url.hostname)) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // App shell: cache first, refresh in the background.
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res && res.ok) caches.open(SHELL).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
