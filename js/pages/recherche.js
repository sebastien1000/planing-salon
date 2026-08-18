(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var forms = window.SalonForms;
  var supabaseData = window.SalonSupabaseData;
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
  var reservations = [];
  var clients = [];
  var profiles = [];

  function matchesQuery(reservation, text) {
    return [
      reservation.client,
      reservation.collab,
      reservation.prestation,
      reservation.room,
      reservation.notes,
      reservation.date,
      reservation.time
    ].join(" ").toLowerCase().includes(text);
  }

  function filteredReservations(query) {
    var text = query.toLowerCase();
    return reservations.filter(function (reservation) {
      return matchesQuery(reservation, text);
    });
  }

  function matchesClientQuery(client, text) {
    return [
      client.name,
      client.phone,
      client.notes,
      client.prestation
    ].join(" ").toLowerCase().includes(text);
  }

  // Uniquement quand la recherche n'est pas vide : sans ca, chaque cliente
  // (meme sans aucun RDV a venir) apparaitrait ici des l'ouverture de la
  // page, en plus de la liste complete deja proposee par la page Clients.
  function filteredClients(query) {
    var text = query.toLowerCase();
    if (!text) {
      return [];
    }

    return clients.filter(function (client) {
      return matchesClientQuery(client, text);
    });
  }

  function reservationPrice(reservation) {
    if (reservation.price != null) {
      return reservation.price;
    }

    var prestation = db.prestations.find(function (item) {
      return item.name === reservation.prestation;
    });
    return prestation ? prestation.price : 0;
  }

  function reservationClient(reservation) {
    return clients.find(function (client) {
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
        '      <h3>Réservé - ' + utils.escapeHtml(reservation.collab) + "</h3>",
        '      <div class="tiny">' + utils.escapeHtml(domain.fullDateLabel(reservation.date)) + "</div>",
        '      <div class="tiny">' + utils.escapeHtml(reservation.time) + " - " + utils.escapeHtml(endTime) + "</div>",
        "    </div>",
        '    <span class="badge status-' + utils.escapeHtml(reservation.status) + '">' + utils.escapeHtml(domain.getStatusLabel(reservation.status)) + "</span>",
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

  function renderClientCard(client) {
    return [
      '<div class="card">',
      '  <div class="row">',
      '    <div class="grow">',
      "      <h3>" + utils.escapeHtml(client.name) + "</h3>",
      '      <div class="tiny">' + utils.escapeHtml(client.phone || "") + "</div>",
      "    </div>",
      '    <button class="secondary" type="button" data-client-id="' + client.id + '">Ouvrir</button>',
      "  </div>",
      "</div>"
    ].join("");
  }

  function renderResults(query) {
    var root = ui.byId("results");
    if (!root) {
      return;
    }

    // Champ vide : rien a afficher (plus les 332 RDV d'un coup au chargement
    // de la page) tant que l'utilisatrice n'a pas commence a taper.
    if (!query.trim()) {
      root.innerHTML = '<div class="empty">Tapez pour rechercher une cliente ou un rendez-vous.</div>';
      return;
    }

    var matchingClients = filteredClients(query);
    var results = filteredReservations(query);

    var clientsHtml = matchingClients.length
      ? '<h3 class="section-title">Clientes</h3>' + matchingClients.map(renderClientCard).join("")
      : "";
    var reservationsHtml = results.length
      ? (clientsHtml ? '<h3 class="section-title">Rendez-vous</h3>' : "") + results.map(renderSearchCard).join("")
      : "";

    root.innerHTML = clientsHtml || reservationsHtml
      ? clientsHtml + reservationsHtml
      : '<div class="empty">Aucun resultat</div>';

    forms.bindReservationCardActions(root);
    root.querySelectorAll("[data-client-id]").forEach(function (button) {
      button.addEventListener("click", function () {
        forms.openClientForm(button.dataset.clientId);
      });
    });
  }

  function showLoadError(error) {
    ui.setMain([
      '<div class="card">',
      '  <div class="alert">Impossible de charger les rendez-vous depuis Supabase. Verifiez la configuration et votre connexion.</div>',
      "</div>"
    ].join(""));
    window.console && window.console.error && window.console.error(error);
  }

  function render() {
    Promise.all([
      supabaseData.listAllReservations(),
      supabaseData.listClients(),
      supabaseData.listProfiles()
    ]).then(function (results) {
      reservations = results[0];
      clients = results[1];
      profiles = results[2];

      forms.configure({
        db: db,
        refresh: render,
        user: user,
        clients: clients,
        reservations: reservations,
        profiles: profiles
      });

      ui.setMain([
        '<input id="searchInput" class="field search-box" placeholder="Rechercher cliente, RDV, prestation, salle">',
        '<div id="results" class="cards"></div>'
      ].join(""));

      var field = ui.byId("searchInput");
      field.addEventListener("input", function () {
        renderResults(field.value || "");
      });
      renderResults("");
    }).catch(showLoadError);
  }

  render();
}());
