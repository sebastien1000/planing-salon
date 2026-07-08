(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var forms = window.SalonForms;
  var supabaseData = window.SalonSupabaseData;
  var ui = window.SalonUI;

  var user = ui.initAppPage({
    activePage: "plus",
    actions: { photo: true },
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
  forms.bindPhotoInput();

  function sortByStartDate(list) {
    return list.slice().sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });
  }

  function bindActions() {
    ui.byId("addPrestationButton").addEventListener("click", function () {
      forms.openPrestationForm();
    });

    ui.byId("addAbsenceButton").addEventListener("click", function () {
      forms.openAbsenceForm();
    });

    forms.bindAbsenceCardActions(ui.byId("myAbsenceList"));

    var teamAbsenceList = ui.byId("teamAbsenceList");
    if (teamAbsenceList) {
      forms.bindAbsenceCardActions(teamAbsenceList);
    }

    ui.byId("resetDemoButton").addEventListener("click", function () {
      if (window.confirm("Remettre les donnees demo ?")) {
        db = data.resetDb();
        forms.configure({
          db: db,
          refresh: render,
          selectedDate: selectedDate,
          user: user
        });
        render();
      }
    });

    ui.byId("repairDataButton").addEventListener("click", function () {
      db = data.repairDb();
      forms.configure({
        db: db,
        refresh: render,
        selectedDate: selectedDate,
        user: user
      });
      render();
      window.alert("Les donnees locales ont ete verifiees et reparees.");
    });

    ui.byId("clearPhotosButton").addEventListener("click", function () {
      if (!window.confirm("Supprimer les photos enregistrees localement ?")) {
        return;
      }

      db = data.clearPhotos();
      forms.configure({
        db: db,
        refresh: render,
        selectedDate: selectedDate,
        user: user
      });
      render();
      window.alert("Les photos locales ont ete supprimees.");
    });

    forms.bindPrestationActions(document);
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
      '    <div class="row">',
      '      <div class="grow">',
      "        <h3>Prestations et prix</h3>",
      '        <div class="tiny">Bloc centralise pour les prestations.</div>',
      "      </div>",
      '      <button id="addPrestationButton" class="primary" type="button">+ Ajouter</button>',
      "    </div>",
      '    <div class="cards" style="margin-top:12px">' + db.prestations.map(forms.prestationCard).join("") + "</div>",
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
      '  <div class="card"><h3>Photo planning papier</h3><p class="tiny">Utilise l appareil photo du telephone.</p>' +
        (db.photos[0] ? '<img class="preview" src="' + db.photos[0] + '" alt="Planning photo">' : "") + "</div>",
      '  <div class="card">' +
        '    <h3>Maintenance</h3>' +
        '    <p class="tiny">Outils de reparation rapide pour les donnees locales et les photos en cache navigateur.</p>' +
        '    <div class="row">' +
        '      <button id="repairDataButton" class="secondary grow" type="button">Reparer les donnees</button>' +
        '      <button id="clearPhotosButton" class="secondary danger grow" type="button">Vider les photos</button>' +
        "    </div>" +
        "  </div>",
      '  <div class="card"><h3>Donnees demo</h3><button id="resetDemoButton" class="secondary danger" type="button">Reinitialiser les donnees demo</button></div>',
      "</div>"
    ].join(""));

    bindActions();
  }

  render();
}());
