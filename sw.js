/* ============================================================
   Le Carnet — service worker
   - Shell de l'app : cache d'abord (démarrage instantané, hors ligne OK)
   - expressions.json : réseau d'abord, repli sur le cache
   ============================================================ */

const CACHE = "le-carnet-v1";

const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./expressions.json",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const requete = ev.request;
  if (requete.method !== "GET") return;

  const url = new URL(requete.url);
  const estJSON = url.pathname.endsWith("expressions.json");

  if (estJSON) {
    // réseau d'abord, cache en secours (l'app gère aussi son propre cache localStorage)
    ev.respondWith(
      fetch(requete)
        .then((reponse) => {
          if (reponse.ok) {
            const copie = reponse.clone();
            caches.open(CACHE).then((cache) => cache.put(requete, copie));
          }
          return reponse;
        })
        .catch(() => caches.match(requete, { ignoreSearch: true }))
    );
    return;
  }

  // shell : cache d'abord, réseau en secours (et mise en cache au passage)
  ev.respondWith(
    caches.match(requete, { ignoreSearch: true }).then((trouve) => {
      if (trouve) return trouve;
      return fetch(requete).then((reponse) => {
        if (reponse.ok && url.origin === self.location.origin) {
          const copie = reponse.clone();
          caches.open(CACHE).then((cache) => cache.put(requete, copie));
        }
        return reponse;
      });
    })
  );
});
