(function () {
  var auth = window.SalonAuth;
  var ui = window.SalonUI;

  // Apparence personnelle : disponible à chaque collaborateur et
  // synchronisée par compte. Seul le thème saisonnier courant est présenté,
  // accompagné des sept thèmes permanents.
  function render(user) {
    var themeApi = window.SalonTheme;
    var themeConfig = window.SalonThemeConfig;

    if (!themeApi || !themeConfig) {
      return "";
    }

    var state = themeApi.getState();
    var activation = state.currentSeasonalActivation;

    function option(theme, group) {
      if (!theme || theme.hiddenFromThemeSelector) return "";
      var checked = state.selectedTheme === theme.id ? " checked" : "";
      return [
        '<label class="theme-choice" data-preview-theme="' + theme.id + '">',
        '  <input type="radio" name="appearanceTheme" value="' + theme.id + '"' + checked + '>',
        '  <span class="theme-choice-preview" aria-hidden="true"></span>',
        '  <span class="theme-choice-copy"><b>' + theme.label + '</b><small>' + group + '</small></span>',
        '</label>'
      ].join("");
    }

    function specialPreviewOption(theme) {
      return [
        '<button type="button" class="theme-choice special-theme-preview" data-special-theme-preview="' + theme.id +
          '" data-preview-theme="' + theme.id + '" aria-pressed="' + (state.previewTheme === theme.id) + '">',
        '  <span class="theme-choice-preview" aria-hidden="true"></span>',
        '  <span class="theme-choice-copy"><b>' + window.SalonUtils.escapeHtml(theme.label) + '</b><small>Voir l’aperçu</small></span>',
        '</button>'
      ].join("");
    }

    var normal = option(themeConfig.themeById("default"), "Sobre et proche de l’application actuelle");
    var seasonal = "";
    if (auth.isAdmin(user)) {
      seasonal = [
        '<div class="theme-group-title">Thèmes saisonniers · Administrateur</div>',
        '<div class="theme-choice-grid">',
        themeConfig.SEASONAL_THEME_IDS.map(function (id) {
          var isCurrent = activation && activation.theme === id;
          return option(themeConfig.themeById(id), isCurrent ? "Saison actuelle" : "Aperçu administrateur");
        }).join(""),
        themeConfig.SPECIAL_THEMES.map(specialPreviewOption).join(""),
        '</div>',
        '<div id="specialThemePreviewStatus" class="tiny" role="status" style="margin-top:10px"></div>',
        '<button id="stopSpecialThemePreview" type="button" class="secondary" hidden>Terminer l’aperçu</button>'
      ].join("");
    } else if (activation) {
      var seasonalTheme = themeConfig.themeById(activation.theme);
      seasonal = [
        '<div class="theme-group-title">Saison actuelle</div>',
        option(seasonalTheme, "Disponible pendant sa période")
      ].join("");
    }

    var permanent = themeConfig.PERMANENT_THEME_IDS.map(function (id) {
      return option(themeConfig.themeById(id), "Disponible toute l’année");
    }).join("");

    return [
      '<div class="card appearance-card">',
      "  <h3>Apparence</h3>",
      '  <div class="tiny">Ce réglage vous appartient et suit votre compte sur vos appareils.</div>',
      '  <div class="theme-group-title">Thème</div>',
      normal,
      seasonal,
      '  <div class="theme-group-title">Thèmes permanents</div>',
      '  <div class="theme-choice-grid">' + permanent + '</div>',
      '  <div class="theme-group-title">Animations</div>',
      '  <div class="appearance-animation-row">',
      '    <div class="tiny">Les couleurs et décorations restent, seuls les mouvements s\'arrêtent.</div>',
      '    <select id="themeAnimationsSelect" class="field" style="margin-top:6px">',
      '      <option value="on"' + (state.animationsEnabled ? " selected" : "") + ">Activées</option>",
      '      <option value="off"' + (!state.animationsEnabled ? " selected" : "") + ">Désactivées</option>",
      "    </select>",
      "  </div>",
      "</div>"
    ].join("");
  }

  function bind(user) {
    var themeApi = window.SalonTheme;
    if (!themeApi) {
      return;
    }

    document.querySelectorAll('input[name="appearanceTheme"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (radio.checked) {
          themeApi.setTheme(radio.value);
          updatePreviewControls();
        }
      });
    });

    function updatePreviewControls() {
      var previewId = themeApi.getState().previewTheme;
      document.querySelectorAll("[data-special-theme-preview]").forEach(function (button) {
        button.setAttribute("aria-pressed", String(button.dataset.specialThemePreview === previewId));
      });
      var stop = ui.byId("stopSpecialThemePreview");
      if (stop) stop.hidden = !previewId;
      var status = ui.byId("specialThemePreviewStatus");
      var theme = window.SalonThemeConfig.specialThemeById(previewId);
      if (status) status.textContent = theme ? "Aperçu : " + theme.label + " — jusqu’à la fermeture de cette page." : "";
    }

    if (auth.isAdmin(user)) {
      document.querySelectorAll("[data-special-theme-preview]").forEach(function (button) {
        button.addEventListener("click", function () {
          themeApi.previewSpecialTheme(button.dataset.specialThemePreview);
          updatePreviewControls();
        });
      });
      var stopPreview = ui.byId("stopSpecialThemePreview");
      if (stopPreview) stopPreview.addEventListener("click", function () {
        themeApi.stopSpecialThemePreview();
        updatePreviewControls();
      });
      updatePreviewControls();
    }

    var animationsSelect = ui.byId("themeAnimationsSelect");
    if (animationsSelect) {
      animationsSelect.addEventListener("change", function () {
        themeApi.setAnimationsEnabled(animationsSelect.value === "on");
      });
    }
  }

  window.SalonAppearanceCard = { render: render, bind: bind };
}());
