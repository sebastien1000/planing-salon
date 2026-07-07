(function () {
  var data = window.SalonData;
  var formState = window.SalonFormState;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  function openAbsenceForm() {
    var state = formState.state;
    ui.showModal([
      '<div class="modal-head">',
      "  <h3>Bloquer un creneau</h3>",
      '  <button id="closeAbsenceModal" class="x" type="button">x</button>',
      "</div>",
      '<label for="aCollab">Collaboratrice</label>',
      '<select id="aCollab" class="field">' + state.db.users
        .filter(function (user) { return user.role === "collab"; })
        .map(function (user) {
          return '<option value="' + utils.escapeHtml(user.name) + '">' + utils.escapeHtml(user.name) + "</option>";
        }).join("") + "</select>",
      '<div class="grid2">',
      '  <div><label for="aDate">Date</label><input id="aDate" class="field" type="date" value="' + state.selectedDate + '"></div>',
      '  <div><label for="aTime">Heure</label><input id="aTime" class="field" type="time" value="09:00"></div>',
      "</div>",
      '<label for="aDuration">Duree min</label><input id="aDuration" class="field" type="number" value="120">',
      '<label for="aLabel">Motif</label><input id="aLabel" class="field" value="Indisponible">',
      '<button id="saveAbsenceButton" class="primary" style="width:100%;margin-top:14px" type="button">Bloquer</button>'
    ].join(""));

    ui.byId("closeAbsenceModal").addEventListener("click", ui.closeModal);
    ui.byId("saveAbsenceButton").addEventListener("click", saveAbsence);
  }

  function saveAbsence() {
    var state = formState.state;
    state.db.absences.push({
      id: utils.uid("a"),
      collab: ui.byId("aCollab").value,
      date: ui.byId("aDate").value,
      time: ui.byId("aTime").value,
      duration: Number(ui.byId("aDuration").value) || 0,
      label: ui.byId("aLabel").value
    });

    ui.closeModal();
    formState.saveAndRefresh();
  }

  function bindPhotoInput() {
    var state = formState.state;
    var photoInput = ui.byId("photoInput");
    var photoButton = ui.byId("photoButton");

    if (photoButton) {
      photoButton.addEventListener("click", function () {
        photoInput.click();
      });
    }

    photoInput.addEventListener("change", function (event) {
      var file = event.target.files[0];
      if (!file) {
        return;
      }

      var reader = new FileReader();
      reader.onload = function () {
        state.db.photos.unshift(reader.result);
        state.db.photos = state.db.photos.slice(0, 3);

        try {
          data.saveDb(state.db);
          state.refresh();
        } catch (error) {
          window.alert("La photo est trop lourde pour le stockage local.");
        }
      };
      reader.readAsDataURL(file);
    });
  }

  window.SalonMiscForms = {
    bindPhotoInput: bindPhotoInput,
    openAbsenceForm: openAbsenceForm
  };
}());
