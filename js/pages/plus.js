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

  forms.configure({
    db: db,
    refresh: render,
    selectedDate: selectedDate,
    user: user
  });

  function sortByStartDate(list) {
    return list.slice().sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });
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
      supabaseData.listClients()
    ]).then(function (results) {
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
      clients: clients
    });

    var waiting = clients.filter(function (client) {
      return !client.nextDate;
    }).length;

    var myAbsences = sortByStartDate(db.absences.filter(function (item) {
      return item.collab === user.name;
    }));
    var teamAbsences = auth.isAdmin(user)
      ? sortByStartDate(db.absences.filter(function (item) { return item.collab !== user.name; }))
      : [];

    ui.setMain([
      '<div class="cards">',
      '  <div class="card"><h3>Notifications internes</h3><p>' + waiting + ' cliente(s) sans prochain RDV valide.</p></div>',
      '  <div class="card">',
      "    <h3>" + (auth.isAdmin(user) ? "Prestations par collaboratrice" : "Mes prestations") + "</h3>",
      '    <div class="tiny">' + (auth.isAdmin(user)
        ? "Chaque collaboratrice a son propre tarif et sa propre duree pour chaque prestation."
        : "Vos tarifs et durees, definis par l administrateur.") + "</div>",
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
