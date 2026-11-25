// Service Worker: hält alle Programmdateien auf dem Gerät vor, damit
// FIRECOMMAND nach dem ersten Laden ohne Netz startet.
// Bei einer neuen Version VERSION erhöhen.

const VERSION = "firecommand-ipad-3";
const DATEIEN = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/api.js",
  "./js/ui.js",
  "./js/dashboard.js",
  "./js/mengen.js",
  "./js/objekte.js",
  "./js/protokoll.js",
  "./js/sicherung-ui.js",
  "./js/start.js",
  "./js/lagebericht.js",
  "./js/pdf.js",
  "./js/pdf-metrik.js",
  "./js/protokoll-format.js",
  "./js/flaechenlage.js",
  "./js/daten/struktur.js",
  "./js/daten/service.js",
  "./js/daten/speicher.js",
  "./js/daten/sicherung.js",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Zuerst aus dem Gerätespeicher, sonst aus dem Netz
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((treffer) => treffer || fetch(e.request).catch(
      () => (e.request.mode === "navigate" ? caches.match("./index.html") : Response.error()),
    )),
  );
});
