// Persistance des préférences d'apparence, isolée par UUID utilisateur.
// Le cache local est immédiat et non bloquant ; Supabase reste la source
// de vérité multi-appareils quand la migration dédiée est installée.
(function () {
  var KEY_PREFIX = "salonThemePreference:";
  var AUTH_KEY = "salonCurrentUserId";

  function userId() {
    try {
      return localStorage.getItem(AUTH_KEY) || null;
    } catch (error) {
      return null;
    }
  }

  function defaults(id) {
    return {
      userId: id || null,
      selectedTheme: "default",
      animationsEnabled: true,
      lastSeasonalActivationId: null,
      updatedAt: null
    };
  }

  function normalize(raw, id) {
    var config = window.SalonThemeConfig;
    var value = Object.assign(defaults(id), raw || {});
    value.userId = id || null;
    value.selectedTheme = config && config.isValidThemeId(value.selectedTheme) ? value.selectedTheme : "default";
    value.animationsEnabled = value.animationsEnabled !== false;
    value.lastSeasonalActivationId = value.lastSeasonalActivationId || null;
    return value;
  }

  function loadLocal(id) {
    if (!id) {
      return defaults(null);
    }
    try {
      return normalize(JSON.parse(localStorage.getItem(KEY_PREFIX + id) || "null"), id);
    } catch (error) {
      return defaults(id);
    }
  }

  function saveLocal(preference) {
    if (!preference || !preference.userId) {
      return;
    }
    try {
      localStorage.setItem(KEY_PREFIX + preference.userId, JSON.stringify(preference));
    } catch (error) {
      // Quota/navigation privée : la préférence reste valable en mémoire.
    }
  }

  function fromRow(row, id) {
    return normalize({
      selectedTheme: row.selected_theme,
      animationsEnabled: row.animations_enabled,
      lastSeasonalActivationId: row.last_seasonal_activation_id,
      updatedAt: row.updated_at
    }, id);
  }

  function loadRemote(id) {
    var api = window.SalonSupabaseData;
    if (!id || !window.SalonSupabaseConfigured || !api || !api.getThemePreference) {
      return Promise.resolve(null);
    }
    return api.getThemePreference(id).then(function (row) {
      return row ? fromRow(row, id) : null;
    });
  }

  function saveRemote(preference) {
    var api = window.SalonSupabaseData;
    if (!preference.userId || !window.SalonSupabaseConfigured || !api || !api.saveThemePreference) {
      return Promise.resolve(null);
    }
    return api.saveThemePreference({
      user_id: preference.userId,
      selected_theme: preference.selectedTheme,
      animations_enabled: preference.animationsEnabled,
      last_seasonal_activation_id: preference.lastSeasonalActivationId,
      updated_at: new Date().toISOString()
    });
  }

  window.SalonThemePreferences = {
    currentUserId: userId,
    defaults: defaults,
    loadLocal: loadLocal,
    loadRemote: loadRemote,
    saveLocal: saveLocal,
    saveRemote: saveRemote
  };
}());
