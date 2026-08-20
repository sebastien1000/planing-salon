(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var forms = window.SalonForms;
  var supabaseData = window.SalonSupabaseData;
  var ui = window.SalonUI;

  var user = ui.initAppPage({
    activePage: "plus",
    actions: {},
    pageTitle: "Plus"
  });

  if (!user) {
    return;
  }

  var db = data.loadDb();
  var selectedDate = sessionStorage.getItem("planning:date") || window.SalonUtils.today();
  var absences = [];
  var settings = data.loadSettings();

  forms.configure({
    db: db,
    refresh: render,
    selectedDate: selectedDate,
    user: user
  });

  function sortByStartDate(list) {
    return list.slice().sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });
  }

  // Une entree par option configurable depuis Plus (voir js/core/data.js,
  // loadSettings/saveSettings) : ajouter une future option = ajouter une
  // entree ici (type "checkbox" ou "select"), pas de nouvelle carte a creer.
  var SETTINGS_FIELDS = [
    {
      key: "autoProposeNextRdv",
      type: "checkbox",
      label: "Proposer automatiquement le prochain RDV",
      hint: "A la fin d'un rendez-vous (bouton \"Terminer\"), ouvre une proposition de prochaine visite pour la cliente."
    },
    {
      key: "defaultPlanningView",
      type: "select",
      label: "Vue du planning par defaut",
      hint: "Vue affichee a l'ouverture du Planning (un changement de vue pendant la session reste toujours prioritaire).",
      options: [
        ["", "Automatique"],
        ["day", "Jour"],
        ["week", "Semaine"],
        ["month", "Mois"]
      ]
    }
  ];

  function settingsFieldHtml(field) {
    if (field.type === "select") {
      var optionsHtml = field.options.map(function (option) {
        var selected = settings[field.key] === option[0] ? " selected" : "";
        return '<option value="' + option[0] + '"' + selected + ">" + option[1] + "</option>";
      }).join("");

      return [
        '<div style="margin-top:10px">',
        '  <label for="setting-' + field.key + '"><b>' + field.label + "</b></label>",
        '  <div class="tiny">' + field.hint + "</div>",
        '  <select id="setting-' + field.key + '" class="field" data-setting-key="' + field.key + '" style="margin-top:6px">' +
          optionsHtml + "</select>",
        "</div>"
      ].join("");
    }

    return [
      '<label class="row" style="align-items:flex-start;gap:10px;margin-top:10px">',
      '  <input type="checkbox" data-setting-key="' + field.key + '"' + (settings[field.key] ? " checked" : "") + '>',
      '  <span class="grow"><b>' + field.label + '</b><div class="tiny">' + field.hint + '</div></span>',
      "</label>"
    ].join("");
  }

  function settingsCardHtml() {
    return [
      '<div class="card">',
      "  <h3>Paramètres</h3>",
      SETTINGS_FIELDS.map(settingsFieldHtml).join(""),
      "</div>"
    ].join("");
  }

  // Apparence personnelle : disponible à chaque collaborateur et
  // synchronisée par compte. Seul le thème saisonnier courant est présenté,
  // accompagné des sept thèmes permanents.
  function appearanceCardHtml() {
    var themeApi = window.SalonTheme;
    var themeConfig = window.SalonThemeConfig;

    if (!themeApi || !themeConfig) {
      return "";
    }

    var state = themeApi.getState();
    var activation = state.currentSeasonalActivation;

    function option(theme, group) {
      var checked = state.selectedTheme === theme.id ? " checked" : "";
      return [
        '<label class="theme-choice" data-preview-theme="' + theme.id + '">',
        '  <input type="radio" name="appearanceTheme" value="' + theme.id + '"' + checked + '>',
        '  <span class="theme-choice-preview" aria-hidden="true"></span>',
        '  <span class="theme-choice-copy"><b>' + theme.label + '</b><small>' + group + '</small></span>',
        '</label>'
      ].join("");
    }

    var normal = option(themeConfig.themeById("default"), "Sobre et proche de l’application actuelle");
    var seasonal = "";
    if (auth.isAdmin(user)) {
      var seasonalIds = ["nouvel-an", "hiver", "printemps", "plage", "automne", "halloween", "noel"];
      seasonal = [
        '<div class="theme-group-title">Thèmes saisonniers · Administrateur</div>',
        '<div class="theme-choice-grid">',
        seasonalIds.map(function (id) {
          var isCurrent = activation && activation.theme === id;
          return option(themeConfig.themeById(id), isCurrent ? "Saison actuelle" : "Aperçu administrateur");
        }).join(""),
        '</div>'
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

  function bindAppearanceCardActions() {
    var themeApi = window.SalonTheme;
    if (!themeApi) {
      return;
    }

    document.querySelectorAll('input[name="appearanceTheme"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (radio.checked) {
          themeApi.setTheme(radio.value);
        }
      });
    });

    var animationsSelect = ui.byId("themeAnimationsSelect");
    if (animationsSelect) {
      animationsSelect.addEventListener("change", function () {
        themeApi.setAnimationsEnabled(animationsSelect.value === "on");
      });
    }
  }

  function bindActions() {
    ui.byId("addAbsenceButton").addEventListener("click", function () {
      forms.openAbsenceForm();
    });

    forms.bindAbsenceCardActions(ui.byId("myAbsenceList"));

    var teamAbsenceList = ui.byId("teamAbsenceList");
    if (teamAbsenceList) {
      forms.bindAbsenceCardActions(teamAbsenceList);
    }

    document.querySelectorAll("[data-setting-key]").forEach(function (field) {
      field.addEventListener("change", function () {
        settings[field.dataset.settingKey] = field.type === "checkbox" ? field.checked : field.value;
        settings = data.saveSettings(settings);
      });
    });
  }

  function showLoadError(error) {
    ui.setMain([
      '<div class="card">',
      '  <div class="alert">Impossible de charger les donnees depuis Supabase. Verifiez la configuration et votre connexion.</div>',
      "</div>"
    ].join(""));
    window.console && window.console.error && window.console.error(error);
  }

  function render() {
    Promise.all([
      supabaseData.listAllReservations(),
      supabaseData.listClients(),
      supabaseData.listBlockedPeriods()
    ]).then(function (results) {
      absences = results[2].filter(function (item) { return item.kind === "absence"; });
      renderContent(results[0], results[1]);
    }).catch(showLoadError);
  }

  function renderContent(reservations, clients) {
    forms.configure({
      db: db,
      refresh: render,
      selectedDate: selectedDate,
      user: user,
      reservations: reservations,
      clients: clients,
      absences: absences
    });

    var waiting = clients.filter(function (client) {
      return !client.nextDate;
    }).length;

    var myAbsences = sortByStartDate(absences.filter(function (item) {
      return item.collab === user.name;
    }));
    var teamAbsences = auth.isAdmin(user)
      ? sortByStartDate(absences.filter(function (item) { return item.collab !== user.name; }))
      : [];

    ui.setMain([
      '<div class="cards">',
      appearanceCardHtml(),
      settingsCardHtml(),
      '  <div class="card"><h3>Notifications internes</h3><p>' + waiting + ' cliente(s) sans prochain RDV valide.</p></div>',
      '  <div class="card">',
      "    <h3>" + (auth.isAdmin(user) ? "Prestations par collaboratrice" : "Mes prestations") + "</h3>",
      '    <div class="tiny">' + (auth.isAdmin(user)
        ? "Chaque collaboratrice a son propre tarif et sa propre duree pour chaque prestation."
        : "Ajoutez ou modifiez vos propres tarifs et durees a tout moment.") + "</div>",
      '    <div id="servicesSection" style="margin-top:12px"></div>',
      "  </div>",
      '  <div class="card">',
      '    <div class="row">',
      '      <div class="grow"><h3>Mes absences</h3></div>',
      '      <button id="addAbsenceButton" class="primary" type="button">+ Ajouter</button>',
      "    </div>",
      '    <div id="myAbsenceList" class="cards" style="margin-top:12px">' +
        (myAbsences.length ? myAbsences.map(forms.absenceCard).join("") : '<div class="empty">Aucune absence</div>') +
        "</div>",
      "  </div>",
      auth.isAdmin(user) ? [
        '  <div class="card">',
        "    <h3>Absences de l equipe</h3>",
        '    <div id="teamAbsenceList" class="cards" style="margin-top:12px">' +
          (teamAbsences.length ? teamAbsences.map(forms.absenceCard).join("") : '<div class="empty">Aucune absence</div>') +
          "</div>",
        "  </div>"
      ].join("") : "",
      "</div>"
    ].join(""));

    bindActions();
    bindAppearanceCardActions();
    forms.renderServicesSection("servicesSection", user);
  }

  render();
}());
