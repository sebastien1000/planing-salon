(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var formState = window.SalonFormState;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  function canManageAbsence(absence) {
    var state = formState.state;
    return auth.isAdmin(state.user) || absence.collab === state.user.name;
  }

  function categoryLabel(category) {
    var pair = data.ABSENCE_CATEGORIES.find(function (item) { return item[0] === category; });
    return pair ? pair[1] : category;
  }

  function absenceCard(absence) {
    var state = formState.state;
    var manageable = canManageAbsence(absence);
    var dateLabel = absence.startDate === absence.endDate
      ? domain.fullDateLabel(absence.startDate) + " · " + absence.startTime + " - " + absence.endTime
      : domain.fullDateLabel(absence.startDate) + " " + absence.startTime + " -> " +
        domain.fullDateLabel(absence.endDate) + " " + absence.endTime;

    return [
      '<div class="card">',
      '  <div class="row">',
      '    <div class="grow">',
      "      <b>" + utils.escapeHtml(categoryLabel(absence.category)) + "</b>",
      '      <div class="tiny">' + utils.escapeHtml(absence.collab) + "</div>",
      '      <div class="tiny">' + utils.escapeHtml(dateLabel) + "</div>",
      (absence.notes ? '      <div class="tiny">' + utils.escapeHtml(absence.notes) + "</div>" : ""),
      "    </div>",
      "  </div>",
      manageable
        ? [
          '  <div class="row" style="margin-top:10px">',
          '    <button class="secondary grow" type="button" data-action="edit-absence" data-id="' + absence.id + '">Modifier</button>',
          '    <button class="secondary danger" type="button" data-action="delete-absence" data-id="' + absence.id + '">Supprimer</button>',
          "  </div>"
        ].join("")
        : "",
      "</div>"
    ].join("");
  }

  function bindAbsenceCardActions(root) {
    root.querySelectorAll("[data-action='edit-absence']").forEach(function (button) {
      button.addEventListener("click", function () {
        openAbsenceForm(button.dataset.id);
      });
    });

    root.querySelectorAll("[data-action='delete-absence']").forEach(function (button) {
      button.addEventListener("click", function () {
        deleteAbsence(button.dataset.id);
      });
    });
  }

  function defaultCollabName(state) {
    var firstCollab = state.db.users.find(function (user) { return user.role === "collab" && user.active !== false; });
    return firstCollab ? firstCollab.name : "";
  }

  function buildCategoryOptionsHtml(selectedCategory) {
    return data.ABSENCE_CATEGORIES.map(function (pair) {
      var selected = pair[0] === selectedCategory ? " selected" : "";
      return '<option value="' + pair[0] + '"' + selected + ">" + pair[1] + "</option>";
    }).join("");
  }

  function openAbsenceForm(absenceId) {
    var state = formState.state;
    var absence = absenceId
      ? utils.findById(state.db.absences, absenceId)
      : {
          id: "",
          collab: auth.isAdmin(state.user) ? defaultCollabName(state) : state.user.name,
          startDate: state.selectedDate,
          startTime: "09:00",
          endDate: state.selectedDate,
          endTime: "18:00",
          category: "autre",
          notes: ""
        };

    if (!absence) {
      return;
    }

    if (absenceId && !canManageAbsence(absence)) {
      window.alert("Vous ne pouvez pas modifier cette absence.");
      return;
    }

    var lockOwnCollab = !auth.isAdmin(state.user);
    var collabOptions = state.db.users
      .filter(function (user) {
        return user.role === "collab" && (user.active !== false || user.name === absence.collab);
      })
      .map(function (user) {
        var selected = user.name === absence.collab ? " selected" : "";
        var label = user.active === false ? user.name + " (inactif)" : user.name;
        return '<option value="' + utils.escapeHtml(user.name) + '"' + selected + ">" +
          utils.escapeHtml(label) + "</option>";
      }).join("");

    ui.showModal([
      '<div class="modal-head">',
      "  <h3>" + (absenceId ? "Modifier" : "Ajouter") + " une absence</h3>",
      '  <button id="closeAbsenceModal" class="x" type="button">x</button>',
      "</div>",
      '<div id="absenceMsg"></div>',
      '<label for="abCollab">Collaborateur</label>',
      '<select id="abCollab" class="field"' + (lockOwnCollab ? " disabled" : "") + '>' + collabOptions + "</select>",
      '<label for="abCategory">Motif</label>',
      '<select id="abCategory" class="field">' + buildCategoryOptionsHtml(absence.category) + "</select>",
      '<div class="grid2">',
      '  <div><label for="abStartDate">Debut</label><input id="abStartDate" class="field" type="date" value="' + absence.startDate + '"></div>',
      '  <div><label for="abStartTime">Heure debut</label><input id="abStartTime" class="field" type="time" value="' + absence.startTime + '"></div>',
      "</div>",
      '<div class="grid2">',
      '  <div><label for="abEndDate">Fin</label><input id="abEndDate" class="field" type="date" value="' + absence.endDate + '"></div>',
      '  <div><label for="abEndTime">Heure fin</label><input id="abEndTime" class="field" type="time" value="' + absence.endTime + '"></div>',
      "</div>",
      '<label for="abNotes">Details (prive)</label>',
      '<textarea id="abNotes" class="field">' + utils.escapeHtml(absence.notes || "") + "</textarea>",
      '<div class="row" style="margin-top:14px">',
      '  <button id="saveAbsenceButton" class="primary grow" type="button">Enregistrer</button>',
      absenceId ? '  <button id="deleteAbsenceButton" class="secondary danger" type="button">Supprimer</button>' : "",
      "</div>"
    ].join(""));

    ui.byId("closeAbsenceModal").addEventListener("click", ui.closeModal);
    ui.byId("saveAbsenceButton").addEventListener("click", function () {
      saveAbsence(absenceId);
    });

    var deleteButton = ui.byId("deleteAbsenceButton");
    if (deleteButton) {
      deleteButton.addEventListener("click", function () {
        deleteAbsence(absenceId);
      });
    }
  }

  function saveAbsence(absenceId) {
    var state = formState.state;
    var current = absenceId ? utils.findById(state.db.absences, absenceId) : null;

    if (absenceId && (!current || !canManageAbsence(current))) {
      ui.showAlert("absenceMsg", "Vous ne pouvez pas modifier cette absence.");
      return;
    }

    var collab = auth.isAdmin(state.user) ? ui.byId("abCollab").value : state.user.name;
    var absence = {
      id: absenceId || utils.uid("a"),
      collab: collab,
      startDate: ui.byId("abStartDate").value,
      startTime: ui.byId("abStartTime").value || "00:00",
      endDate: ui.byId("abEndDate").value,
      endTime: ui.byId("abEndTime").value || "23:59",
      category: ui.byId("abCategory").value,
      notes: ui.byId("abNotes").value
    };

    if (!absenceId && !canManageAbsence(absence)) {
      ui.showAlert("absenceMsg", "Vous ne pouvez creer une absence que pour vous-meme.");
      return;
    }

    if (absence.endDate < absence.startDate ||
      (absence.endDate === absence.startDate && absence.endTime <= absence.startTime)) {
      ui.showAlert("absenceMsg", "La date/heure de fin doit etre apres le debut.");
      return;
    }

    var clashingCount = (state.reservations || []).filter(function (reservation) {
      return reservation.collab === collab &&
        domain.isActiveReservation(reservation) &&
        domain.slotOverlapsRange(reservation.date, reservation.time, reservation.duration, absence);
    }).length;

    if (clashingCount && !window.confirm(
      clashingCount + " rendez-vous existants tombent dans cette periode. Creer quand meme l'absence ?"
    )) {
      return;
    }

    if (absenceId) {
      Object.assign(current, absence);
    } else {
      state.db.absences.push(absence);
    }

    ui.closeModal();
    formState.saveAndRefresh();
  }

  function deleteAbsence(absenceId) {
    var state = formState.state;
    var absence = utils.findById(state.db.absences, absenceId);

    if (!absence) {
      return;
    }

    if (!canManageAbsence(absence)) {
      window.alert("Vous ne pouvez pas supprimer cette absence.");
      return;
    }

    if (!window.confirm("Supprimer cette absence ?")) {
      return;
    }

    state.db.absences = state.db.absences.filter(function (item) {
      return item.id !== absenceId;
    });

    ui.closeModal();
    formState.saveAndRefresh();
  }

  window.SalonAbsenceForms = {
    absenceCard: absenceCard,
    bindAbsenceCardActions: bindAbsenceCardActions,
    canManageAbsence: canManageAbsence,
    deleteAbsence: deleteAbsence,
    openAbsenceForm: openAbsenceForm,
    saveAbsence: saveAbsence
  };
}());
