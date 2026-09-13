// Theme Engine par collaborateur. L'apparence est appliquée localement en
// premier, puis synchronisée avec Supabase sans jamais bloquer le planning.
(function () {
  var config = window.SalonThemeConfig;
  var resolver = window.SalonSeasonalTheme;
  var store = window.SalonThemePreferences;
  var preference = store.loadLocal(store.currentUserId());
  // Aperçu administrateur limité à cette page, jamais persisté ni synchronisé.
  var previewTheme = null;
  var dayTimer;

  function canPreviewSpecialThemes() {
    var auth = window.SalonAuth;
    var user = auth && auth.getCurrentUser();
    return !!(user && user.active !== false && user.id === preference.userId && auth.isAdmin(user));
  }

  function previewSpecialTheme(themeId) {
    if (!canPreviewSpecialThemes()) return false;
    var special = config.specialThemeById(themeId);
    if (!special) return false;
    previewTheme = special;
    applyToDom();
    return true;
  }

  function stopSpecialThemePreview() {
    previewTheme = null;
    applyToDom();
  }

  function reducedMotionPreferred() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function resolveCurrentTheme(referenceDate) {
    if (previewTheme && !canPreviewSpecialThemes()) previewTheme = null;
    if (previewTheme) return { theme: previewTheme.id, special: previewTheme };

    var baseTheme = config.isSelectableThemeId(preference.selectedTheme) ? preference.selectedTheme : "default";
    return preference.userId
      ? resolver.resolveTheme(referenceDate || new Date(), baseTheme)
      : { theme: baseTheme, special: null };
  }

  function applyToDom(referenceDate) {
    var resolved = resolveCurrentTheme(referenceDate);
    var themeId = resolved.theme;
    var animations = preference.animationsEnabled && !reducedMotionPreferred();
    var root = document.documentElement;
    var message = resolved.special ? resolved.special.message || "" : "";

    root.setAttribute("data-theme", themeId);
    root.toggleAttribute("data-special-theme", !!resolved.special);
    root.style.setProperty("--special-message", JSON.stringify(message));
    root.setAttribute("data-animations", animations ? "on" : "off");
    store.saveLocal(preference);

    if (window.SalonThemeDecorations) {
      window.SalonThemeDecorations.render(themeId, animations);
    }

    document.dispatchEvent(new CustomEvent("salonthemechange", {
      detail: { theme: themeId, animationsEnabled: animations }
    }));
  }

  function saveBestEffort() {
    store.saveLocal(preference);
    return store.saveRemote(preference).catch(function () {
      // Hors ligne/table absente/RLS : l'app et le cache local continuent.
      return null;
    });
  }

  function activateSeasonOnce(referenceDate) {
    if (!preference.userId) {
      return Promise.resolve(false);
    }

    var activation = resolver.getSeasonalActivation(referenceDate || new Date());
    if (!activation || activation.activationId === preference.lastSeasonalActivationId) {
      applyToDom(referenceDate);
      return Promise.resolve(false);
    }

    preference.selectedTheme = activation.theme;
    preference.lastSeasonalActivationId = activation.activationId;
    preference.updatedAt = new Date().toISOString();
    applyToDom(referenceDate);
    return saveBestEffort().then(function () { return true; });
  }

  function sync() {
    if (!preference.userId) {
      applyToDom();
      return Promise.resolve();
    }

    return store.loadRemote(preference.userId).then(function (remote) {
      if (remote) {
        var localTime = preference.updatedAt ? Date.parse(preference.updatedAt) : 0;
        var remoteTime = remote.updatedAt ? Date.parse(remote.updatedAt) : 0;
        if (localTime > remoteTime) {
          // Choix effectué hors ligne : le cache le plus récent gagne et
          // repart vers Supabase au lieu d'être écrasé par une vieille ligne.
          return saveBestEffort().then(function () {
            return activateSeasonOnce(new Date());
          });
        }
        preference = remote;
        applyToDom();
      }
      return activateSeasonOnce(new Date());
    }).catch(function () {
      // Supabase indisponible : la règle saisonnière s'applique aussi au
      // cache local et sera synchronisée lors d'une prochaine ouverture.
      return activateSeasonOnce(new Date());
    });
  }

  function setTheme(themeId) {
    if (!config.isSelectableThemeId(themeId)) {
      return Promise.resolve(false);
    }
    previewTheme = null;
    preference.selectedTheme = themeId;
    preference.updatedAt = new Date().toISOString();
    // lastSeasonalActivationId est volontairement conservé : le thème de
    // la saison ne reviendra pas au prochain chargement.
    applyToDom();
    return saveBestEffort().then(function () { return true; });
  }

  function setAnimationsEnabled(enabled) {
    preference.animationsEnabled = !!enabled;
    preference.updatedAt = new Date().toISOString();
    applyToDom();
    return saveBestEffort();
  }

  function getState() {
    var seasonal = resolver.getSeasonalActivation(new Date());
    return {
      userId: preference.userId,
      selectedTheme: preference.selectedTheme,
      effectiveTheme: document.documentElement.getAttribute("data-theme"),
      previewTheme: previewTheme ? previewTheme.id : null,
      animationsEnabled: preference.animationsEnabled,
      lastSeasonalActivationId: preference.lastSeasonalActivationId,
      currentSeasonalActivation: seasonal
    };
  }

  function refreshCalendar() {
    window.clearTimeout(dayTimer);
    var now = new Date();
    activateSeasonOnce(now);
    var midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    dayTimer = window.setTimeout(refreshCalendar, midnight - now + 100);
  }

  function init() {
    applyToDom();
    sync().then(refreshCalendar);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refreshCalendar();
    });
    window.addEventListener("pageshow", refreshCalendar);
    window.addEventListener("focus", refreshCalendar);
    var motion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion && motion.addEventListener) motion.addEventListener("change", function () { applyToDom(); });
  }

  window.SalonTheme = {
    activateSeasonOnce: activateSeasonOnce,
    getState: getState,
    previewSpecialTheme: previewSpecialTheme,
    stopSpecialThemePreview: stopSpecialThemePreview,
    init: init,
    setAnimationsEnabled: setAnimationsEnabled,
    setTheme: setTheme,
    sync: sync
  };

  init();
}());
