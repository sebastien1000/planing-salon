(function () {
  var data = window.SalonData;
  var forms = window.SalonForms;
  var supabaseData = window.SalonSupabaseData;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  var user = ui.initAppPage({
    activePage: "clients",
    actions: {},
    pageTitle: "Clients"
  });

  if (!user) {
    return;
  }

  var db = data.loadDb();
  var clients = [];
  var profiles = [];

  function showLoadError(error) {
    ui.setMain([
      '<div class="card">',
      '  <div class="alert">Impossible de charger les clientes depuis Supabase. Verifiez la configuration et votre connexion.</div>',
      "</div>"
    ].join(""));
    window.console && window.console.error && window.console.error(error);
  }

  function collabLabel(client) {
    if (!client.collabId) {
      return "";
    }
    return supabaseData.resolveCollabName(profiles, client.collabId);
  }

  function clientCard(client) {
    var collab = collabLabel(client);

    return [
      '<div class="card">',
      '  <div class="row">',
      '    <div class="grow">',
      "      <h3>" + utils.escapeHtml(client.name) + "</h3>",
      '      <div class="tiny">' + utils.escapeHtml(client.phone || "") + "</div>",
      "    </div>",
      '    <button class="secondary" type="button" data-client-id="' + client.id + '">Ouvrir</button>',
      "  </div>",
      '  <div class="meta">',
      collab ? '    <span class="badge">' + utils.escapeHtml(collab) + "</span>" : "",
      client.prestation ? '    <span class="badge">' + utils.escapeHtml(client.prestation) + "</span>" : "",
      client.frequency ? '    <span class="badge">Tous les ' + client.frequency + " jours</span>" : "",
      client.allergies ? '    <span class="badge danger">Allergie / precaution</span>' : "",
      "  </div>",
      '  <div class="tiny">' + utils.escapeHtml(client.notes || "") + "</div>",
      "</div>"
    ].join("");
  }

  function render() {
    Promise.all([
      supabaseData.listClients(),
      supabaseData.listProfiles()
    ]).then(function (results) {
      clients = results[0];
      profiles = results[1];

      forms.configure({
        db: db,
        user: user,
        refresh: render,
        clients: clients,
        profiles: profiles
      });

      var content = [
        '<button id="addClientButton" class="primary list-actions" type="button">Ajouter cliente</button>',
        '<div class="cards">',
        clients.length
          ? clients.map(clientCard).join("")
          : '<div class="empty">Aucune cliente visible pour votre compte.</div>',
        "</div>"
      ].join("");

      ui.setMain(content);

      ui.byId("addClientButton").addEventListener("click", function () {
        forms.openClientForm();
      });

      document.querySelectorAll("[data-client-id]").forEach(function (button) {
        button.addEventListener("click", function () {
          forms.openClientForm(button.dataset.clientId);
        });
      });
    }).catch(showLoadError);
  }

  render();
}());
