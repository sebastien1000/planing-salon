(function () {
  var data = window.SalonData;
  var forms = window.SalonForms;
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

  forms.configure({
    db: db,
    refresh: render,
    user: user
  });

  function render() {
    var content = [
      '<button id="addClientButton" class="primary list-actions" type="button">Ajouter cliente</button>',
      '<div class="cards">',
      db.clients.map(function (client) {
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
          '    <span class="badge">' + utils.escapeHtml(client.collab) + "</span>",
          '    <span class="badge">' + utils.escapeHtml(client.prestation) + "</span>",
          '    <span class="badge">Tous les ' + client.frequency + " jours</span>",
          "  </div>",
          '  <div class="tiny">' + utils.escapeHtml(client.notes || "") + "</div>",
          "</div>"
        ].join("");
      }).join(""),
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
  }

  render();
}());
