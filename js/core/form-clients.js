(function () {
  var auth = window.SalonAuth;
  var domain = window.SalonDomain;
  var formState = window.SalonFormState;
  var supabaseData = window.SalonSupabaseData;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  // La fiche cliente est commune a toute l'equipe (clients_update_authenticated
  // cote base) : toute collaboratrice connectee peut la consulter et la
  // modifier, pas seulement l'admin ou sa collaboratrice habituelle.
  function canManageClient() {
    return true;
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
          collabIds: auth.isAdmin(state.user) ? [] : [supabaseData.resolveCollabId(state.profiles, state.user.name)],
          prestation: state.db.prestations[0] ? state.db.prestations[0].name : "",
          duration: 90,
          frequency: 21
        };

    if (!client) {
      return;
    }

    var manageable = canManageClient(client);
    var clientCollabIds = client.collabIds || (client.collabId ? [client.collabId] : []);
    var readonlyAttr = manageable ? "" : " readonly disabled";

    ui.showModal([
      '<div class="modal-head">',
      "  <h3>Fiche cliente</h3>",
      '  <button id="closeClientModal" class="x" type="button">x</button>',
      "</div>",
      '<div id="clientMsg"></div>',
      (!manageable ? '<div class="alert">Vous pouvez consulter cette fiche mais pas la modifier.</div>' : ""),
      '<label for="cName">Nom</label><input id="cName" class="field"' + readonlyAttr + ' value="' + utils.escapeHtml(client.name) + '">',
      '<label for="cPhone">Téléphone</label><input id="cPhone" class="field" type="tel"' + readonlyAttr + ' value="' + utils.escapeHtml(client.phone || "") + '">',
      '<label for="cEmail">Email</label><input id="cEmail" class="field" type="email"' + readonlyAttr + ' value="' + utils.escapeHtml(client.email || "") + '">',
      '<label>Collaboratrices habituelles</label>',
      // state.profiles (fraichement charge depuis Supabase par js/pages/
      // clients.js) plutot que state.db.users (mirroir local par appareil,
      // qui peut contenir une fiche en double pour la meme personne si un
      // rapprochement par email a echoue une fois - Julie/Marion
      // apparaissaient alors deux fois dans cette case a cocher).
      '<div class="checkbox-group">' + state.profiles
        .filter(function (item) { return item.role === "collab"; })
        .map(function (item) {
          var checked = clientCollabIds.indexOf(item.id) !== -1 ? " checked" : "";
          return '<label class="checkbox-line"><input type="checkbox" data-client-collab="' + item.id + '"' +
            checked + (manageable ? "" : " disabled") + "> " + utils.escapeHtml(item.name) + "</label>";
        }).join("") + "</div>",
      '<label for="cPrest">Prestation habituelle</label><select id="cPrest" class="field"' + (manageable ? "" : " disabled") + '>' + state.db.prestations
        .map(function (prestation) {
          var selected = prestation.name === client.prestation ? " selected" : "";
          return '<option value="' + utils.escapeHtml(prestation.name) + '"' + selected + ">" +
            utils.escapeHtml(prestation.name) + "</option>";
        }).join("") + "</select>",
      '<div class="grid2">',
      '  <div><label for="cDuration">Duree moyenne</label><input id="cDuration" class="field" type="number"' + readonlyAttr + ' value="' + (client.duration || 0) + '"></div>',
      '  <div><label for="cFreq">Frequence en jours</label><input id="cFreq" class="field" type="number"' + readonlyAttr + ' value="' + (client.frequency || 0) + '"></div>',
      "</div>",
      '<label for="cNotes">Notes / commentaires importants</label><textarea id="cNotes" class="field"' + readonlyAttr + '>' + utils.escapeHtml(client.notes || "") + "</textarea>",
      '<label for="cAllergies">Allergies / precautions</label><textarea id="cAllergies" class="field"' + readonlyAttr + '>' + utils.escapeHtml(client.allergies || "") + "</textarea>",
      clientId ? '<label>Historique des rendez-vous</label><div id="clientHistory" class="stack"><p class="tiny">Chargement...</p></div>' : "",
      '<div class="row" style="margin-top:14px">',
      manageable ? '  <button id="saveClientButton" class="primary grow" type="button">Enregistrer</button>' : "",
      (manageable && clientId && auth.isAdmin(state.user)) ? '  <button id="deleteClientButton" class="secondary danger" type="button">Supprimer</button>' : "",
      "</div>"
    ].join(""));

    ui.byId("closeClientModal").addEventListener("click", ui.closeModal);

    var saveButton = ui.byId("saveClientButton");
    if (saveButton) {
      saveButton.addEventListener("click", function () {
        saveClient(clientId);
      });
    }

    var deleteButton = ui.byId("deleteClientButton");
    if (deleteButton) {
      deleteButton.addEventListener("click", function () {
        confirmDeleteClient(clientId);
      });
    }

    if (clientId) {
      loadHistory(clientId);
    }
  }

  // Une fiche cliente ayant deja des rendez-vous ne peut pas etre
  // supprimee (contrainte de cle etrangere cote base) : on le verifie
  // d'abord pour afficher un message clair plutot qu'une erreur SQL brute.
  function confirmDeleteClient(clientId) {
    var state = formState.state;

    supabaseData.listReservationsForClient(clientId).then(function (reservations) {
      if (reservations.length > 0) {
        window.alert(
          "Impossible de supprimer : cette cliente a " + reservations.length +
          " rendez-vous enregistré(s). Annulez-les ou réassignez-les d'abord."
        );
        return;
      }

      if (!window.confirm("Supprimer definitivement cette fiche cliente ?")) {
        return;
      }

      return supabaseData.deleteClient(clientId).then(function () {
        ui.closeModal();
        state.refresh();
      });
    }).catch(function (error) {
      window.alert("Impossible de supprimer cette fiche, réessayez.");
      window.console && window.console.error && window.console.error(error);
    });
  }

  function saveClient(clientId) {
    var state = formState.state;
    var name = ui.byId("cName").value.trim();

    if (!name) {
      ui.showAlert("clientMsg", "Le nom est obligatoire.");
      return;
    }

    var collabIds = Array.prototype.slice.call(document.querySelectorAll("[data-client-collab]:checked"))
      .map(function (checkbox) { return checkbox.dataset.clientCollab; });

    var client = {
      name: name,
      phone: ui.byId("cPhone").value.trim(),
      email: ui.byId("cEmail").value.trim(),
      notes: ui.byId("cNotes").value,
      allergies: ui.byId("cAllergies").value,
      collabIds: collabIds,
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
