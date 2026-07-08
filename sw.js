const CACHE_NAME = "salon-mvp-v21-leave-absences-profile";

const APP_ASSETS = [
  "./",
  "./index.html",
  "./planning.html",
  "./clients.html",
  "./recherche.html",
  "./comptes.html",
  "./plus.html",
  "./manifest.json",
  "./assets/img/branding/logo.png",
  "./assets/img/branding/favicon.png",
  "./assets/img/profiles/logojuliie.png",
  "./assets/img/profiles/logomarion.png",
  "./assets/img/profiles/adminlogo.png",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/pages.css",
  "./js/core/utils.js",
  "./js/core/data.js",
  "./js/core/auth.js",
  "./js/core/domain.js",
  "./js/core/ui.js",
  "./js/core/form-state.js",
  "./js/core/form-reservations.js",
  "./js/core/form-clients.js",
  "./js/core/form-accounts.js",
  "./js/core/form-prestations.js",
  "./js/core/form-misc.js",
  "./js/core/form-absences.js",
  "./js/core/form-holidays.js",
  "./js/core/forms.js",
  "./js/pages/login.js",
  "./js/pages/planning.js",
  "./js/pages/clients.js",
  "./js/pages/recherche.js",
  "./js/pages/comptes.js",
  "./js/pages/plus.js"
];

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_ASSETS);
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== CACHE_NAME;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then(function (response) {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, copy).catch(function () {});
        });
        return response;
      });
    })
  );
});
