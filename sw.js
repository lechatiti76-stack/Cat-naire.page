/**
 * sw.js — Service worker minimal pour rendre l'application installable (PWA)
 * et utilisable hors-ligne pour sa coquille statique (HTML/CSS/JS/icônes).
 *
 * Les données réelles (Google Sheets, authentification) ne sont JAMAIS mises
 * en cache ici : ce sont des requêtes vers un autre domaine, laissées
 * intactes (voir le filtre d'origine dans le gestionnaire "fetch"). Sans
 * connexion, l'application s'ouvre donc en mode démonstration.
 */

const CACHE_NAME = "verif-materiel-v1";
const FICHIERS_A_METTRE_EN_CACHE = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/google-config.js",
  "./js/data.js",
  "./js/google-sheets.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./assets/logo-lhte-icon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(FICHIERS_A_METTRE_EN_CACHE))
      .catch(() => {}) // best effort : ne bloque pas l'installation si un fichier manque
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(noms.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Seules les requêtes vers ce domaine (coquille de l'application) passent par le cache ;
  // Google Sheets, l'authentification Google et ipify vont toujours au réseau.
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((reponseEnCache) => {
      const depuisReseau = fetch(event.request)
        .then((reponseReseau) => {
          if (reponseReseau.ok) {
            const copie = reponseReseau.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copie));
          }
          return reponseReseau;
        })
        .catch(() => reponseEnCache);
      return reponseEnCache || depuisReseau;
    })
  );
});
