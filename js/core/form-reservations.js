(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var formState = window.SalonFormState;
  var services = window.SalonServiceForms;
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
          prestation: "",
          serviceId: null,
          price: null,
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

    var roomOptions = buildRoomOptionsHtml(
      state,
      reservation.collab,
      reservation.room || domain.roomFor(state.db, reservation.collab, reservation.prestation)
    );

    var isAdmin = auth.isAdmin(state.user);
    // Photo figee sur le rendez-vous si deja enregistree (reservation.price) ;
    // pour un ancien rendez-vous sans photo figee, on retombe sur
    // l'ancien catalogue local (findPrestationPrice) le temps de la
    // migration progressive (voir js/core/data.js).
    var price = reservation.price != null ? reservation.price : findPrestationPrice(reservation.prestation);

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
      '  <div><label for="fClientPhone">Téléphone</label><input id="fClientPhone" class="field" placeholder="Téléphone" value="' + utils.escapeHtml(client ? client.phone || "" : "") + '"></div>',
      '  <div><label for="fClientEmail">Email</label><input id="fClientEmail" class="field" type="email" placeholder="Email (facultatif)" value="' + utils.escapeHtml(client ? client.email || "" : "") + '"></div>',
      "</div>",
      '<p class="tiny">Si la cliente n\'est pas dans la liste, remplissez son nom/téléphone : sa fiche sera créée automatiquement (ou réutilisée si elle existe déjà).</p>',
      '<div class="grid2">',
      '  <div><label for="fCollab">Collaboratrice</label><select id="fCollab" class="field">' +
        collabOptions + "</select></div>",
      "  <div>",
      '    <label for="fPrestButton">Prestation</label>',
      '    <button id="fPrestButton" class="secondary" type="button" style="width:100%;text-align:left"' +
        ' data-entry-id="" data-service-id="' + utils.escapeHtml(reservation.serviceId || "") + '">' +
        utils.escapeHtml(reservation.prestation || "Choisir une prestation") +
        "</button>",
      "  </div>",
      "</div>",
      '<div class="grid2">',
      '  <div><label for="fDate">Date</label><input id="fDate" class="field" type="date" value="' + reservation.date + '"></div>',
      '  <div><label for="fTime">Heure</label><input id="fTime" class="field" type="time" value="' + reservation.time + '"></div>',
      "</div>",
      '<div class="grid2">',
      '  <div><label for="fDuration">Duree min</label><input id="fDuration" class="field" type="number" value="' + reservation.duration + '"></div>',
      '  <div><label for="fRoom">Salle</label><select id="fRoom" class="field">' + roomOptions + "</select></div>",
      "</div>",
      '<div id="fEndTimePreview" class="tiny"></div>',
      '<label for="fPrice">Prix (EUR)</label><input id="fPrice" class="field" type="number" min="0" step="0.5"' +
        (isAdmin ? "" : " readonly") + ' value="' + price + '">',
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
      reservationId ? '    <button id="modalDoneReservationButton" class="secondary grow" type="button">Terminer</button>' : "",
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

  // Applique la prestation choisie dans le menu par categorie (voir
  // js/core/form-services.js) : remplit automatiquement le prix, la duree
  // et l'heure de fin estimee, comme demande.
  function applyServiceSelection(entry) {
    var button = ui.byId("fPrestButton");
    button.dataset.entryId = entry.id;
    button.dataset.serviceId = entry.serviceId;
    button.textContent = entry.name;
    ui.byId("fDuration").value = entry.duration;
    ui.byId("fPrice").value = entry.price;
    updateEndTimePreview();
  }

  function updateEndTimePreview() {
    var preview = ui.byId("fEndTimePreview");
    if (!preview) {
      return;
    }

    var time = ui.byId("fTime").value;
    var duration = Number(ui.byId("fDuration").value) || 0;
    preview.textContent = time && duration
      ? "Fin estimee : " + domain.addMinutes(time, duration)
      : "";
  }

  function openPrestationPicker() {
    var state = formState.state;
    var collabId = supabaseData.resolveCollabId(state.profiles, ui.byId("fCollab").value);

    if (!collabId) {
      window.alert("Choisissez d abord une collaboratrice.");
      return;
    }

    var currentEntryId = ui.byId("fPrestButton").dataset.entryId || "";
    services.openServicePickerSheet(collabId, currentEntryId, applyServiceSelection);
  }

  function bindReservationForm(reservationId) {
    var closeButton = ui.byId("closeModalButton");
    var saveButton = ui.byId("saveReservationButton");
    var doneButton = ui.byId("modalDoneReservationButton");
    var cancelButton = ui.byId("modalCancelReservationButton");
    var clientField = ui.byId("fClient");
    var collabField = ui.byId("fCollab");

    closeButton.addEventListener("click", ui.closeModal);
    saveButton.addEventListener("click", function () {
      saveReservation(reservationId);
    });

    if (doneButton) {
      doneButton.addEventListener("click", function () {
        ui.closeModal();
        openSupplementSheet(reservationId);
      });
    }

    if (cancelButton) {
      cancelButton.addEventListener("click", function () {
        cancelReservation(reservationId);
        ui.closeModal();
      });
    }

    clientField.addEventListener("change", fillClientHabit);
    collabField.addEventListener("change", function () {
      refreshCollabRestrictedFields();
      updateReservationRoom();
    });
    ui.byId("fPrestButton").addEventListener("click", openPrestationPicker);
    ui.byId("fTime").addEventListener("change", updateEndTimePreview);
    ui.byId("fDuration").addEventListener("input", updateEndTimePreview);

    updateReservationRoom();
    updateEndTimePreview();
  }

  // Chaque collaboratrice a son propre catalogue de prestations actives :
  // changer de collaboratrice invalide donc la prestation deja choisie.
  function refreshCollabRestrictedFields() {
    var state = formState.state;
    var button = ui.byId("fPrestButton");
    button.dataset.entryId = "";
    button.dataset.serviceId = "";
    button.textContent = "Choisir une prestation";
    ui.byId("fRoom").innerHTML = buildRoomOptionsHtml(state, ui.byId("fCollab").value, ui.byId("fRoom").value);
  }

  // La salle par defaut reste calculee depuis l'ancien catalogue local
  // (categorie ongles/noire/baby/exterieur) le temps de la migration : pour
  // une toute nouvelle prestation, ou si la collaboratrice n'a pas de salle
  // fixe attribuee, la liste deroulante reste utilisable manuellement.
  function updateReservationRoom() {
    var state = formState.state;
    var collab = ui.byId("fCollab").value;
    var room = domain.roomFor(state.db, collab, ui.byId("fPrestButton").textContent);
    if (room) {
      ui.byId("fRoom").value = room;
    }
  }

  // Une cliente peut desormais avoir plusieurs collaboratrices "habituelles"
  // (client.collabIds) : si la personne connectee en fait partie, on la
  // propose en priorite (probablement elle qui prend le rendez-vous),
  // sinon la premiere de la liste.
  function pickHabitualCollabName(state, client) {
    var ids = client.collabIds && client.collabIds.length
      ? client.collabIds
      : (client.collabId ? [client.collabId] : []);

    if (!ids.length) {
      return "";
    }

    var myId = supabaseData.resolveCollabId(state.profiles, state.user.name);
    var chosenId = ids.indexOf(myId) !== -1 ? myId : ids[0];
    return supabaseData.resolveCollabName(state.profiles, chosenId);
  }

  function fillClientHabit() {
    var state = formState.state;
    var clientId = ui.byId("fClient").value;
    var client = utils.findById(state.clients, clientId);

    if (!client) {
      return;
    }

    var habitualCollab = pickHabitualCollabName(state, client);

    ui.byId("fClientName").value = client.name;
    ui.byId("fClientPhone").value = client.phone || "";
    ui.byId("fClientEmail").value = client.email || "";
    ui.byId("fCollab").value = habitualCollab || state.user.name;
    refreshCollabRestrictedFields();
    updateReservationRoom();

    if (client.duration) {
      ui.byId("fDuration").value = client.duration;
      updateEndTimePreview();
    }

    if (!client.prestation) {
      return;
    }

    var collabId = supabaseData.resolveCollabId(state.profiles, ui.byId("fCollab").value);
    if (!collabId) {
      return;
    }

    services.loadCollaboratorServiceEntries(collabId).then(function (entries) {
      var stillSameCollab = supabaseData.resolveCollabId(state.profiles, ui.byId("fCollab").value) === collabId;
      var match = entries.find(function (entry) {
        return entry.active && entry.serviceActive && entry.name === client.prestation;
      });

      if (stillSameCollab && match) {
        applyServiceSelection(match);
      }
    }).catch(function () {});
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
    ui.showAlert(targetId, message);
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

    var chosenCollab = ui.byId("fCollab").value;
    var selectedClientId = ui.byId("fClient").value;
    var prestationButton = ui.byId("fPrestButton");
    var prestationName = prestationButton.textContent.trim();

    if (!prestationName || prestationName === "Choisir une prestation") {
      showSaveError("reservationMsg", "Choisissez une prestation.");
      return;
    }

    var price = Number(ui.byId("fPrice").value);
    if (!(price >= 0)) {
      showSaveError("reservationMsg", "Le prix ne peut pas être négatif.");
      return;
    }

    var duration = Number(ui.byId("fDuration").value) || 0;
    if (duration <= 0) {
      showSaveError("reservationMsg", "La durée doit être supérieure à 0.");
      return;
    }

    var draft = {
      id: reservationId || "",
      client: ui.byId("fClientName").value.trim() || "Cliente",
      clientId: selectedClientId,
      collab: chosenCollab,
      collabId: supabaseData.resolveCollabId(state.profiles, chosenCollab),
      prestation: prestationName,
      serviceId: prestationButton.dataset.serviceId || null,
      price: price,
      date: ui.byId("fDate").value,
      time: ui.byId("fTime").value,
      duration: duration,
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
          ? '<div class="alert reservation-alert-box">Créneau déjà pris. Choisissez un autre horaire.</div>'
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
            collabIds: draft.collabId ? [draft.collabId] : []
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
        showSaveError("reservationMsg", "Ce créneau vient d'être pris pour cette salle. Choisissez un autre horaire.");
        return;
      }

      showSaveError("reservationMsg", "Impossible d'enregistrer ce rendez-vous, réessayez.");
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
        window.alert("Impossible d'annuler ce rendez-vous, réessayez.");
        window.console && window.console.error && window.console.error(error);
      });
  }

  function setReservationStatus(reservationId, status, supplement, price) {
    var state = formState.state;
    var reservation = utils.findById(state.reservations, reservationId);

    if (!reservation) {
      return;
    }

    if (!canManageReservation(reservation)) {
      window.alert("Vous ne pouvez pas modifier un rendez-vous d'une autre collaboratrice.");
      return;
    }

    // Un rendez-vous deja "termine" qu'on re-marque "termine" (bouton
    // Terminer recliqueur sur un RDV deja complete) ne doit pas redeclencher
    // une nouvelle proposition : sinon un double-clic ou un aller-retour
    // sur ce RDV cree plusieurs propositions identiques pour la meme visite.
    var wasAlreadyDone = reservation.status === "done";
    var patch = Object.assign({}, reservation, { status: status });
    if (status === "done") {
      patch.supplement = Number(supplement) || 0;
      if (price != null) {
        patch.price = price;
      }
    }

    supabaseData.updateReservation(reservationId, patch).then(function (updated) {
      state.refresh();

      if (status === "done" && !wasAlreadyDone) {
        openProposal(updated);
      }
    }).catch(function (error) {
      window.alert("Impossible de mettre à jour ce rendez-vous, réessayez.");
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

    // Photo figee sur le rendez-vous si deja enregistree (reservation.price) ;
    // meme repli que buildReservationForm pour un ancien RDV sans photo figee.
    var originalPrice = reservation.price != null ? reservation.price : findPrestationPrice(reservation.prestation);

    ui.showSheet([
      '<div class="modal-head">',
      "  <h3>Terminer le RDV</h3>",
      '  <button id="closeSupplementButton" class="x" type="button">x</button>',
      "</div>",
      '<label for="fDonePrice">Prix (EUR)</label>',
      '<input id="fDonePrice" class="field" type="number" min="0" step="0.5" value="' + originalPrice + '">',
      '<div class="row" style="margin:8px 0 14px">',
      '  <button id="loyaltyDiscountButton" class="secondary grow" type="button">-10% fidelite</button>',
      '  <button id="loyaltyFreeButton" class="secondary grow" type="button">Offert</button>',
      "</div>",
      '<p class="tiny">Carte de fidelite : 10% de reduction ou une prestation offerte tous les 10 passages.</p>',
      '<p class="tiny">Ajoute un supplement si besoin, il sera compte dans la recette.</p>',
      '<label for="fSupplement">Supplement (EUR)</label>',
      '<input id="fSupplement" class="field" type="number" min="0" step="0.5" placeholder="0" value="' +
        (reservation.supplement || "") + '">',
      '<div class="row" style="margin-top:14px">',
      '  <button id="validateSupplementButton" class="primary grow" type="button">Valider</button>',
      "</div>"
    ].join(""));

    ui.byId("closeSupplementButton").addEventListener("click", ui.closeSheet);
    ui.byId("loyaltyDiscountButton").addEventListener("click", function () {
      ui.byId("fDonePrice").value = Math.round(originalPrice * 0.9 * 100) / 100;
    });
    ui.byId("loyaltyFreeButton").addEventListener("click", function () {
      ui.byId("fDonePrice").value = 0;
    });
    ui.byId("validateSupplementButton").addEventListener("click", function () {
      var supplement = Number(ui.byId("fSupplement").value) || 0;
      var price = Number(ui.byId("fDonePrice").value);

      if (!(price >= 0)) {
        window.alert("Le prix ne peut pas être négatif.");
        return;
      }

      ui.closeSheet();
      setReservationStatus(reservationId, "done", supplement, price);
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
    var isAdmin = auth.isAdmin(state.user);
    var habitualCollab = pickHabitualCollabName(state, client);
    var proposalCollab = habitualCollab || reservation.collab || state.user.name;
    var room = domain.roomFor(state.db, proposalCollab, client.prestation);

    // Modale (pas un sheet) : le selecteur de prestation ci-dessous
    // (openProposalPrestationPicker) ouvre lui-meme un sheet (l'unique
    // #sheet partage de l'app) - si ce formulaire vivait aussi dans ce
    // #sheet, choisir une prestation ecraserait son propre DOM (pDate,
    // pPrestButton...) et plantait juste apres (element introuvable). Le
    // formulaire de RDV classique evite deja ce piege en etant lui-meme une
    // modale, pour la meme raison.
    ui.showModal([
      '<div class="modal-head">',
      "  <h3>Prochain RDV proposé</h3>",
      '  <button id="closeModalButton" class="x" type="button">x</button>',
      "</div>",
      '<p class="tiny">Proposition interne pour la collaboratrice.</p>',
      '<label for="pDate">Date</label><input id="pDate" class="field" type="date" value="' + nextDate + '">',
      '<label for="pTime">Heure</label><input id="pTime" class="field" type="time" value="' + reservation.time + '">',
      '<label for="pCollab">Collaboratrice</label>',
      '<select id="pCollab" class="field">' + state.db.users
        .filter(function (user) {
          return user.role === "collab" && (user.active !== false || user.name === proposalCollab);
        })
        .map(function (user) {
          var selected = user.name === proposalCollab ? " selected" : "";
          var label = user.active === false ? user.name + " (inactif)" : user.name;
          return '<option value="' + utils.escapeHtml(user.name) + '"' + selected + ">" +
            utils.escapeHtml(label) + "</option>";
        }).join("") + "</select>",
      "  <div>",
      '    <label for="pPrestButton">Prestation</label>',
      '    <button id="pPrestButton" class="secondary" type="button" style="width:100%;text-align:left"' +
        ' data-entry-id="" data-service-id="">Choisir une prestation</button>',
      "  </div>",
      '<div class="grid2">',
      '  <div><label for="pDuration">Duree</label><input id="pDuration" class="field" type="number" value="' + client.duration + '"></div>',
      '  <div><label for="pRoom">Salle</label><input id="pRoom" class="field" readonly value="' + utils.escapeHtml(room) + '"></div>',
      "</div>",
      '<label for="pPrice">Prix (EUR)</label><input id="pPrice" class="field" type="number" min="0" step="0.5"' +
        (isAdmin ? "" : " readonly") + ' value="0">',
      '<div id="pEndTimePreview" class="tiny"></div>',
      '<div id="proposalMsg"></div>',
      '<div class="row" style="margin-top:14px">',
      '  <button id="saveProposalButton" class="primary grow" type="button">Valider</button>',
      '  <button id="suggestProposalButton" class="secondary" type="button">Autres creneaux</button>',
      "</div>"
    ].join(""));

    ui.byId("closeModalButton").addEventListener("click", ui.closeModal);
    ui.byId("pCollab").addEventListener("change", function () {
      resetProposalPrestation();
      updateProposalRoom();
    });
    ui.byId("pPrestButton").addEventListener("click", openProposalPrestationPicker);
    ui.byId("pTime").addEventListener("change", updateProposalEndTimePreview);
    ui.byId("pDuration").addEventListener("input", updateProposalEndTimePreview);
    ui.byId("saveProposalButton").addEventListener("click", function () {
      saveProposal(client.id);
    });
    ui.byId("suggestProposalButton").addEventListener("click", suggestProposalSlots);

    updateProposalEndTimePreview();
    preselectProposalPrestation(proposalCollab, client.prestation);
  }

  // Essaie de pre-selectionner automatiquement la prestation habituelle de
  // la cliente (client.prestation, un simple texte) si elle correspond a
  // une prestation active configuree pour cette collaboratrice. Si aucune
  // correspondance n'est trouvee (prestation renommee/retiree du catalogue
  // de cette collaboratrice), le bouton reste sur "Choisir une prestation"
  // - la collaboratrice doit alors choisir manuellement, sans erreur JS.
  function preselectProposalPrestation(collabName, prestationName) {
    if (!prestationName) {
      return;
    }

    var state = formState.state;
    var collabId = supabaseData.resolveCollabId(state.profiles, collabName);
    if (!collabId) {
      return;
    }

    services.loadCollaboratorServiceEntries(collabId).then(function (entries) {
      var stillSameCollab = ui.byId("pCollab") &&
        supabaseData.resolveCollabId(state.profiles, ui.byId("pCollab").value) === collabId;
      var match = entries.find(function (entry) {
        return entry.active && entry.serviceActive && entry.name === prestationName;
      });

      if (stillSameCollab && match) {
        applyProposalServiceSelection(match);
      }
    }).catch(function () {});
  }

  function applyProposalServiceSelection(entry) {
    var button = ui.byId("pPrestButton");
    button.dataset.entryId = entry.id;
    button.dataset.serviceId = entry.serviceId;
    button.textContent = entry.name;
    ui.byId("pDuration").value = entry.duration;
    ui.byId("pPrice").value = entry.price;
    updateProposalEndTimePreview();
  }

  function resetProposalPrestation() {
    var button = ui.byId("pPrestButton");
    button.dataset.entryId = "";
    button.dataset.serviceId = "";
    button.textContent = "Choisir une prestation";
  }

  function openProposalPrestationPicker() {
    var state = formState.state;
    var collabId = supabaseData.resolveCollabId(state.profiles, ui.byId("pCollab").value);

    if (!collabId) {
      window.alert("Choisissez d abord une collaboratrice.");
      return;
    }

    var currentEntryId = ui.byId("pPrestButton").dataset.entryId || "";
    services.openServicePickerSheet(collabId, currentEntryId, applyProposalServiceSelection);
  }

  function updateProposalEndTimePreview() {
    var preview = ui.byId("pEndTimePreview");
    if (!preview) {
      return;
    }

    var time = ui.byId("pTime").value;
    var duration = Number(ui.byId("pDuration").value) || 0;
    preview.textContent = time && duration
      ? "Fin estimee : " + domain.addMinutes(time, duration)
      : "";
  }

  function updateProposalRoom() {
    var state = formState.state;
    var collab = ui.byId("pCollab").value;
    var room = domain.roomFor(state.db, collab, ui.byId("pPrestButton").textContent);
    if (room) {
      ui.byId("pRoom").value = room;
    }
  }

  function saveProposal(clientId) {
    var state = formState.state;
    var client = utils.findById(state.clients, clientId);
    var chosenCollab = ui.byId("pCollab").value;
    var prestationButton = ui.byId("pPrestButton");
    var prestationName = prestationButton.textContent.trim();

    if (!prestationName || prestationName === "Choisir une prestation") {
      showSaveError("proposalMsg", "Choisissez une prestation.");
      return;
    }

    var price = Number(ui.byId("pPrice").value);
    if (!(price >= 0)) {
      showSaveError("proposalMsg", "Le prix ne peut pas être négatif.");
      return;
    }

    var duration = Number(ui.byId("pDuration").value) || 0;
    if (duration <= 0) {
      showSaveError("proposalMsg", "La durée doit être supérieure à 0.");
      return;
    }

    var draft = {
      id: "",
      client: client.name,
      clientId: client.id,
      collab: chosenCollab,
      collabId: supabaseData.resolveCollabId(state.profiles, chosenCollab),
      prestation: prestationName,
      serviceId: prestationButton.dataset.serviceId || null,
      price: price,
      date: ui.byId("pDate").value,
      time: ui.byId("pTime").value,
      duration: duration,
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
        ui.closeModal();
        state.refresh();
      });
    }).catch(function (error) {
      saveButton.disabled = false;

      if (error && error.isSlotTaken) {
        showSaveError("proposalMsg", "Ce créneau vient d'être pris. Choisissez-en un autre.");
        return;
      }

      showSaveError("proposalMsg", "Impossible d'enregistrer ce rendez-vous, réessayez.");
      window.console && window.console.error && window.console.error(error);
    });
  }

  function suggestProposalSlots() {
    var state = formState.state;
    var times = ["09:00", "11:00", "14:00", "16:00"];
    var chosenCollab = ui.byId("pCollab").value;
    var date = ui.byId("pDate").value;

    ui.byId("proposalMsg").innerHTML = '<p class="tiny">Verification des creneaux...</p>';

    freshVirtualDbForDate(state, date).then(function (virtualDb) {
      var html = ['<div class="success">Créneaux proposés :</div><div class="chips">'];

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
      ui.showAlert("proposalMsg", "Impossible de vérifier les créneaux, réessayez.");
    });
  }

  function showConflictPopup(reservation, conflict, ignoreId) {
    var conflictReservation = conflict.reservation;
    var title = "Ce créneau est déjà pris";
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
      "  <h3>Créneau déjà pris</h3>",
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
      root.innerHTML = '<div class="alert">Impossible de vérifier les créneaux, réessayez.</div>';
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
    setReservationStatus: setReservationStatus
  };
}());
