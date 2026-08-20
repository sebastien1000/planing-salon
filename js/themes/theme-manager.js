// Theme Engine par collaborateur. L'apparence est appliquée localement en
// premier, puis synchronisée avec Supabase sans jamais bloquer le planning.
(function () {
  var config = window.SalonThemeConfig;
  var resolver = window.SalonSeasonalTheme;
  var store = window.SalonThemePreferences;
  var preference = store.loadLocal(store.currentUserId());

  function reducedMotionPreferred() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function applyToDom() {
    var themeId = config.isValidThemeId(preference.selectedTheme) ? preference.selectedTheme : "default";
    var animations = preference.animationsEnabled && !reducedMotionPreferred();
    document.documentElement.setAttribute("data-theme", themeId);
    document.documentElement.setAttribute("data-animations", animations ? "on" : "off");
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
      return Promise.resolve(false);
    }

    preference.selectedTheme = activation.theme;
    preference.lastSeasonalActivationId = activation.activationId;
    preference.updatedAt = new Date().toISOString();
    applyToDom();
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
    if (!config.isValidThemeId(themeId)) {
      return Promise.resolve(false);
    }
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
      animationsEnabled: preference.animationsEnabled,
      lastSeasonalActivationId: preference.lastSeasonalActivationId,
      currentSeasonalActivation: seasonal
    };
  }

  function init() {
    applyToDom();
    sync();
  }

  window.SalonTheme = {
    activateSeasonOnce: activateSeasonOnce,
    getState: getState,
    init: init,
    setAnimationsEnabled: setAnimationsEnabled,
    setTheme: setTheme,
    sync: sync
  };

  init();
}());
