(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var formState = window.SalonFormState;
  var supabaseData = window.SalonSupabaseData;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;
  var ENABLE_CONFLICT_ASSISTANT = true;

  // Assemble un objet ayant la forme attendue par domain.js (conflits,
  // restrictions salle/prestation) a partir de l'etat courant : les
  // collaborateurs/prestations/absences/conges restent dans localStorage,
  // les clientes/rendez-vous viennent de Supabase. reservationsOverride
  // permet de remplacer state.reservations (qui ne contient que les dates
  // deja chargees par la vue planning courante) par une liste fraiche.
  function buildVirtualDb(state, reservationsOverride) {
    return {
      users: state.db.users,
      prestations: state.db.prestations,
      absences: state.db.absences,
      holidays: state.db.holidays,
      reservations: reservationsOverride || state.reservations,
      clients: state.clients
    };
  }

  // state.reservations ne couvre que les dates deja affichees dans le
  // planning (jour/semaine/mois courant) : verifier un conflit avec ces
  // seules donnees peut annoncer a tort un creneau libre pour une date hors
  // de cette vue. On interroge donc Supabase pour la date exacte du
  // rendez-vous a chaque verification, la contrainte PostgreSQL restant de
  // toute facon le dernier rempart en cas d'ecart.
  function freshVirtualDbForDate(state, date) {
    return supabaseData.listReservationsForDates([date]).then(function (list) {
      return buildVirtualDb(state, list);
    });
  }

  function reservationCard(reservation) {
    var state = formState.state;
    var isMine = reservation.collab === state.user.name;
    var canSee = auth.canSeeReservation(state.user, reservation);
    var title = canSee ? reservation.client : "Reserve - " + reservation.collab;
    var subtitle = canSee ? reservation.prestation : "Detail prive";
    var collabUser = utils.findByName(state.db.users, reservation.collab);
    var borderStyle = collabUser && collabUser.color ? ' style="border-left-color:' + collabUser.color + '"' : "";
    var cardClassName = [
      "card",
      "appointment",
      "rsv",
      isMine ? "appointment--mine" : "appointment--other"
    ].join(" ");
    var actions = "";

    if (canSee) {
      actions = [
        '<button class="secondary grow" type="button" data-action="view-reservation" data-id="' + reservation.id + '">Voir</button>',
        '<button class="secondary grow" type="button" data-action="reschedule-reservation" data-id="' + reservation.id + '">Decaler</button>',
        '<button class="secondary grow" type="button" data-action="done-reservation" data-id="' + reservation.id + '">Terminer</button>',
        '<button class="secondary danger" type="button" data-action="cancel-reservation" data-id="' + reservation.id + '">Annuler</button>'
      ].join("");
    }

    return [
      '<div class="' + cardClassName + '"' + borderStyle + '>',
      "  <div class=\"row\">",
      '    <div class="grow">',
      "      <b>" + utils.escapeHtml(title) + "</b>",
      '      <div class="tiny">' + utils.escapeHtml(subtitle) + "</div>",
      "    </div>",
      '    <span class="badge status-' + reservation.status + '">' +
        utils.escapeHtml(domain.getStatusLabel(reservation.status)) + "</span>",
      "  </div>",
      '  <div class="meta">',
      '    <span class="badge">' + utils.escapeHtml(reservation.collab) + "</span>",
      '    <span class="badge room">' + utils.escapeHtml(reservation.room) + "</span>",
      '    <span class="badge">' + utils.escapeHtml(reservation.time) + "</span>",
      '    <span class="badge">' + utils.escapeHtml(String(reservation.duration)) + " min</span>",
      (reservation.supplement ? '    <span class="badge">+' + reservation.supplement + " EUR</span>" : ""),
      "  </div>",
      '  <div class="row rsv-actions">' + actions + "</div>",
      "</div>"
    ].join("");
  }

  function bindReservationCardActions(root) {
    root.querySelectorAll("[data-action='view-reservation']").forEach(function (button) {
      button.addEventListener("click", function () {
        openReservation(button.dataset.id);
      });
    });

    root.querySelectorAll("[data-action='reschedule-reservation']").forEach(function (button) {
      button.addEventListener("click", function () {
        openReservation(button.dataset.id);
      });
    });

    root.querySelectorAll("[data-action='done-reservation']").forEach(function (button) {
      button.addEventListener("click", function () {
        openSupplementSheet(button.dataset.id);
      });
    });

    root.querySelectorAll("[data-action='cancel-reservation']").forEach(function (button) {
      button.addEventListener("click", function () {
        cancelReservation(button.dataset.id);
      });
    });
  }

  function defaultCollabName(state) {
    var firstCollab = state.db.users.find(function (user) { return user.role === "collab" && user.active !== false; });
    return firstCollab ? firstCollab.name : "";
  }

  function openReservation(reservationId) {
    var state = formState.state;
    var reservation = reservationId
      ? utils.findById(state.reservations, reservationId)
      : {
          id: "",
          client: "",
          clientId: "",
          collab: auth.isAdmin(state.user) ? defaultCollabName(state) : state.user.name,
          prestation: state.db.prestations[0].name,
          date: state.selectedDate,
          time: "09:00",
          duration: 90,
          status: "pre",
          room: "",
          notes: ""
        };

    if (!reservation) {
      return;
    }

    if (!canManageReservation(reservation)) {
      window.alert("Vous ne pouvez pas modifier un rendez-vous d'une autre collaboratrice.");
      return;
    }

    ui.showModal(buildReservationForm(reservation, reservationId));
    bindReservationForm(reservationId);
  }

  function buildReservationForm(reservation, reservationId) {
    var state = formState.state;
    var client = findReservationClient(reservation);
    var clientOptions = state.clients.map(function (client) {
      var selected = client.id === reservation.clientId ? " selected" : "";
      return '<option value="' + client.id + '"' + selected + '>' +
        utils.escapeHtml(client.name) + "</option>";
    }).join("");

    var collabOptions = state.db.users
      .filter(function (user) {
        return user.role === "collab" && (user.active !== false || user.name === reservation.collab);
      })
      .map(function (user) {
        var selected = user.name === reservation.collab ? " selected" : "";
        var label = user.active === false ? user.name + " (inactif)" : user.name;
        return '<option value="' + utils.escapeHtml(user.name) + '"' + selected + ">" +
          utils.escapeHtml(label) + "</option>";
      }).join("");

    var prestationOptions = buildPrestationOptionsHtml(state, reservation.collab, reservation.prestation);
    var roomOptions = buildRoomOptionsHtml(
      state,
      reservation.collab,
      reservation.room || domain.roomFor(state.db, reservation.collab, reservation.prestation)
    );

    var room = reservation.room || domain.roomFor(state.db, reservation.collab, reservation.prestation);
    var lockOwnCollab = !auth.isAdmin(state.user);
    var price = findPrestationPrice(reservation.prestation);

    return [
      '<div class="modal-head">',
      "  <h3>" + (reservationId ? "Modifier" : "Ajouter") + " un RDV</h3>",
      '  <button id="closeModalButton" class="x" type="button">x</button>',
      "</div>",
      '<label for="fClient">Cliente existante</label>',
      '<select id="fClient" class="field">',
      '  <option value="">Nouvelle / libre</option>',
      clientOptions,
      "</select>",
      '<input id="fClientName" class="field" placeholder="Nom cliente" value="' +
        utils.escapeHtml(reservation.client) + '">',
      '<div class="grid2">',
      '  <div><label for="fClientPhone">Telephone</label><input id="fClientPhone" class="field" placeholder="Telephone" value="' + utils.escapeHtml(client ? client.phone || "" : "") + '"></div>',
      '  <div><label for="fClientEmail">Email</label><input id="fClientEmail" class="field" type="email" placeholder="Email (facultatif)" value="' + utils.escapeHtml(client ? client.email || "" : "") + '"></div>',
      "</div>",
      '<p class="tiny">Si la cliente n est pas dans la liste, remplissez son nom/telephone : sa fiche sera creee automatiquement (ou reutilisee si elle existe deja).</p>',
      '<div class="grid2">',
      '  <div><label for="fCollab">Collaboratrice</label><select id="fCollab" class="field"' +
        (lockOwnCollab ? ' disabled' : '') + '>' + collabOptions + "</select></div>",
      '  <div><label for="fPrest">Prestation</label><select id="fPrest" class="field">' + prestationOptions + "</select></div>",
      "</div>",
      '<div class="grid2">',
      '  <div><label for="fDate">Date</label><input id="fDate" class="field" type="date" value="' + reservation.date + '"></div>',
      '  <div><label for="fTime">Heure</label><input id="fTime" class="field" type="time" value="' + reservation.time + '"></div>',
      "</div>",
      '<div class="grid2">',
      '  <div><label for="fDuration">Duree min</label><input id="fDuration" class="field" type="number" value="' + reservation.duration + '"></div>',
      '  <div><label for="fRoom">Salle</label><select id="fRoom" class="field">' + roomOptions + "</select></div>",
      "</div>",
      '<label for="fPrice">Prix</label><input id="fPrice" class="field" readonly value="' + price + ' EUR">',
      '<label for="fStatus">Statut</label>',
      '<select id="fStatus" class="field">' + data.STATUS.map(function (status) {
        var selected = status[0] === reservation.status ? " selected" : "";
        return '<option value="' + status[0] + '"' + selected + ">" + status[1] + "</option>";
      }).join("") + "</select>",
      '<label for="fNotes">Notes privees / commentaire</label>',
      '<textarea id="fNotes" class="field">' + utils.escapeHtml(reservation.notes || "") + "</textarea>",
      '<div class="reservation-submit-zone">',
      '  <div id="reservationMsg" class="reservation-msg-inline"></div>',
      '  <div class="row reservation-submit-row">',
      '    <button id="saveReservationButton" class="primary grow" type="button">Enregistrer</button>',
      reservationId ? '    <button id="modalCancelReservationButton" class="secondary danger" type="button">Annuler</button>' : "",
      "  </div>",
      "</div>"
    ].join("");
  }

  function buildRoomOptionsHtml(state, collabName, selectedRoom) {
    var user = utils.findByName(state.db.users, collabName);
    return data.ROOMS.filter(function (room) {
      return domain.isRoomAllowedForUser(user, room);
    }).map(function (room) {
      var selected = room === selectedRoom ? " selected" : "";
      return '<option value="' + utils.escapeHtml(room) + '"' + selected + ">" + utils.escapeHtml(room) + "</option>";
    }).join("");
  }

  function buildPrestationOptionsHtml(state, collabName, selectedPrestation) {
    var user = utils.findByName(state.db.users, collabName);
    return state.db.prestations.filter(function (prestation) {
      return domain.isPrestationAllowedForUser(user, prestation.name);
    }).map(function (prestation) {
      var selected = prestation.name === selectedPrestation ? " selected" : "";
      return '<option value="' + utils.escapeHtml(prestation.name) + '"' + selected + ">" +
        utils.escapeHtml(prestation.name) + "</option>";
    }).join("");
  }

  function bindReservationForm(reservationId) {
    var closeButton = ui.byId("closeModalButton");
    var saveButton = ui.byId("saveReservationButton");
    var cancelButton = ui.byId("modalCancelReservationButton");
    var clientField = ui.byId("fClient");
    var collabField = ui.byId("fCollab");
    var prestationField = ui.byId("fPrest");

    closeButton.addEventListener("click", ui.closeModal);
    saveButton.addEventListener("click", function () {
      saveReservation(reservationId);
    });

    if (cancelButton) {
      cancelButton.addEventListener("click", function () {
        cancelReservation(reservationId);
        ui.closeModal();
      });
    }

    clientField.addEventListener("change", fillClientHabit);
    collabField.addEventListener("change", function () {
      refreshCollabRestrictedFields();
      updateReservationRoom(false);
    });
    prestationField.addEventListener("change", function () {
      updateReservationRoom(true);
    });

    updateReservationRoom(false);
    updateReservationMeta();
  }

  function refreshCollabRestrictedFields() {
    var state = formState.state;
    var collab = ui.byId("fCollab").value;
    var currentPrestation = ui.byId("fPrest").value;
    var currentRoom = ui.byId("fRoom").value;

    ui.byId("fPrest").innerHTML = buildPrestationOptionsHtml(state, collab, currentPrestation);
    ui.byId("fRoom").innerHTML = buildRoomOptionsHtml(state, collab, currentRoom);
  }

  function updateReservationRoom(updateDuration) {
    var state = formState.state;
    var collab = ui.byId("fCollab").value;
    var prestation = ui.byId("fPrest").value;
    ui.byId("fRoom").value = domain.roomFor(state.db, collab, prestation);

    if (updateDuration) {
      var found = state.db.prestations.find(function (item) {
        return item.name === prestation;
      });

      if (found) {
        ui.byId("fDuration").value = found.duration;
      }
    }

    updateReservationMeta();
  }

  function fillClientHabit() {
    var state = formState.state;
    var clientId = ui.byId("fClient").value;
    var client = utils.findById(state.clients, clientId);

    if (!client) {
      return;
    }

    var habitualCollab = client.collabId
      ? supabaseData.resolveCollabName(state.profiles, client.collabId)
      : "";

    ui.byId("fClientName").value = client.name;
    ui.byId("fClientPhone").value = client.phone || "";
    ui.byId("fClientEmail").value = client.email || "";
    ui.byId("fCollab").value = auth.isAdmin(state.user) && habitualCollab ? habitualCollab : state.user.name;
    refreshCollabRestrictedFields();
    ui.byId("fPrest").value = client.prestation || ui.byId("fPrest").value;
    ui.byId("fDuration").value = client.duration || ui.byId("fDuration").value;
    updateReservationRoom(false);
  }

  function updateReservationMeta() {
    ui.byId("fPrice").value = findPrestationPrice(ui.byId("fPrest").value) + " EUR";
  }

  function findPrestationPrice(prestationName) {
    var state = formState.state;
    var prestation = state.db.prestations.find(function (item) {
      return item.name === prestationName;
    });
    return prestation ? prestation.price : 0;
  }

  function findReservationClient(reservation) {
    var state = formState.state;
    return state.clients.find(function (item) {
      return item.id === reservation.clientId || item.name === reservation.client;
    }) || null;
  }

  function showSaveError(targetId, message) {
    var target = ui.byId(targetId);
    if (target) {
      target.innerHTML = '<div class="alert">' + utils.escapeHtml(message) + "</div>";
    }
  }

  function saveReservation(reservationId) {
    var state = formState.state;
    var currentReservation = reservationId
      ? utils.findById(state.reservations, reservationId)
      : null;

    if (currentReservation && !canManageReservation(currentReservation)) {
      showSaveError("reservationMsg", "Modification refusee pour cette collaboratrice.");
      return;
    }

    var chosenCollab = auth.isAdmin(state.user) ? ui.byId("fCollab").value : state.user.name;
    var selectedClientId = ui.byId("fClient").value;
    var draft = {
      id: reservationId || "",
      client: ui.byId("fClientName").value.trim() || "Cliente",
      clientId: selectedClientId,
      collab: chosenCollab,
      collabId: supabaseData.resolveCollabId(state.profiles, chosenCollab),
      prestation: ui.byId("fPrest").value,
      date: ui.byId("fDate").value,
      time: ui.byId("fTime").value,
      duration: Number(ui.byId("fDuration").value) || 0,
      room: ui.byId("fRoom").value,
      status: ui.byId("fStatus").value,
      notes: ui.byId("fNotes").value
    };

    var assignmentError = domain.assignmentError(buildVirtualDb(state), draft);
    if (assignmentError) {
      showSaveError("reservationMsg", assignmentError);
      return;
    }

    var saveButton = ui.byId("saveReservationButton");
    saveButton.disabled = true;

    freshVirtualDbForDate(state, draft.date).then(function (virtualDb) {
      var conflict = domain.conflictDetails(virtualDb, draft, reservationId || null);
      if (conflict) {
        saveButton.disabled = false;
        ui.byId("reservationMsg").innerHTML = ENABLE_CONFLICT_ASSISTANT
          ? '<div class="alert reservation-alert-box">Creneau deja pris. Choisissez un autre horaire.</div>'
          : '<div class="alert">' + utils.escapeHtml(conflict.message) + "</div>";
        if (ENABLE_CONFLICT_ASSISTANT) {
          showConflictPopup(draft, conflict, reservationId || null);
        }
        return null;
      }

      var clientPromise = selectedClientId
        ? Promise.resolve(utils.findById(state.clients, selectedClientId))
        : supabaseData.findOrCreateClient({
            name: draft.client,
            phone: ui.byId("fClientPhone").value.trim(),
            email: ui.byId("fClientEmail").value.trim(),
            prestation: draft.prestation,
            duration: draft.duration,
            frequency: 21,
            notes: draft.notes,
            collabId: draft.collabId
          });

      return clientPromise.then(function (client) {
        draft.clientId = client.id;
        draft.client = client.name;

        return reservationId
          ? supabaseData.updateReservation(reservationId, draft)
          : supabaseData.createReservation(draft);
      }).then(function () {
        state.selectedDate = draft.date;
        ui.closeModal();
        state.refresh();
      });
    }).catch(function (error) {
      saveButton.disabled = false;

      if (error && error.isSlotTaken) {
        showSaveError("reservationMsg", "Ce creneau vient d etre pris pour cette salle. Choisissez un autre horaire.");
        return;
      }

      showSaveError("reservationMsg", "Impossible d'enregistrer ce rendez-vous, reessayez.");
      window.console && window.console.error && window.console.error(error);
    });
  }

  function cancelReservation(reservationId) {
    var state = formState.state;
    var reservation = utils.findById(state.reservations, reservationId);

    if (!reservation) {
      return;
    }

    if (!canManageReservation(reservation)) {
      window.alert("Vous ne pouvez pas modifier un rendez-vous d'une autre collaboratrice.");
      return;
    }

    if (!window.confirm("Annuler ce rendez-vous ?")) {
      return;
    }

    supabaseData.updateReservation(reservationId, Object.assign({}, reservation, { status: "cancel" }))
      .then(function () {
        state.refresh();
      })
      .catch(function (error) {
        window.alert("Impossible d'annuler ce rendez-vous, reessayez.");
        window.console && window.console.error && window.console.error(error);
      });
  }

  function setReservationStatus(reservationId, status, supplement) {
    var state = formState.state;
    var reservation = utils.findById(state.reservations, reservationId);

    if (!reservation) {
      return;
    }

    if (!canManageReservation(reservation)) {
      window.alert("Vous ne pouvez pas modifier un rendez-vous d'une autre collaboratrice.");
      return;
    }

    var patch = Object.assign({}, reservation, { status: status });
    if (status === "done") {
      patch.supplement = Number(supplement) || 0;
    }

    supabaseData.updateReservation(reservationId, patch).then(function (updated) {
      state.refresh();

      if (status === "done") {
        openProposal(updated);
      }
    }).catch(function (error) {
      window.alert("Impossible de mettre a jour ce rendez-vous, reessayez.");
      window.console && window.console.error && window.console.error(error);
    });
  }

  function openSupplementSheet(reservationId) {
    var state = formState.state;
    var reservation = utils.findById(state.reservations, reservationId);

    if (!reservation) {
      return;
    }

    if (!canManageReservation(reservation)) {
      window.alert("Vous ne pouvez pas modifier un rendez-vous d'une autre collaboratrice.");
      return;
    }

    ui.showSheet([
      '<div class="modal-head">',
      "  <h3>Terminer le RDV</h3>",
      '  <button id="closeSupplementButton" class="x" type="button">x</button>',
      "</div>",
      '<p class="tiny">Ajoute un supplement si besoin, il sera compte dans la recette.</p>',
      '<label for="fSupplement">Supplement (EUR)</label>',
      '<input id="fSupplement" class="field" type="number" min="0" step="0.5" placeholder="0" value="' +
        (reservation.supplement || "") + '">',
      '<div class="row" style="margin-top:14px">',
      '  <button id="validateSupplementButton" class="primary grow" type="button">Valider</button>',
      "</div>"
    ].join(""));

    ui.byId("closeSupplementButton").addEventListener("click", ui.closeSheet);
    ui.byId("validateSupplementButton").addEventListener("click", function () {
      var supplement = Number(ui.byId("fSupplement").value) || 0;
      ui.closeSheet();
      setReservationStatus(reservationId, "done", supplement);
    });
  }

  function openProposal(reservation) {
    var state = formState.state;
    var client = state.clients.find(function (item) {
      return item.id === reservation.clientId || item.name === reservation.client;
    });

    if (!client) {
      return;
    }

    var base = utils.dateObj(reservation.date);
    base.setDate(base.getDate() + Number(client.frequency || 21));

    var nextDate = utils.iso(base);
    var lockOwnCollab = !auth.isAdmin(state.user);
    var habitualCollab = client.collabId ? supabaseData.resolveCollabName(state.profiles, client.collabId) : "";
    var proposalCollab = lockOwnCollab ? state.user.name : (habitualCollab || reservation.collab);
    var room = domain.roomFor(state.db, proposalCollab, client.prestation);

    ui.showSheet([
      '<div class="modal-head">',
      "  <h3>Prochain RDV propose</h3>",
      '  <button id="closeSheetButton" class="x" type="button">x</button>',
      "</div>",
      '<p class="tiny">Proposition interne pour la collaboratrice.</p>',
      '<label for="pDate">Date</label><input id="pDate" class="field" type="date" value="' + nextDate + '">',
      '<label for="pTime">Heure</label><input id="pTime" class="field" type="time" value="' + reservation.time + '">',
      '<label for="pCollab">Collaboratrice</label>',
      '<select id="pCollab" class="field"' + (lockOwnCollab ? ' disabled' : '') + '>' + state.db.users
        .filter(function (user) {
          return user.role === "collab" && (user.active !== false || user.name === proposalCollab);
        })
        .map(function (user) {
          var selected = user.name === proposalCollab ? " selected" : "";
          var label = user.active === false ? user.name + " (inactif)" : user.name;
          return '<option value="' + utils.escapeHtml(user.name) + '"' + selected + ">" +
            utils.escapeHtml(label) + "</option>";
        }).join("") + "</select>",
      '<label for="pPrest">Prestation</label>',
      '<select id="pPrest" class="field">' + state.db.prestations.map(function (prestation) {
        var selected = prestation.name === client.prestation ? " selected" : "";
        return '<option value="' + utils.escapeHtml(prestation.name) + '"' + selected + ">" +
          utils.escapeHtml(prestation.name) + "</option>";
      }).join("") + "</select>",
      '<div class="grid2">',
      '  <div><label for="pDuration">Duree</label><input id="pDuration" class="field" type="number" value="' + client.duration + '"></div>',
      '  <div><label for="pRoom">Salle</label><input id="pRoom" class="field" readonly value="' + utils.escapeHtml(room) + '"></div>',
      "</div>",
      '<div id="proposalMsg"></div>',
      '<div class="row" style="margin-top:14px">',
      '  <button id="saveProposalButton" class="primary grow" type="button">Valider</button>',
      '  <button id="suggestProposalButton" class="secondary" type="button">Autres creneaux</button>',
      "</div>"
    ].join(""));

    ui.byId("closeSheetButton").addEventListener("click", ui.closeSheet);
    ui.byId("pCollab").addEventListener("change", updateProposalRoom);
    ui.byId("pPrest").addEventListener("change", function () {
      updateProposalRoom(true);
    });
    ui.byId("saveProposalButton").addEventListener("click", function () {
      saveProposal(client.id);
    });
    ui.byId("suggestProposalButton").addEventListener("click", suggestProposalSlots);
  }

  function updateProposalRoom(updateDuration) {
    var state = formState.state;
    var collab = ui.byId("pCollab").value;
    var prestation = ui.byId("pPrest").value;
    ui.byId("pRoom").value = domain.roomFor(state.db, collab, prestation);

    if (updateDuration) {
      var found = state.db.prestations.find(function (item) {
        return item.name === prestation;
      });

      if (found) {
        ui.byId("pDuration").value = found.duration;
      }
    }
  }

  function saveProposal(clientId) {
    var state = formState.state;
    var client = utils.findById(state.clients, clientId);
    var chosenCollab = auth.isAdmin(state.user) ? ui.byId("pCollab").value : state.user.name;
    var draft = {
      id: "",
      client: client.name,
      clientId: client.id,
      collab: chosenCollab,
      collabId: supabaseData.resolveCollabId(state.profiles, chosenCollab),
      prestation: ui.byId("pPrest").value,
      date: ui.byId("pDate").value,
      time: ui.byId("pTime").value,
      duration: Number(ui.byId("pDuration").value) || 0,
      room: ui.byId("pRoom").value,
      status: "pre",
      notes: "Prochain RDV valide"
    };

    var assignmentError = domain.assignmentError(buildVirtualDb(state), draft);
    if (assignmentError) {
      showSaveError("proposalMsg", assignmentError);
      return;
    }

    var saveButton = ui.byId("saveProposalButton");
    saveButton.disabled = true;

    freshVirtualDbForDate(state, draft.date).then(function (virtualDb) {
      var error = domain.conflict(virtualDb, draft, null);
      if (error) {
        saveButton.disabled = false;
        showSaveError("proposalMsg", error);
        return null;
      }

      return supabaseData.createReservation(draft).then(function () {
        return supabaseData.updateClient(client.id, { nextDate: draft.date });
      }).then(function () {
        ui.closeSheet();
        state.refresh();
      });
    }).catch(function (error) {
      saveButton.disabled = false;

      if (error && error.isSlotTaken) {
        showSaveError("proposalMsg", "Ce creneau vient d etre pris. Choisissez-en un autre.");
        return;
      }

      showSaveError("proposalMsg", "Impossible d'enregistrer ce rendez-vous, reessayez.");
      window.console && window.console.error && window.console.error(error);
    });
  }

  function suggestProposalSlots() {
    var state = formState.state;
    var times = ["09:00", "11:00", "14:00", "16:00"];
    var chosenCollab = auth.isAdmin(state.user) ? ui.byId("pCollab").value : state.user.name;
    var date = ui.byId("pDate").value;

    ui.byId("proposalMsg").innerHTML = '<p class="tiny">Verification des creneaux...</p>';

    freshVirtualDbForDate(state, date).then(function (virtualDb) {
      var html = ['<div class="success">Creneaux proposes :</div><div class="chips">'];

      times.forEach(function (time) {
        var reservation = {
          date: date,
          time: time,
          duration: Number(ui.byId("pDuration").value) || 0,
          room: ui.byId("pRoom").value,
          collab: chosenCollab
        };

        if (!domain.conflict(virtualDb, reservation, null)) {
          html.push('<button class="chip" type="button" data-slot="' + time + '">' + time + "</button>");
        }
      });

      html.push("</div>");
      ui.byId("proposalMsg").innerHTML = html.join("");

      ui.byId("proposalMsg").querySelectorAll("[data-slot]").forEach(function (button) {
        button.addEventListener("click", function () {
          ui.byId("pTime").value = button.dataset.slot;
        });
      });
    }).catch(function () {
      ui.byId("proposalMsg").innerHTML = '<div class="alert">Impossible de verifier les creneaux, reessayez.</div>';
    });
  }

  function showConflictPopup(reservation, conflict, ignoreId) {
    var conflictReservation = conflict.reservation;
    var title = "Ce creneau est deja pris";
    var slotLabel = reservation.date + " a " + reservation.time;
    var existingLabel = "";
    var meta = [];

    if (conflictReservation && conflictReservation.time) {
      existingLabel = conflictReservation.time + " - " +
        domain.addMinutes(conflictReservation.time, conflictReservation.duration);
    }

    if (conflictReservation && conflictReservation.client) {
      meta.push("Cliente : " + conflictReservation.client);
    }

    if (conflictReservation && conflictReservation.collab) {
      meta.push("Collaboratrice : " + conflictReservation.collab);
    }

    if (conflictReservation && conflictReservation.room) {
      meta.push("Salle : " + conflictReservation.room);
    }

    ui.showSheet([
      '<div class="modal-head conflict-sheet-head">',
      "  <h3>Creneau deja pris</h3>",
      '  <button id="closeConflictSheetButton" class="x" type="button">x</button>',
      "</div>",
      '<div class="card conflict-card">',
      '  <div class="conflict-badge">Reservation impossible</div>',
      '  <h4 class="conflict-title">' + utils.escapeHtml(title) + "</h4>",
      '  <p class="conflict-text">Le rendez-vous que vous essayez d enregistrer pour ' + utils.escapeHtml(slotLabel) + ' ne peut pas etre ajoute.</p>',
      (existingLabel ? '<div class="conflict-slot">Deja reserve : ' + utils.escapeHtml(existingLabel) + "</div>" : ""),
      (meta.length ? '<div class="tiny conflict-meta">' + utils.escapeHtml(meta.join(" • ")) + "</div>" : ""),
      '  <p class="tiny conflict-help">Cliquez ci-dessous pour choisir un autre creneau disponible.</p>',
      "</div>",
      '<div class="row" style="margin-top:14px">',
      '  <button id="changeConflictSlotButton" class="primary grow" type="button">Choisir un autre creneau</button>',
      '  <button id="dismissConflictSheetButton" class="secondary grow" type="button">Fermer</button>',
      "</div>",
      '<div id="conflictSlotSuggestions" style="margin-top:12px"></div>'
    ].join(""), "conflict-sheet-box");

    ui.byId("closeConflictSheetButton").addEventListener("click", ui.closeSheet);
    ui.byId("dismissConflictSheetButton").addEventListener("click", ui.closeSheet);
    ui.byId("changeConflictSlotButton").addEventListener("click", function () {
      renderConflictSuggestions(reservation, ignoreId);
    });
  }

  function renderConflictSuggestions(reservation, ignoreId) {
    var state = formState.state;
    var root = ui.byId("conflictSlotSuggestions");
    var times = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"];

    root.innerHTML = '<p class="tiny">Verification des creneaux...</p>';

    freshVirtualDbForDate(state, reservation.date).then(function (virtualDb) {
      var available = [];

      times.forEach(function (time) {
        var testReservation = Object.assign({}, reservation, { time: time });
        if (!domain.conflict(virtualDb, testReservation, ignoreId)) {
          available.push(time);
        }
      });

      if (!available.length) {
        root.innerHTML = '<div class="alert">Aucun autre creneau rapide disponible ce jour.</div>';
        return;
      }

      root.innerHTML = [
        '<div class="success">Creneaux disponibles :</div>',
        '<div class="chips">' + available.map(function (time) {
          return '<button class="chip" type="button" data-conflict-slot="' + time + '">' + time + "</button>";
        }).join("") + "</div>"
      ].join("");

      root.querySelectorAll("[data-conflict-slot]").forEach(function (button) {
        button.addEventListener("click", function () {
          ui.byId("fTime").value = button.dataset.conflictSlot;
          ui.closeSheet();
        });
      });
    }).catch(function () {
      root.innerHTML = '<div class="alert">Impossible de verifier les creneaux, reessayez.</div>';
    });
  }

  function canManageReservation(reservation) {
    var state = formState.state;
    return auth.isAdmin(state.user) || reservation.collab === state.user.name;
  }

  window.SalonReservationForms = {
    bindReservationCardActions: bindReservationCardActions,
    cancelReservation: cancelReservation,
    openReservation: openReservation,
    reservationCard: reservationCard,
    setReservationStatus: setReservationStatus
  };
}());
