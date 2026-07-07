(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var forms = window.SalonForms;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  var user = ui.initAppPage({
    activePage: "recherche",
    actions: {},
    pageTitle: "Recherche"
  });

  if (!user) {
    return;
  }

  var db = data.loadDb();

  forms.configure({
    db: db,
    refresh: render,
    user: user
  });

  function filteredReservations(query) {
    var text = query.toLowerCase();
    return db.reservations.filter(function (reservation) {
      return [
        reservation.client,
        reservation.collab,
        reservation.prestation,
        reservation.room,
        reservation.notes,
        reservation.date,
        reservation.time
      ].join(" ").toLowerCase().includes(text);
    });
  }

  function reservationPrice(reservation) {
    var prestation = db.prestations.find(function (item) {
      return item.name === reservation.prestation;
    });
    return prestation ? prestation.price : 0;
  }

  function reservationClient(reservation) {
    return db.clients.find(function (client) {
      return client.id === reservation.clientId || client.name === reservation.client;
    }) || null;
  }

  function renderSearchCard(reservation) {
    var own = auth.canSeeReservation(user, reservation);
    var client = reservationClient(reservation);
    var endTime = domain.addMinutes(reservation.time, reservation.duration);

    if (!own) {
      return [
        '<div class="card rsv">',
        '  <div class="row">',
        '    <div class="grow">',
        '      <h3>Reserve - ' + utils.escapeHtml(reservation.collab) + "</h3>",
        '      <div class="tiny">' + utils.escapeHtml(domain.fullDateLabel(reservation.date)) + "</div>",
        '      <div class="tiny">' + utils.escapeHtml(reservation.time) + " - " + utils.escapeHtml(endTime) + "</div>",
        "    </div>",
        '    <span class="badge status-' + reservation.status + '">' + utils.escapeHtml(domain.getStatusLabel(reservation.status)) + "</span>",
        "  </div>",
        "</div>"
      ].join("");
    }

    return [
      '<div class="card rsv">',
      "  <h3>" + utils.escapeHtml(reservation.client) + "</h3>",
      '  <div class="tiny">' + utils.escapeHtml(domain.fullDateLabel(reservation.date)) + "</div>",
      '  <div class="tiny">' + utils.escapeHtml(reservation.time) + " - " + utils.escapeHtml(endTime) + "</div>",
      '  <div class="meta">',
      '    <span class="badge">' + utils.escapeHtml(reservation.collab) + "</span>",
      '    <span class="badge">' + utils.escapeHtml(reservation.room) + "</span>",
      "  </div>",
      '  <div class="tiny">' + utils.escapeHtml(reservation.prestation) + " · " + reservationPrice(reservation) + " EUR</div>",
      '  <div class="tiny">Statut : ' + utils.escapeHtml(domain.getStatusLabel(reservation.status)) + "</div>",
      (reservation.notes ? '<div class="tiny">Notes : ' + utils.escapeHtml(reservation.notes) + "</div>" : ""),
      (client && client.phone ? '<div class="tiny">Tel : ' + utils.escapeHtml(client.phone) + "</div>" : ""),
      '  <div class="row rsv-actions" style="margin-top:10px">',
      '    <button class="secondary grow" type="button" data-action="view-reservation" data-id="' + reservation.id + '">Voir</button>',
      '    <button class="secondary grow" type="button" data-action="reschedule-reservation" data-id="' + reservation.id + '">Decaler</button>',
      '    <button class="secondary danger" type="button" data-action="cancel-reservation" data-id="' + reservation.id + '">Annuler</button>',
      '    <button class="secondary grow" type="button" data-action="done-reservation" data-id="' + reservation.id + '">Terminer</button>',
      "  </div>",
      "</div>"
    ].join("");
  }

  function renderResults(query) {
    var root = ui.byId("results");
    var reservations = filteredReservations(query);

    root.innerHTML = reservations.length
      ? reservations.map(renderSearchCard).join("")
      : '<div class="empty">Aucun resultat</div>';

    forms.bindReservationCardActions(root);
  }

  function render() {
    ui.setMain([
      '<input id="searchInput" class="field search-box" placeholder="Rechercher cliente, RDV, prestation, salle">',
      '<div id="results" class="cards"></div>'
    ].join(""));

    var field = ui.byId("searchInput");
    field.addEventListener("input", function () {
      renderResults(field.value || "");
    });
    renderResults("");
  }

  render();
}());
