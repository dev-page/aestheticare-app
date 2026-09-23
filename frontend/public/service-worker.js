const VERSION = "aestheticare-v1";

self.addEventListener("install", () => {
  console.log(`${VERSION} service worker installed`);
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log(`${VERSION} service worker activated`);

  event.waitUntil(self.clients.claim());
});