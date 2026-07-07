(function () {
  var auth = window.SalonAuth;
  var formState = window.SalonFormState;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  function openClientForm(clientId) {
    var state = formState.state;
    var client = clientId
      ? state.db.clients.find(function (item) { return item.id === clientId; })
      : {
          id: "",
          name: "",
          phone: "",
          email: "",
          notes: "",
          collab: auth.isAdmin(state.user) ? "Julie" : state.user.name,
          prestation: "Remplissage gel",
          duration: 90,
          frequency: 21,
          next: null
        };

    ui.showModal([
      '<div class="modal-head">',
      "  <h3>Fiche cliente</h3>",
      '  <button id="closeClientModal" class="x" type="button">x</button>',
      "</div>",
      '<label for="cName">Nom</label><input id="cName" class="field" value="' + utils.escapeHtml(client.name) + '">',
      '<label for="cPhone">Telephone</label><input id="cPhone" class="field" value="' + utils.escapeHtml(client.phone) + '">',
      '<label for="cEmail">Email</label><input id="cEmail" class="field" value="' + utils.escapeHtml(client.email) + '">',
      '<div class="grid2">',
      '  <div><label for="cCollab">Collaboratrice</label><select id="cCollab" class="field">' + state.db.users
        .filter(function (user) { return user.role === "collab"; })
        .map(function (user) {
          var selected = user.name === client.collab ? " selected" : "";
          return '<option value="' + utils.escapeHtml(user.name) + '"' + selected + ">" +
            utils.escapeHtml(user.name) + "</option>";
        }).join("") + "</select></div>",
      '  <div><label for="cPrest">Prestation</label><select id="cPrest" class="field">' + state.db.prestations
        .map(function (prestation) {
          var selected = prestation.name === client.prestation ? " selected" : "";
          return '<option value="' + utils.escapeHtml(prestation.name) + '"' + selected + ">" +
            utils.escapeHtml(prestation.name) + "</option>";
        }).join("") + "</select></div>",
      "</div>",
      '<div class="grid2">',
      '  <div><label for="cDuration">Duree moyenne</label><input id="cDuration" class="field" type="number" value="' + client.duration + '"></div>',
      '  <div><label for="cFreq">Frequence en jours</label><input id="cFreq" class="field" type="number" value="' + client.frequency + '"></div>',
      "</div>",
      '<label for="cNotes">Notes</label><textarea id="cNotes" class="field">' + utils.escapeHtml(client.notes || "") + "</textarea>",
      '<button id="saveClientButton" class="primary" style="margin-top:14px;width:100%" type="button">Enregistrer</button>'
    ].join(""));

    ui.byId("closeClientModal").addEventListener("click", ui.closeModal);
    ui.byId("saveClientButton").addEventListener("click", function () {
      saveClient(clientId);
    });
  }

  function saveClient(clientId) {
    var state = formState.state;
    var client = {
      id: clientId || utils.uid("c"),
      name: ui.byId("cName").value.trim(),
      phone: ui.byId("cPhone").value,
      email: ui.byId("cEmail").value,
      notes: ui.byId("cNotes").value,
      collab: ui.byId("cCollab").value,
      prestation: ui.byId("cPrest").value,
      duration: Number(ui.byId("cDuration").value) || 0,
      frequency: Number(ui.byId("cFreq").value) || 0,
      next: null
    };

    if (clientId) {
      Object.assign(
        state.db.clients.find(function (item) { return item.id === clientId; }),
        client
      );
    } else {
      state.db.clients.push(client);
    }

    ui.closeModal();
    formState.saveAndRefresh();
  }

  window.SalonClientForms = {
    openClientForm: openClientForm
  };
}());
