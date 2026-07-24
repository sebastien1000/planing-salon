(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var formState = window.SalonFormState;
  var supabaseData = window.SalonSupabaseData;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  function categoryLabel(category) {
    var pair = data.HOLIDAY_CATEGORIES.find(function (item) { return item[0] === category; });
    return pair ? pair[1] : category;
  }

  // Meme regle que canManageAbsence (js/core/form-absences.js) : l'admin
  // gere les conges de tout le monde, une collaboratrice ne gere que les
  // siens.
  function canManageHoliday(holiday) {
    var state = formState.state;
    return auth.isAdmin(state.user) || holiday.collab === state.user.name;
  }

  function holidaysForCollab(holidays, collabName) {
    return holidays
      .filter(function (item) { return item.collab === collabName; })
      .sort(function (a, b) { return a.startDate.localeCompare(b.startDate); });
  }

  function holidayCard(holiday, readOnly) {
    var dateLabel = holiday.startDate === holiday.endDate
      ? domain.fullDateLabel(holiday.startDate)
      : domain.fullDateLabel(holiday.startDate) + " -> " + domain.fullDateLabel(holiday.endDate);

    return [
      '<div class="card">',
      '  <div class="row">',
      '    <div class="grow">',
      "      <b>" + utils.escapeHtml(categoryLabel(holiday.category)) + "</b>",
      '      <div class="tiny">' + utils.escapeHtml(dateLabel) + "</div>",
      (holiday.notes ? '      <div class="tiny">' + utils.escapeHtml(holiday.notes) + "</div>" : ""),
      "    </div>",
      "  </div>",
      readOnly ? "" : [
        '  <div class="row" style="margin-top:10px">',
        '    <button class="secondary grow" type="button" data-action="edit-holiday" data-id="' + holiday.id + '">Modifier</button>',
        '    <button class="secondary danger" type="button" data-action="delete-holiday" data-id="' + holiday.id + '">Supprimer</button>',
        "  </div>"
      ].join(""),
      "</div>"
    ].join("");
  }

  function bindHolidayCardActions(root) {
    root.querySelectorAll("[data-action='edit-holiday']").forEach(function (button) {
      button.addEventListener("click", function () {
        openHolidayForm(button.dataset.id);
      });
    });

    root.querySelectorAll("[data-action='delete-holiday']").forEach(function (button) {
      button.addEventListener("click", function () {
        deleteHoliday(button.dataset.id);
      });
    });
  }

  function buildCategoryOptionsHtml(selectedCategory) {
    return data.HOLIDAY_CATEGORIES.map(function (pair) {
      var selected = pair[0] === selectedCategory ? " selected" : "";
      return '<option value="' + pair[0] + '"' + selected + ">" + pair[1] + "</option>";
    }).join("");
  }

  function openHolidayForm(holidayId, presetCollab) {
    var state = formState.state;

    var holiday = holidayId
      ? utils.findById(state.holidays, holidayId)
      : {
          id: "",
          collab: auth.isAdmin(state.user) ? (presetCollab || "") : state.user.name,
          startDate: state.selectedDate,
          startTime: "00:00",
          endDate: state.selectedDate,
          endTime: "23:59",
          category: "vacances",
          notes: ""
        };

    if (!holiday) {
      return;
    }

    if (holidayId && !canManageHoliday(holiday)) {
      window.alert("Vous ne pouvez pas modifier ce congé.");
      return;
    }

    var lockOwnCollab = !auth.isAdmin(state.user);
    var collabOptions = state.db.users
      .filter(function (user) {
        return user.role === "collab" && (user.active !== false || user.name === holiday.collab);
      })
      .map(function (user) {
        var selected = user.name === holiday.collab ? " selected" : "";
        var label = user.active === false ? user.name + " (inactif)" : user.name;
        return '<option value="' + utils.escapeHtml(user.name) + '"' + selected + ">" +
          utils.escapeHtml(label) + "</option>";
      }).join("");

    ui.showModal([
      '<div class="modal-head">',
      "  <h3>" + (holidayId ? "Modifier" : "Ajouter") + " un conge</h3>",
      '  <button id="closeHolidayModal" class="x" type="button">x</button>',
      "</div>",
      '<div id="holidayMsg"></div>',
      '<label for="hoCollab">Collaborateur</label>',
      '<select id="hoCollab" class="field"' + (lockOwnCollab ? " disabled" : "") + '>' + collabOptions + "</select>",
      '<label for="hoCategory">Motif</label>',
      '<select id="hoCategory" class="field">' + buildCategoryOptionsHtml(holiday.category) + "</select>",
      '<div class="grid2">',
      '  <div><label for="hoStartDate">Debut</label><input id="hoStartDate" class="field" type="date" value="' + holiday.startDate + '"></div>',
      '  <div><label for="hoStartTime">Heure debut</label><input id="hoStartTime" class="field" type="time" value="' + holiday.startTime + '"></div>',
      "</div>",
      '<div class="grid2">',
      '  <div><label for="hoEndDate">Fin</label><input id="hoEndDate" class="field" type="date" value="' + holiday.endDate + '"></div>',
      '  <div><label for="hoEndTime">Heure fin</label><input id="hoEndTime" class="field" type="time" value="' + holiday.endTime + '"></div>',
      "</div>",
      '<label for="hoNotes">Notes</label>',
      '<textarea id="hoNotes" class="field">' + utils.escapeHtml(holiday.notes || "") + "</textarea>",
      '<div class="row" style="margin-top:14px">',
      '  <button id="saveHolidayButton" class="primary grow" type="button">Enregistrer</button>',
      holidayId ? '  <button id="deleteHolidayButton" class="secondary danger" type="button">Supprimer</button>' : "",
      "</div>"
    ].join(""));

    ui.byId("closeHolidayModal").addEventListener("click", ui.closeModal);
    ui.byId("saveHolidayButton").addEventListener("click", function () {
      saveHoliday(holidayId);
    });

    var deleteButton = ui.byId("deleteHolidayButton");
    if (deleteButton) {
      deleteButton.addEventListener("click", function () {
        deleteHoliday(holidayId);
      });
    }
  }

  function saveHoliday(holidayId) {
    var state = formState.state;
    var current = holidayId ? utils.findById(state.holidays, holidayId) : null;

    if (holidayId && (!current || !canManageHoliday(current))) {
      ui.showAlert("holidayMsg", "Vous ne pouvez pas modifier ce congé.");
      return;
    }

    var collabName = auth.isAdmin(state.user) ? ui.byId("hoCollab").value : state.user.name;
    var collabUser = utils.findByName(state.db.users, collabName);

    if (!collabUser) {
      ui.showAlert("holidayMsg", "Collaborateur introuvable, réessayez.");
      return;
    }

    var holiday = {
      kind: "holiday",
      collab: collabName,
      collabId: collabUser.id,
      startDate: ui.byId("hoStartDate").value,
      startTime: ui.byId("hoStartTime").value || "00:00",
      endDate: ui.byId("hoEndDate").value,
      endTime: ui.byId("hoEndTime").value || "23:59",
      category: ui.byId("hoCategory").value,
      notes: ui.byId("hoNotes").value
    };

    if (!holidayId && !canManageHoliday(holiday)) {
      ui.showAlert("holidayMsg", "Vous ne pouvez créer un congé que pour vous-même.");
      return;
    }

    if (holiday.endDate < holiday.startDate ||
      (holiday.endDate === holiday.startDate && holiday.endTime <= holiday.startTime)) {
      ui.showAlert("holidayMsg", "La date/heure de fin doit être après le début.");
      return;
    }

    var clashingCount = (state.reservations || []).filter(function (reservation) {
      return reservation.collab === holiday.collab &&
        domain.isActiveReservation(reservation) &&
        domain.slotOverlapsRange(reservation.date, reservation.time, reservation.duration, holiday);
    }).length;

    if (clashingCount && !window.confirm(
      clashingCount + " rendez-vous existants tombent dans cette période. Créer quand même le congé ?"
    )) {
      return;
    }

    var saveButton = ui.byId("saveHolidayButton");
    saveButton.disabled = true;

    var writePromise = holidayId
      ? supabaseData.updateBlockedPeriod(holidayId, holiday)
      : supabaseData.createBlockedPeriod(holiday);

    writePromise.then(function () {
      ui.closeModal();
      state.refresh();
    }).catch(function (error) {
      saveButton.disabled = false;
      ui.showAlert("holidayMsg", "Erreur, impossible d'enregistrer ce congé.");
      window.console && window.console.error && window.console.error(error);
    });
  }

  function deleteHoliday(holidayId) {
    var state = formState.state;
    var holiday = utils.findById(state.holidays, holidayId);

    if (!holiday) {
      return;
    }

    if (!canManageHoliday(holiday)) {
      window.alert("Vous ne pouvez pas supprimer ce congé.");
      return;
    }

    if (!window.confirm("Supprimer ce conge ?")) {
      return;
    }

    supabaseData.deleteBlockedPeriod(holidayId).then(function () {
      ui.closeModal();
      state.refresh();
    }).catch(function (error) {
      window.alert("Erreur, impossible de supprimer ce congé.");
      window.console && window.console.error && window.console.error(error);
    });
  }

  window.SalonHolidayForms = {
    bindHolidayCardActions: bindHolidayCardActions,
    canManageHoliday: canManageHoliday,
    deleteHoliday: deleteHoliday,
    holidayCard: holidayCard,
    holidaysForCollab: holidaysForCollab,
    openHolidayForm: openHolidayForm,
    saveHoliday: saveHoliday
  };
}());
