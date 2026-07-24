const CACHE_NAME = "salon-mvp-v59-fix-couleur-profil-perimee";

const APP_ASSETS = [
  "./",
  "./index.html",
  "./planning.html",
  "./clients.html",
  "./recherche.html",
  "./comptes.html",
  "./plus.html",
  "./reset-password.html",
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
  "./js/core/supabase-client.js",
  "./js/core/supabase-data.js",
  "./js/core/auth.js",
  "./js/core/domain.js",
  "./js/core/ui.js",
  "./js/core/form-state.js",
  "./js/core/form-reservations.js",
  "./js/core/form-clients.js",
  "./js/core/form-accounts.js",
  "./js/core/form-services.js",
  "./js/core/form-absences.js",
  "./js/core/form-holidays.js",
  "./js/core/forms.js",
  "./js/pages/login.js",
  "./js/pages/reset-password.js",
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

// Seuls les fichiers de l'app elle-meme (meme origine) et le CDN du SDK
// Supabase (statique, verrouille sur une version precise) passent par le
// cache. Tout le reste - en particulier l'API Supabase (donnees dynamiques,
// dependantes de la session et des droits RLS) - ne doit jamais etre
// intercepte ni rejoue depuis le cache : chaque appel doit toujours
// atteindre le reseau pour refleter l'etat reel.
const SAME_ORIGIN = self.location.origin;
const CACHEABLE_CDN_ORIGINS = ["https://unpkg.com"];

function isCacheable(url) {
  return url.origin === SAME_ORIGIN || CACHEABLE_CDN_ORIGINS.indexOf(url.origin) !== -1;
}

function putInCache(request, response) {
  var copy = response.clone();
  caches.open(CACHE_NAME).then(function (cache) {
    cache.put(request, copy).catch(function () {});
  });
  return response;
}

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") {
    return;
  }

  var requestUrl = new URL(event.request.url);

  if (!isCacheable(requestUrl)) {
    return;
  }

  // Reseau d'abord pour les pages HTML (navigation) et le code JS de l'app :
  // pendant le developpement (et en general), la derniere version deployee
  // doit toujours s'afficher quand le reseau est disponible. Le cache ne
  // sert que de secours hors-ligne, plus de source par defaut.
  var isNavigationOrAppScript = event.request.mode === "navigate" ||
    (requestUrl.origin === SAME_ORIGIN && requestUrl.pathname.endsWith(".js"));

  if (isNavigationOrAppScript) {
    event.respondWith(
      fetch(event.request)
        .then(function (response) { return putInCache(event.request, response); })
        .catch(function () { return caches.match(event.request); })
    );
    return;
  }

  // Le reste (CSS, images, SDK Supabase en CDN) change rarement et profite
  // davantage du hors-ligne que d'etre systematiquement revalide : cache
  // d'abord, reseau en secours si rien en cache.
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) {
        return cached;
      }

      return fetch(event.request).then(function (response) {
        return putInCache(event.request, response);
      });
    })
  );
});
