// Liste et version générées par npm run sync:pwa.
const CACHE_NAME = "salon-mvp-b64f4bd5771c0dad";

const APP_ASSETS = [
  "./",
  "./index.html",
  "./planning.html",
  "./clients.html",
  "./recherche.html",
  "./comptes.html",
  "./plus.html",
  "./reset-password.html",
  "./fiche-caisse.html",
  "./manifest.json",
  "./css/base.css",
  "./css/components/common.css",
  "./css/components/forms.css",
  "./css/components/profiles.css",
  "./css/components/reservations.css",
  "./css/components/services.css",
  "./css/components.css",
  "./css/layout.css",
  "./css/pages/auth.css",
  "./css/pages/clients.css",
  "./css/pages/comptes.css",
  "./css/pages/fiche-caisse-print.css",
  "./css/pages/fiche-caisse.css",
  "./css/pages/index.css",
  "./css/pages/planning.css",
  "./css/pages/plus.css",
  "./css/pages/recherche.css",
  "./css/pages/reset-password.css",
  "./css/pages.css",
  "./css/themes/animations-common.css",
  "./css/themes/anniversaire-juliie.css",
  "./css/themes/anniversaire-marion.css",
  "./css/themes/automne.css",
  "./css/themes/catalog.css",
  "./css/themes/chic-noir.css",
  "./css/themes/cocooning.css",
  "./css/themes/disco.css",
  "./css/themes/floral.css",
  "./css/themes/galaxy.css",
  "./css/themes/halloween.css",
  "./css/themes/hiver.css",
  "./css/themes/noel.css",
  "./css/themes/nouvel-an.css",
  "./css/themes/paques.css",
  "./css/themes/plage.css",
  "./css/themes/premium-scenes.css",
  "./css/themes/printemps.css",
  "./css/themes/rose-gold.css",
  "./css/themes/saint-valentin.css",
  "./css/themes/theme-effects.css",
  "./css/themes/theme-vars.css",
  "./css/themes/tropical.css",
  "./js/core/auth.js",
  "./js/core/data.js",
  "./js/core/domain.js",
  "./js/core/form-absences.js",
  "./js/core/form-accounts.js",
  "./js/core/form-clients.js",
  "./js/core/form-holidays.js",
  "./js/core/form-reservations.js",
  "./js/core/form-services.js",
  "./js/core/form-state.js",
  "./js/core/forms.js",
  "./js/core/supabase-client.js",
  "./js/core/supabase-data.js",
  "./js/core/ui.js",
  "./js/core/utils.js",
  "./js/pages/clients.js",
  "./js/pages/comptes.js",
  "./js/pages/fiche-caisse.js",
  "./js/pages/login.js",
  "./js/pages/planning.js",
  "./js/pages/plus.js",
  "./js/pages/recherche.js",
  "./js/pages/reset-password.js",
  "./js/themes/seasonal-theme-resolver.js",
  "./js/themes/theme-bootstrap.js",
  "./js/themes/theme-config.js",
  "./js/themes/theme-decorations.js",
  "./js/themes/theme-manager.js",
  "./js/themes/theme-preferences.js",
  "./js/ui/appearance-card.js",
  "./js/ui/settings-card.js",
  "./js/vendor/jspdf.umd.min.js",
  "./assets/img/branding/favicon.png",
  "./assets/img/branding/logo.png",
  "./assets/img/profiles/adminlogo.png",
  "./assets/img/profiles/logojuliie.png",
  "./assets/img/profiles/logomarion.png",
  "./assets/img/themes/autumn/copper.png",
  "./assets/img/themes/beach/vacation.png",
  "./assets/img/themes/chic-black-gold/luxury.png",
  "./assets/img/themes/christmas/fir-luxury.png",
  "./assets/img/themes/cocooning/cozy.png",
  "./assets/img/themes/disco/nightlife.png",
  "./assets/img/themes/floral/flowers.png",
  "./assets/img/themes/galaxy/cosmos.png",
  "./assets/img/themes/halloween/pumpkin-botanical.png",
  "./assets/img/themes/new-year/champagne.png",
  "./assets/img/themes/rose-gold/marble.png",
  "./assets/img/themes/special/anniversaire-juliie-ballons.webp",
  "./assets/img/themes/special/anniversaire-marion-violet.webp",
  "./assets/img/themes/special/paques-scene.webp",
  "./assets/img/themes/special/saint-valentin-scene.webp",
  "./assets/img/themes/spring/flowers.png",
  "./assets/img/themes/tropical/foliage.png",
  "./assets/img/themes/winter/frost.png"
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

  // Reseau d'abord pour les pages HTML, le code JS et les feuilles CSS :
  // pendant le developpement (et en general), la derniere version deployee
  // doit toujours s'afficher quand le reseau est disponible. Le cache ne
  // sert que de secours hors-ligne, plus de source par defaut.
  var isNavigationOrAppCode = event.request.mode === "navigate" ||
    (requestUrl.origin === SAME_ORIGIN && (
      requestUrl.pathname.endsWith(".js") ||
      requestUrl.pathname.endsWith(".css")
    ));

  if (isNavigationOrAppCode) {
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
  //
  // Reponses "opaques" (type "opaque") : un script charge SANS crossorigin
  // est mis en cache sous forme opaque. Depuis l'ajout de l'integrite SRI
  // (integrity + crossorigin="anonymous") sur le SDK Supabase, le navigateur
  // demande ce fichier en mode CORS : lui renvoyer une reponse opaque est
  // interdit et bloque le script -> window.supabase absent -> "Supabase
  // n'est pas configure". On ignore donc toute reponse opaque en cache et on
  // n'en met plus jamais en cache.
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached && cached.type !== "opaque") {
        return cached;
      }

      return fetch(event.request).then(function (response) {
        if (response.ok && response.type !== "opaque") {
          return putInCache(event.request, response);
        }
        return response;
      });
    })
  );
});
