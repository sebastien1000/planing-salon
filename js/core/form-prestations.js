(function () {
  var domain = window.SalonDomain;
  var formState = window.SalonFormState;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  function prestationCard(prestation) {
    return [
      '<div class="card">',
      '  <div class="row">',
      '    <div class="grow">',
      "      <h3>" + utils.escapeHtml(prestation.name) + "</h3>",
      '      <div class="meta">',
      '        <span class="badge">' + utils.escapeHtml(domain.catLabel(prestation.cat)) + "</span>",
      '        <span class="badge">' + prestation.duration + " min</span>",
      '        <span class="badge">' + prestation.price + " EUR</span>",
      "      </div>",
      '      <div class="tiny">Salle auto : ' + utils.escapeHtml(domain.previewRoomForCat(prestation.cat)) + "</div>",
      "    </div>",
      `    <button class="secondary" type="button" data-edit-prestation="${prestation.id}">Modifier</button>`,
      "  </div>",
      "</div>"
    ].join("");
  }

  function bindPrestationActions(root) {
    root.querySelectorAll("[data-edit-prestation]").forEach(function (button) {
      button.addEventListener("click", function () {
        openPrestationForm(button.dataset.editPrestation);
      });
    });
  }

  function openPrestationForm(prestationId) {
    var state = formState.state;
    var prestation = prestationId
      ? utils.findById(state.db.prestations, prestationId)
      : { id: "", name: "", cat: "ongles", duration: 60, price: 0 };

    ui.showModal([
      '<div class="modal-head">',
      "  <h3>" + (prestationId ? "Modifier" : "Ajouter") + " une prestation</h3>",
      '  <button id="closePrestationModal" class="x" type="button">x</button>',
      "</div>",
      '<div id="prestationMsg"></div>',
      '<label for="prName">Nom de la prestation</label><input id="prName" class="field" value="' + utils.escapeHtml(prestation.name) + '">',
      '<label for="prCat">Type / salle automatique</label>',
      '<select id="prCat" class="field">',
      buildPrestationCategoryOption(prestation.cat, "ongles", "Ongles"),
      buildPrestationCategoryOption(prestation.cat, "noire", "Salle Noire"),
      buildPrestationCategoryOption(prestation.cat, "baby", "Baby Spa"),
      buildPrestationCategoryOption(prestation.cat, "outside", "Exterieur"),
      "</select>",
      '<div class="grid2">',
      '  <div><label for="prDuration">Duree</label><input id="prDuration" class="field" type="number" value="' + prestation.duration + '"></div>',
      '  <div><label for="prPrice">Prix</label><input id="prPrice" class="field" type="number" value="' + prestation.price + '"></div>',
      "</div>",
      '<div class="row" style="margin-top:14px">',
      '  <button id="savePrestationButton" class="primary grow" type="button">Enregistrer</button>',
      prestationId ? '  <button id="deletePrestationButton" class="secondary danger" type="button">Supprimer</button>' : "",
      "</div>"
    ].join(""));

    ui.byId("closePrestationModal").addEventListener("click", ui.closeModal);
    ui.byId("savePrestationButton").addEventListener("click", function () {
      savePrestation(prestationId);
    });

    if (prestationId) {
      ui.byId("deletePrestationButton").addEventListener("click", function () {
        deletePrestation(prestationId);
      });
    }
  }

  function buildPrestationCategoryOption(selectedValue, optionValue, label) {
    var selected = selectedValue === optionValue ? " selected" : "";
    return '<option value="' + optionValue + '"' + selected + ">" + label + "</option>";
  }

  function savePrestation(prestationId) {
    var state = formState.state;
    var name = ui.byId("prName").value.trim();
    var duplicate;
    var prestation;

    if (!name) {
      ui.byId("prestationMsg").innerHTML = '<div class="alert">Le nom est obligatoire.</div>';
      return;
    }

    duplicate = state.db.prestations.find(function (item) {
      return item.name.toLowerCase() === name.toLowerCase() && item.id !== prestationId;
    });

    if (duplicate) {
      ui.byId("prestationMsg").innerHTML = '<div class="alert">Cette prestation existe deja.</div>';
      return;
    }

    var duration = Number(ui.byId("prDuration").value);
    var price = Number(ui.byId("prPrice").value);

    if (!duration || duration <= 0) {
      ui.byId("prestationMsg").innerHTML = '<div class="alert">La duree doit etre superieure a 0.</div>';
      return;
    }

    if (!(price >= 0)) {
      ui.byId("prestationMsg").innerHTML = '<div class="alert">Le prix ne peut pas etre negatif.</div>';
      return;
    }

    prestation = {
      id: prestationId || utils.uid("p"),
      name: name,
      cat: ui.byId("prCat").value,
      duration: duration,
      price: price
    };

    if (prestationId) {
      Object.assign(
        utils.findById(state.db.prestations, prestationId),
        prestation
      );
    } else {
      state.db.prestations.push(prestation);
    }

    ui.closeModal();
    formState.saveAndRefresh();
  }

  function deletePrestation(prestationId) {
    var state = formState.state;
    var prestation = utils.findById(state.db.prestations, prestationId);
    var used = (state.reservations || []).some(function (reservation) {
      return reservation.prestation === prestation.name;
    }) || (state.clients || []).some(function (client) {
      return client.prestation === prestation.name;
    });

    if (used) {
      ui.byId("prestationMsg").innerHTML = [
        '<div class="alert">',
        "Impossible de supprimer : cette prestation est deja utilisee.",
        "</div>"
      ].join("");
      return;
    }

    if (!window.confirm("Supprimer cette prestation ?")) {
      return;
    }

    state.db.prestations = state.db.prestations.filter(function (item) {
      return item.id !== prestationId;
    });

    ui.closeModal();
    formState.saveAndRefresh();
  }

  window.SalonPrestationForms = {
    bindPrestationActions: bindPrestationActions,
    openPrestationForm: openPrestationForm,
    prestationCard: prestationCard
  };
}());
