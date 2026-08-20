// Theme Engine - gestionnaire central (voir js/themes/theme-config.js pour
// la configuration declarative et js/themes/theme-decorations.js pour le
// rendu des decorations). Applique le theme sur <html data-theme="..."> et
// pilote les animations ON/OFF, en local (localStorage, jamais bloquant)
// puis via Supabase si disponible (reglage partage pour tout le salon,
// voir supabase/migrations et js/core/supabase-data.js : getAppSettings /
// saveAppSettings). Ne touche jamais aux donnees metier (RDV, clients,
// auth) : uniquement l'apparence.
(function () {
  var STORAGE_KEY = "salonThemeV2";
  var config = window.SalonThemeConfig;

  function defaultState() {
    return {
      // "automatic" (defaut) : theme calcule depuis la date, voir
      // config.getSeasonalTheme. "manual" : "theme" ci-dessous est impose
      // par l'admin quel que soit la date.
      mode: "automatic",
      theme: "default",
      animationsEnabled: true,
      // Choix personnel, propre a cet appareil/cette collaboratrice - ne
      // part JAMAIS vers Supabase (voir setPersonalOverride) : n'importe
      // qui peut forcer "Normal" pour soi sans changer le theme choisi par
      // l'admin pour le reste du salon. null = suit le reglage du salon
      // (automatique ou impose par l'admin) ; "default" = force Normal ici.
      personalOverride: null,
      // Dernier theme reellement applique a l'ecran (calcule ou manuel) :
      // permet au petit script inline de <head> de le reappliquer
      // instantanement au chargement suivant, avant meme que ce fichier ne
      // s'execute, sans flash ni duplication du calcul de periode (voir
      // index.html etc.).
      lastEffectiveTheme: "default"
    };
  }

  function loadLocalState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return Object.assign(defaultState(), parsed);
    } catch (error) {
      return defaultState();
    }
  }

  function saveLocalState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Stockage indisponible (navigation privee, quota) : le theme reste
      // fonctionnel pour la session en cours, simplement pas persiste.
    }
  }

  var state = loadLocalState();

  function reducedMotionPreferred() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function effectiveTheme() {
    if (state.personalOverride === "default") {
      return "default";
    }

    if (state.mode === "manual" && config.isValidThemeId(state.theme)) {
      return state.theme;
    }

    return config.getSeasonalTheme(new Date());
  }

  function applyToDom(themeId, animationsEnabled) {
    var root = document.documentElement;
    var effectiveAnimations = animationsEnabled && !reducedMotionPreferred();

    root.setAttribute("data-theme", themeId);
    root.setAttribute("data-animations", effectiveAnimations ? "on" : "off");

    if (window.SalonThemeDecorations) {
      window.SalonThemeDecorations.render(themeId, effectiveAnimations);
    }

    document.dispatchEvent(new CustomEvent("salonthemechange", {
      detail: { theme: themeId, animationsEnabled: effectiveAnimations }
    }));
  }

  function apply() {
    var themeId = effectiveTheme();
    state.lastEffectiveTheme = themeId;
    saveLocalState(state);
    applyToDom(themeId, state.animationsEnabled);
  }

  // ---- Synchronisation Supabase (salon entier, best-effort) ----
  // Ne doit jamais empecher le planning de s'afficher : chaque etape est
  // deja appliquee localement avant meme que cet appel ne parte, et toute
  // erreur (pas connecte, table pas encore creee via
  // supabase/migrations/2026-08-20_app_settings_theme.sql...) est
  // silencieusement ignoree - le theme local/automatique reste actif.
  function supabaseData() {
    return window.SalonSupabaseData;
  }

  function canUseSupabase() {
    return !!(window.SalonSupabaseConfigured && supabaseData() && supabaseData().getAppSettings);
  }

  function syncFromSupabase() {
    if (!canUseSupabase()) {
      return;
    }

    supabaseData().getAppSettings().then(function (row) {
      if (!row) {
        return;
      }

      var changed = false;

      if ((row.theme_mode === "automatic" || row.theme_mode === "manual") && row.theme_mode !== state.mode) {
        state.mode = row.theme_mode;
        changed = true;
      }

      if (config.isValidThemeId(row.active_theme) && row.active_theme !== state.theme) {
        state.theme = row.active_theme;
        changed = true;
      }

      if (typeof row.animations_enabled === "boolean" && row.animations_enabled !== state.animationsEnabled) {
        state.animationsEnabled = row.animations_enabled;
        changed = true;
      }

      if (changed) {
        apply();
      }
    }).catch(function () {
      // Hors ligne, pas encore configure, ou table absente : on continue
      // avec le theme local/automatique, sans bloquer ni alerter l'utilisateur.
    });
  }

  function pushToSupabase(patch) {
    if (!canUseSupabase()) {
      return Promise.resolve();
    }

    var auth = window.SalonAuth;
    var user = auth && auth.getCurrentUser ? auth.getCurrentUser() : null;
    var payload = Object.assign({}, patch);

    if (user && user.id) {
      payload.updated_by = user.id;
    }

    return supabaseData().saveAppSettings(payload).catch(function () {
      // Ecriture refusee (droits RLS, hors ligne...) : le choix reste actif
      // localement sur cet appareil, simplement pas partage pour l'instant.
    });
  }

  // ---- API publique ----

  function init() {
    apply();
    syncFromSupabase();
  }

  function setAutomaticMode() {
    state.mode = "automatic";
    saveLocalState(state);
    apply();
    pushToSupabase({ theme_mode: "automatic" });
  }

  function setManualTheme(themeId) {
    if (!config.isValidThemeId(themeId)) {
      return;
    }

    state.mode = "manual";
    state.theme = themeId;
    saveLocalState(state);
    apply();
    pushToSupabase({ theme_mode: "manual", active_theme: themeId });
  }

  function setAnimationsEnabled(enabled) {
    state.animationsEnabled = !!enabled;
    saveLocalState(state);
    apply();
    pushToSupabase({ animations_enabled: !!enabled });
  }

  // Ouvert a tout le monde (pas seulement l'admin, voir js/pages/plus.js) :
  // "Normal" force le theme par defaut sur CET appareil uniquement, sans
  // jamais toucher a Supabase ni au reglage du salon - une collaboratrice
  // qui n'aime pas le theme du moment peut le desactiver pour elle-meme,
  // "Theme du jour" revient a suivre le reglage du salon.
  function setPersonalOverride(value) {
    state.personalOverride = value === "default" ? "default" : null;
    saveLocalState(state);
    apply();
  }

  function getState() {
    return {
      mode: state.mode,
      theme: state.theme,
      animationsEnabled: state.animationsEnabled,
      personalOverride: state.personalOverride,
      effectiveTheme: effectiveTheme()
    };
  }

  window.SalonTheme = {
    init: init,
    getState: getState,
    setAutomaticMode: setAutomaticMode,
    setManualTheme: setManualTheme,
    setAnimationsEnabled: setAnimationsEnabled,
    setPersonalOverride: setPersonalOverride
  };

  init();
}());
