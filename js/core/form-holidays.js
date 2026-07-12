(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var formState = window.SalonFormState;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  function categoryLabel(category) {
    var pair = data.HOLIDAY_CATEGORIES.find(function (item) { return item[0] === category; });
    return pair ? pair[1] : category;
  }

  function holidaysForCollab(db, collabName) {
    return db.holidays
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

    if (!auth.isAdmin(state.user)) {
      window.alert("Seul l'administrateur peut gerer les conges.");
      return;
    }

    var holiday = holidayId
      ? utils.findById(state.db.holidays, holidayId)
      : {
          id: "",
          collab: presetCollab || "",
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
      '<select id="hoCollab" class="field">' + collabOptions + "</select>",
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

    if (!auth.isAdmin(state.user)) {
      window.alert("Seul l'administrateur peut gerer les conges.");
      return;
    }

    var holiday = {
      id: holidayId || utils.uid("h"),
      collab: ui.byId("hoCollab").value,
      startDate: ui.byId("hoStartDate").value,
      startTime: ui.byId("hoStartTime").value || "00:00",
      endDate: ui.byId("hoEndDate").value,
      endTime: ui.byId("hoEndTime").value || "23:59",
      category: ui.byId("hoCategory").value,
      notes: ui.byId("hoNotes").value
    };

    if (holiday.endDate < holiday.startDate ||
      (holiday.endDate === holiday.startDate && holiday.endTime <= holiday.startTime)) {
      ui.showAlert("holidayMsg", "La date/heure de fin doit etre apres le debut.");
      return;
    }

    var clashingCount = (state.reservations || []).filter(function (reservation) {
      return reservation.collab === holiday.collab &&
        domain.isActiveReservation(reservation) &&
        domain.slotOverlapsRange(reservation.date, reservation.time, reservation.duration, holiday);
    }).length;

    if (clashingCount && !window.confirm(
      clashingCount + " rendez-vous existants tombent dans cette periode. Creer quand meme le conge ?"
    )) {
      return;
    }

    if (holidayId) {
      var current = utils.findById(state.db.holidays, holidayId);
      if (current) {
        Object.assign(current, holiday);
      }
    } else {
      state.db.holidays.push(holiday);
    }

    ui.closeModal();
    formState.saveAndRefresh();
  }

  function deleteHoliday(holidayId) {
    var state = formState.state;

    if (!auth.isAdmin(state.user)) {
      window.alert("Seul l'administrateur peut gerer les conges.");
      return;
    }

    if (!window.confirm("Supprimer ce conge ?")) {
      return;
    }

    state.db.holidays = state.db.holidays.filter(function (item) {
      return item.id !== holidayId;
    });

    ui.closeModal();
    formState.saveAndRefresh();
  }

  window.SalonHolidayForms = {
    bindHolidayCardActions: bindHolidayCardActions,
    deleteHoliday: deleteHoliday,
    holidayCard: holidayCard,
    holidaysForCollab: holidaysForCollab,
    openHolidayForm: openHolidayForm,
    saveHoliday: saveHoliday
  };
}());
