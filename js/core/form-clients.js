(function () {
  var auth = window.SalonAuth;
  var domain = window.SalonDomain;
  var formState = window.SalonFormState;
  var supabaseData = window.SalonSupabaseData;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  // Miroir de la regle appliquee cote base (clients_update_admin_or_linked) :
  // sert juste a adapter l'interface, la vraie protection reste dans
  // PostgreSQL (RLS), pas ici.
  function canManageClient(client) {
    var state = formState.state;
    if (auth.isAdmin(state.user)) {
      return true;
    }

    var myId = supabaseData.resolveCollabId(state.profiles, state.user.name);
    return !!client.collabId && client.collabId === myId;
  }

  function historyRowHtml(reservation) {
    return [
      '<div class="row" style="justify-content:space-between">',
      '  <div class="grow">',
      "    <b>" + utils.escapeHtml(reservation.prestation || "") + "</b>",
      '    <div class="tiny">' + utils.escapeHtml(reservation.date) + " " + utils.escapeHtml(reservation.time) +
        " · " + utils.escapeHtml(reservation.collab) + "</div>",
      "  </div>",
      '  <span class="badge status-' + utils.escapeHtml(reservation.status) + '">' +
        utils.escapeHtml(domain.getStatusLabel(reservation.status)) + "</span>",
      "</div>"
    ].join("");
  }

  function loadHistory(clientId) {
    var container = ui.byId("clientHistory");
    if (!container) {
      return;
    }

    supabaseData.listReservationsForClient(clientId).then(function (list) {
      if (!ui.byId("clientHistory")) {
        return;
      }

      if (!list.length) {
        container.innerHTML = '<p class="tiny">Aucun rendez-vous enregistre.</p>';
        return;
      }

      var doneVisits = list.filter(function (item) { return item.status === "done"; });
      var lastVisit = doneVisits.length ? doneVisits[doneVisits.length - 1] : null;

      container.innerHTML = [
        lastVisit
          ? '<p class="tiny">Dernier rendez-vous termine : ' + utils.escapeHtml(lastVisit.date) + "</p>"
          : '<p class="tiny">Aucun rendez-vous termine pour l instant.</p>',
        list.map(historyRowHtml).join("")
      ].join("");
    }).catch(function () {
      if (container) {
        container.innerHTML = '<p class="tiny">Impossible de charger l historique.</p>';
      }
    });
  }

  function openClientForm(clientId) {
    var state = formState.state;
    var client = clientId
      ? utils.findById(state.clients, clientId)
      : {
          id: "",
          name: "",
          phone: "",
          email: "",
          notes: "",
          allergies: "",
          collabId: auth.isAdmin(state.user) ? null : supabaseData.resolveCollabId(state.profiles, state.user.name),
          prestation: state.db.prestations[0] ? state.db.prestations[0].name : "",
          duration: 90,
          frequency: 21
        };

    if (!client) {
      return;
    }

    var manageable = canManageClient(client);
    var habitualCollab = client.collabId ? supabaseData.resolveCollabName(state.profiles, client.collabId) : "";
    var readonlyAttr = manageable ? "" : " readonly disabled";

    ui.showModal([
      '<div class="modal-head">',
      "  <h3>Fiche cliente</h3>",
      '  <button id="closeClientModal" class="x" type="button">x</button>',
      "</div>",
      '<div id="clientMsg"></div>',
      (!manageable ? '<div class="alert">Vous pouvez consulter cette fiche mais pas la modifier.</div>' : ""),
      '<label for="cName">Nom</label><input id="cName" class="field"' + readonlyAttr + ' value="' + utils.escapeHtml(client.name) + '">',
      '<label for="cPhone">Telephone</label><input id="cPhone" class="field"' + readonlyAttr + ' value="' + utils.escapeHtml(client.phone || "") + '">',
      '<label for="cEmail">Email</label><input id="cEmail" class="field"' + readonlyAttr + ' value="' + utils.escapeHtml(client.email || "") + '">',
      '<div class="grid2">',
      '  <div><label for="cCollab">Collaboratrice habituelle</label><select id="cCollab" class="field"' + (auth.isAdmin(state.user) ? "" : " disabled") + '>' + state.db.users
        .filter(function (item) { return item.role === "collab"; })
        .map(function (item) {
          var selected = item.name === habitualCollab ? " selected" : "";
          return '<option value="' + utils.escapeHtml(item.name) + '"' + selected + ">" +
            utils.escapeHtml(item.name) + "</option>";
        }).join("") + "</select></div>",
      '  <div><label for="cPrest">Prestation habituelle</label><select id="cPrest" class="field"' + (manageable ? "" : " disabled") + '>' + state.db.prestations
        .map(function (prestation) {
          var selected = prestation.name === client.prestation ? " selected" : "";
          return '<option value="' + utils.escapeHtml(prestation.name) + '"' + selected + ">" +
            utils.escapeHtml(prestation.name) + "</option>";
        }).join("") + "</select></div>",
      "</div>",
      '<div class="grid2">',
      '  <div><label for="cDuration">Duree moyenne</label><input id="cDuration" class="field" type="number"' + readonlyAttr + ' value="' + (client.duration || 0) + '"></div>',
      '  <div><label for="cFreq">Frequence en jours</label><input id="cFreq" class="field" type="number"' + readonlyAttr + ' value="' + (client.frequency || 0) + '"></div>',
      "</div>",
      '<label for="cNotes">Notes / commentaires importants</label><textarea id="cNotes" class="field"' + readonlyAttr + '>' + utils.escapeHtml(client.notes || "") + "</textarea>",
      '<label for="cAllergies">Allergies / precautions</label><textarea id="cAllergies" class="field"' + readonlyAttr + '>' + utils.escapeHtml(client.allergies || "") + "</textarea>",
      clientId ? '<label>Historique des rendez-vous</label><div id="clientHistory" class="stack"><p class="tiny">Chargement...</p></div>' : "",
      manageable ? '<button id="saveClientButton" class="primary" style="margin-top:14px;width:100%" type="button">Enregistrer</button>' : ""
    ].join(""));

    ui.byId("closeClientModal").addEventListener("click", ui.closeModal);

    var saveButton = ui.byId("saveClientButton");
    if (saveButton) {
      saveButton.addEventListener("click", function () {
        saveClient(clientId);
      });
    }

    if (clientId) {
      loadHistory(clientId);
    }
  }

  function saveClient(clientId) {
    var state = formState.state;
    var collabName = ui.byId("cCollab").value;
    var name = ui.byId("cName").value.trim();

    if (!name) {
      ui.showAlert("clientMsg", "Le nom est obligatoire.");
      return;
    }

    var client = {
      name: name,
      phone: ui.byId("cPhone").value.trim(),
      email: ui.byId("cEmail").value.trim(),
      notes: ui.byId("cNotes").value,
      allergies: ui.byId("cAllergies").value,
      collabId: supabaseData.resolveCollabId(state.profiles, collabName),
      prestation: ui.byId("cPrest").value,
      duration: Number(ui.byId("cDuration").value) || 0,
      frequency: Number(ui.byId("cFreq").value) || 0
    };

    var saveButton = ui.byId("saveClientButton");
    saveButton.disabled = true;

    var writePromise = clientId
      ? supabaseData.updateClient(clientId, client)
      : supabaseData.findOrCreateClient(client);

    writePromise.then(function () {
      ui.closeModal();
      state.refresh();
    }).catch(function (error) {
      saveButton.disabled = false;
      ui.showAlert("clientMsg", "Erreur, impossible d enregistrer cette fiche.");
      window.console && window.console.error && window.console.error(error);
    });
  }

  window.SalonClientForms = {
    openClientForm: openClientForm
  };
}());
