(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var formState = window.SalonFormState;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;
  var ENABLE_CONFLICT_ASSISTANT = true;

  function reservationCard(reservation) {
    var state = formState.state;
    var isMine = reservation.collab === state.user.name;
    var canSee = auth.canSeeReservation(state.user, reservation);
    var title = canSee ? reservation.client : "Reserve - " + reservation.collab;
    var subtitle = canSee ? reservation.prestation : "Detail prive";
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
      '<div class="' + cardClassName + '">',
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
        setReservationStatus(button.dataset.id, "done");
      });
    });

    root.querySelectorAll("[data-action='cancel-reservation']").forEach(function (button) {
      button.addEventListener("click", function () {
        cancelReservation(button.dataset.id);
      });
    });
  }

  function openReservation(reservationId) {
    var state = formState.state;
    var reservation = reservationId
      ? state.db.reservations.find(function (item) { return item.id === reservationId; })
      : {
          id: "",
          client: "",
          clientId: "",
          collab: auth.isAdmin(state.user) ? "Julie" : state.user.name,
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
    var clientOptions = state.db.clients.map(function (client) {
      var selected = client.id === reservation.clientId ? " selected" : "";
      return '<option value="' + client.id + '"' + selected + '>' +
        utils.escapeHtml(client.name) + "</option>";
    }).join("");

    var collabOptions = state.db.users
      .filter(function (user) { return user.role === "collab"; })
      .map(function (user) {
        var selected = user.name === reservation.collab ? " selected" : "";
        return '<option value="' + utils.escapeHtml(user.name) + '"' + selected + ">" +
          utils.escapeHtml(user.name) + "</option>";
      }).join("");

    var prestationOptions = state.db.prestations.map(function (prestation) {
      var selected = prestation.name === reservation.prestation ? " selected" : "";
      return '<option value="' + utils.escapeHtml(prestation.name) + '"' + selected + ">" +
        utils.escapeHtml(prestation.name) + "</option>";
    }).join("");
    var roomOptions = data.ROOMS.map(function (room) {
      var selected = room === (reservation.room || domain.roomFor(state.db, reservation.collab, reservation.prestation))
        ? " selected" : "";
      return '<option value="' + utils.escapeHtml(room) + '"' + selected + ">" + utils.escapeHtml(room) + "</option>";
    }).join("");

    var room = reservation.room || domain.roomFor(state.db, reservation.collab, reservation.prestation);
    var lockOwnCollab = !auth.isAdmin(state.user);
    var price = findPrestationPrice(reservation.prestation);

    return [
      '<div class="modal-head">',
      "  <h3>" + (reservationId ? "Modifier" : "Ajouter") + " un RDV</h3>",
      '  <button id="closeModalButton" class="x" type="button">x</button>',
      "</div>",
      '<label for="fClient">Cliente</label>',
      '<select id="fClient" class="field">',
      '  <option value="">Nouvelle / libre</option>',
      clientOptions,
      "</select>",
      '<input id="fClientName" class="field" placeholder="Nom cliente" value="' +
        utils.escapeHtml(reservation.client) + '">',
      '<label for="fClientPhone">Telephone cliente</label><input id="fClientPhone" class="field" readonly value="' + utils.escapeHtml(client ? client.phone : "") + '">',
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
      '<label for="fNotes">Notes privees</label>',
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
    collabField.addEventListener("change", updateReservationRoom);
    prestationField.addEventListener("change", function () {
      updateReservationRoom(true);
    });

    updateReservationRoom(false);
    updateReservationMeta();
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
    var client = state.db.clients.find(function (item) {
      return item.id === clientId;
    });

    if (!client) {
      return;
    }

    ui.byId("fClientName").value = client.name;
    ui.byId("fClientPhone").value = client.phone || "";
    ui.byId("fCollab").value = auth.isAdmin(state.user) ? client.collab : state.user.name;
    ui.byId("fPrest").value = client.prestation;
    ui.byId("fDuration").value = client.duration;
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
    return state.db.clients.find(function (item) {
      return item.id === reservation.clientId || item.name === reservation.client;
    }) || null;
  }

  function saveReservation(reservationId) {
    var state = formState.state;
    var currentReservation = reservationId
      ? state.db.reservations.find(function (item) { return item.id === reservationId; })
      : null;
    var chosenCollab = auth.isAdmin(state.user) ? ui.byId("fCollab").value : state.user.name;
    var reservation = {
      id: reservationId || utils.uid("r"),
      client: ui.byId("fClientName").value.trim() || "Cliente",
      clientId: ui.byId("fClient").value,
      collab: chosenCollab,
      prestation: ui.byId("fPrest").value,
      date: ui.byId("fDate").value,
      time: ui.byId("fTime").value,
      duration: Number(ui.byId("fDuration").value) || 0,
      room: ui.byId("fRoom").value,
      status: ui.byId("fStatus").value,
      notes: ui.byId("fNotes").value
    };

    if (currentReservation && !canManageReservation(currentReservation)) {
      ui.byId("reservationMsg").innerHTML = '<div class="alert reservation-alert-box">Modification refusee pour cette collaboratrice.</div>';
      return;
    }

    var conflict = domain.conflictDetails(state.db, reservation, reservationId || null);
    if (conflict) {
      ui.byId("reservationMsg").innerHTML = ENABLE_CONFLICT_ASSISTANT
        ? '<div class="alert reservation-alert-box">Creneau deja pris. Choisissez un autre horaire.</div>'
        : '<div class="alert">' + utils.escapeHtml(conflict.message) + "</div>";
      if (ENABLE_CONFLICT_ASSISTANT) {
        showConflictPopup(reservation, conflict, reservationId || null);
      }
      return;
    }

    if (reservationId) {
      Object.assign(
        state.db.reservations.find(function (item) { return item.id === reservationId; }),
        reservation
      );
    } else {
      state.db.reservations.push(reservation);
    }

    state.selectedDate = reservation.date;
    ui.closeModal();
    formState.saveAndRefresh();
  }

  function cancelReservation(reservationId) {
    var state = formState.state;
    var reservation = state.db.reservations.find(function (item) {
      return item.id === reservationId;
    });

    if (!reservation || !window.confirm("Annuler ce rendez-vous ?")) {
      return;
    }

    reservation.status = "cancel";
    formState.saveAndRefresh();
  }

  function setReservationStatus(reservationId, status) {
    var state = formState.state;
    var reservation = state.db.reservations.find(function (item) {
      return item.id === reservationId;
    });

    if (!reservation) {
      return;
    }

    reservation.status = status;
    data.saveDb(state.db);
    state.refresh();

    if (status === "done") {
      openProposal(reservation);
    }
  }

  function openProposal(reservation) {
    var state = formState.state;
    var client = state.db.clients.find(function (item) {
      return item.id === reservation.clientId || item.name === reservation.client;
    });

    if (!client) {
      return;
    }

    var base = utils.dateObj(reservation.date);
    base.setDate(base.getDate() + Number(client.frequency || 21));

    var nextDate = utils.iso(base);
    var lockOwnCollab = !auth.isAdmin(state.user);
    var proposalCollab = lockOwnCollab ? state.user.name : client.collab;
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
        .filter(function (user) { return user.role === "collab"; })
        .map(function (user) {
          var selected = user.name === proposalCollab ? " selected" : "";
          return '<option value="' + utils.escapeHtml(user.name) + '"' + selected + ">" +
            utils.escapeHtml(user.name) + "</option>";
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
    var client = state.db.clients.find(function (item) {
      return item.id === clientId;
    });
    var chosenCollab = auth.isAdmin(state.user) ? ui.byId("pCollab").value : state.user.name;
    var reservation = {
      id: utils.uid("r"),
      client: client.name,
      clientId: client.id,
      collab: chosenCollab,
      prestation: ui.byId("pPrest").value,
      date: ui.byId("pDate").value,
      time: ui.byId("pTime").value,
      duration: Number(ui.byId("pDuration").value) || 0,
      room: ui.byId("pRoom").value,
      status: "pre",
      notes: "Prochain RDV valide"
    };

    var error = domain.conflict(state.db, reservation, null);
    if (error) {
      ui.byId("proposalMsg").innerHTML = '<div class="alert">' + utils.escapeHtml(error) + "</div>";
      return;
    }

    state.db.reservations.push(reservation);
    client.next = {
      date: reservation.date,
      time: reservation.time,
      prestation: reservation.prestation
    };

    ui.closeSheet();
    formState.saveAndRefresh();
  }

  function suggestProposalSlots() {
    var state = formState.state;
    var times = ["09:00", "11:00", "14:00", "16:00"];
    var chosenCollab = auth.isAdmin(state.user) ? ui.byId("pCollab").value : state.user.name;
    var html = ['<div class="success">Creneaux proposes :</div><div class="chips">'];

    times.forEach(function (time) {
      var reservation = {
        date: ui.byId("pDate").value,
        time: time,
        duration: Number(ui.byId("pDuration").value) || 0,
        room: ui.byId("pRoom").value,
        collab: chosenCollab
      };

      if (!domain.conflict(state.db, reservation, null)) {
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
    var available = [];

    times.forEach(function (time) {
      var testReservation = Object.assign({}, reservation, { time: time });
      if (!domain.conflict(state.db, testReservation, ignoreId)) {
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
