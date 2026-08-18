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

  // Une ligne par option activable/desactivable (voir js/core/data.js,
  // loadSettings/saveSettings) : ajouter une future option = ajouter une
  // entree ici, pas de nouvelle carte a creer.
  var SETTINGS_TOGGLES = [
    {
      key: "autoProposeNextRdv",
      label: "Proposer automatiquement le prochain RDV",
      hint: "A la fin d'un rendez-vous (bouton \"Terminer\"), ouvre une proposition de prochaine visite pour la cliente."
    }
  ];

  function settingsCardHtml() {
    var rows = SETTINGS_TOGGLES.map(function (toggle) {
      return [
        '<label class="row" style="align-items:flex-start;gap:10px;margin-top:10px">',
        '  <input type="checkbox" data-setting-key="' + toggle.key + '"' + (settings[toggle.key] ? " checked" : "") + '>',
        '  <span class="grow"><b>' + toggle.label + '</b><div class="tiny">' + toggle.hint + '</div></span>',
        "</label>"
      ].join("");
    }).join("");

    return [
      '<div class="card">',
      "  <h3>Paramètres</h3>",
      rows,
      "</div>"
    ].join("");
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

    document.querySelectorAll("[data-setting-key]").forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        settings[checkbox.dataset.settingKey] = checkbox.checked;
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
    forms.renderServicesSection("servicesSection", user);
  }

  render();
}());
