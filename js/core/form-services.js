(function () {
  var auth = window.SalonAuth;
  var supabaseData = window.SalonSupabaseData;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  // Catalogue general (categories + prestations possibles) : commun a tout
  // le monde, change rarement, mis en cache pour ne pas le recharger a
  // chaque ouverture d'un formulaire. forceRefresh permet a l'ecran
  // d'administration de le rafraichir apres l'ajout d'une prestation.
  var catalogCache = null;

  function loadCatalog(forceRefresh) {
    if (catalogCache && !forceRefresh) {
      return Promise.resolve(catalogCache);
    }

    return Promise.all([
      supabaseData.listServiceCategories(true),
      supabaseData.listServices(true)
    ]).then(function (results) {
      catalogCache = { categories: results[0], services: results[1] };
      return catalogCache;
    });
  }

  // Fusionne le tarif/la duree propres a une collaboratrice
  // (collaborator_services) avec le nom/la categorie du catalogue general.
  function loadCollaboratorEntries(collaboratorId) {
    return Promise.all([
      loadCatalog(),
      supabaseData.listCollaboratorServices(collaboratorId)
    ]).then(function (results) {
      var catalog = results[0];
      var rows = results[1];

      return rows.map(function (row) {
        var service = utils.findById(catalog.services, row.serviceId);
        var category = service ? utils.findById(catalog.categories, service.categoryId) : null;

        return {
          id: row.id,
          serviceId: row.serviceId,
          name: row.customName || (service ? service.name : "Prestation supprimee du catalogue"),
          categoryId: service ? service.categoryId : null,
          categoryName: category ? category.name : "Autres",
          categoryOrder: category ? category.displayOrder : 999,
          serviceOrder: service ? service.displayOrder : 999,
          serviceActive: !!service && service.active,
          price: row.price,
          duration: row.duration,
          active: row.active,
          notes: row.notes
        };
      });
    });
  }

  function groupByCategory(entries) {
    var byCategory = {};

    entries.forEach(function (entry) {
      var key = entry.categoryId || "autres";
      if (!byCategory[key]) {
        byCategory[key] = { name: entry.categoryName, order: entry.categoryOrder, items: [] };
      }
      byCategory[key].items.push(entry);
    });

    return Object.keys(byCategory)
      .map(function (key) { return byCategory[key]; })
      .sort(function (a, b) { return a.order - b.order; })
      .map(function (group) {
        group.items.sort(function (a, b) { return a.serviceOrder - b.serviceOrder; });
        return group;
      });
  }

  // ---- Menu de prestations par categorie (utilise dans le formulaire de
  // rendez-vous) : uniquement les prestations actives et proposees par
  // cette collaboratrice. Chaque categorie est un bouton "menu burger" (☰) ;
  // au clic, la feuille affiche ses prestations avec un retour vers la
  // liste des categories - meme principe que le bouton "☰ Filtres" du
  // planning (js/pages/planning.js). ----

  function buildCategoryMenuHtml(groups) {
    if (!groups.length) {
      return '<p class="tiny">Aucune prestation active pour cette collaboratrice. Un administrateur doit d abord lui en attribuer dans la page Plus.</p>';
    }

    return '<div class="service-category-menu">' + groups.map(function (group, index) {
      return '<button class="secondary service-category-burger" type="button" data-category-index="' + index + '">' +
        "<span>☰ " + utils.escapeHtml(group.name) + "</span>" +
        '<span class="tiny">(' + group.items.length + ")</span>" +
        "</button>";
    }).join("") + "</div>";
  }

  function buildCategoryServicesHtml(group, selectedEntryId) {
    return [
      '<button class="secondary service-category-back" type="button" data-back-to-categories>&larr; Retour aux categories</button>',
      '<h4 class="service-category-title">' + utils.escapeHtml(group.name) + "</h4>",
      '<div class="service-category-list">',
      group.items.map(function (item) {
        var selectedClass = item.id === selectedEntryId ? " service-option--selected" : "";
        return '<button class="secondary service-option' + selectedClass +
          '" type="button" data-service-entry="' + item.id + '">' +
          '<span class="service-option-name">' + utils.escapeHtml(item.name) + "</span>" +
          '<span class="service-option-meta">' + item.price + " EUR &middot; " + item.duration + " min</span>" +
          "</button>";
      }).join(""),
      "</div>"
    ].join("");
  }

  function renderPickerCategoryList(body, groups, active, selectedEntryId, onSelect) {
    body.innerHTML = buildCategoryMenuHtml(groups);

    body.querySelectorAll("[data-category-index]").forEach(function (button) {
      button.addEventListener("click", function () {
        var group = groups[Number(button.dataset.categoryIndex)];
        renderPickerCategoryServices(body, groups, group, active, selectedEntryId, onSelect);
      });
    });
  }

  function renderPickerCategoryServices(body, groups, group, active, selectedEntryId, onSelect) {
    body.innerHTML = buildCategoryServicesHtml(group, selectedEntryId);

    body.querySelector("[data-back-to-categories]").addEventListener("click", function () {
      renderPickerCategoryList(body, groups, active, selectedEntryId, onSelect);
    });

    body.querySelectorAll("[data-service-entry]").forEach(function (button) {
      button.addEventListener("click", function () {
        var entry = active.find(function (item) { return item.id === button.dataset.serviceEntry; });
        if (entry) {
          onSelect(entry);
        }
        ui.closeSheet();
      });
    });
  }

  // onSelect(entry) est appele avec la prestation choisie (id, nom, prix,
  // duree...) ; la feuille se ferme d'elle-meme apres selection.
  function openServicePickerSheet(collaboratorId, selectedEntryId, onSelect) {
    ui.showSheet([
      '<div class="modal-head">',
      "  <h3>Choisir une prestation</h3>",
      '  <button id="closeServicePickerButton" class="x" type="button">x</button>',
      "</div>",
      '<div id="servicePickerBody"><p class="tiny">Chargement...</p></div>'
    ].join(""), "service-picker-sheet");

    ui.byId("closeServicePickerButton").addEventListener("click", ui.closeSheet);

    if (!collaboratorId) {
      ui.byId("servicePickerBody").innerHTML =
        '<p class="tiny">Choisissez d abord une collaboratrice.</p>';
      return;
    }

    loadCollaboratorEntries(collaboratorId).then(function (entries) {
      var body = ui.byId("servicePickerBody");
      if (!body) {
        return;
      }

      var active = entries.filter(function (entry) {
        return entry.active && entry.serviceActive;
      });
      var groups = groupByCategory(active);

      renderPickerCategoryList(body, groups, active, selectedEntryId, onSelect);
    }).catch(function (error) {
      var body = ui.byId("servicePickerBody");
      if (body) {
        body.innerHTML = '<div class="alert">Impossible de charger les prestations, réessayez.</div>';
      }
      window.console && window.console.error && window.console.error(error);
    });
  }

  // ---- Espace administrateur : gerer les prestations de chaque
  // collaboratrice (prix, duree, categorie, active/inactive). ----

  var adminState = { collaborators: [], selectedCollaboratorId: "" };

  function renderAdminServicesSection(containerId) {
    var container = ui.byId(containerId);
    if (!container) {
      return;
    }

    container.innerHTML = '<p class="tiny">Chargement des prestations...</p>';

    supabaseData.listProfiles().then(function (profiles) {
      adminState.collaborators = profiles.filter(function (item) { return item.active !== false; });

      if (!adminState.selectedCollaboratorId ||
        !utils.findById(adminState.collaborators, adminState.selectedCollaboratorId)) {
        adminState.selectedCollaboratorId = adminState.collaborators.length ? adminState.collaborators[0].id : "";
      }

      return renderAdminServicesBody(containerId);
    }).catch(function (error) {
      container.innerHTML = '<div class="alert">Impossible de charger les comptes.</div>';
      window.console && window.console.error && window.console.error(error);
    });
  }

  function renderAdminServicesBody(containerId) {
    var container = ui.byId(containerId);
    if (!container || !adminState.selectedCollaboratorId) {
      if (container) {
        container.innerHTML = '<p class="tiny">Aucune collaboratrice active.</p>';
      }
      return Promise.resolve();
    }

    return Promise.all([
      loadCatalog(true),
      loadCollaboratorEntries(adminState.selectedCollaboratorId)
    ]).then(function (results) {
      var catalog = results[0];
      var entries = results[1];
      var entryByServiceId = {};
      entries.forEach(function (entry) { entryByServiceId[entry.serviceId] = entry; });

      var categoryGroups = catalog.categories
        .slice()
        .sort(function (a, b) { return a.displayOrder - b.displayOrder; })
        .map(function (category) {
          var services = catalog.services
            .filter(function (service) { return service.categoryId === category.id; })
            .sort(function (a, b) { return a.displayOrder - b.displayOrder; });
          return { category: category, services: services };
        })
        .filter(function (group) { return group.services.length > 0; });

      container.innerHTML = renderAdminServicesHtml(categoryGroups);
      bindAdminServicesActions(containerId, catalog, entryByServiceId, categoryGroups);
    }).catch(function (error) {
      container.innerHTML = '<div class="alert">Impossible de charger les prestations, réessayez.</div>';
      window.console && window.console.error && window.console.error(error);
    });
  }

  // Chaque categorie est un bouton "menu burger" (☰) qui ouvre une feuille
  // avec ses prestations - meme principe que le bouton "☰ Filtres" du
  // planning (js/pages/planning.js).
  function renderAdminServicesHtml(categoryGroups) {
    var collabOptions = adminState.collaborators.map(function (collab) {
      var selected = collab.id === adminState.selectedCollaboratorId ? " selected" : "";
      return '<option value="' + collab.id + '"' + selected + ">" +
        utils.escapeHtml(collab.name) + "</option>";
    }).join("");

    var categoriesHtml = categoryGroups.length
      ? '<div class="service-category-menu">' + categoryGroups.map(function (group, index) {
          return '<button class="secondary service-category-burger" type="button" data-open-category="' + index + '">' +
            "<span>☰ " + utils.escapeHtml(group.category.name) + "</span>" +
            '<span class="tiny">(' + group.services.length + ")</span>" +
            "</button>";
        }).join("") + "</div>"
      : '<p class="tiny">Aucune prestation dans le catalogue pour le moment.</p>';

    return [
      '<label for="servicesCollabSelect">Collaboratrice</label>',
      '<select id="servicesCollabSelect" class="field">' + collabOptions + "</select>",
      '<button id="addCatalogServiceButton" class="secondary" style="width:100%;margin:10px 0" type="button">+ Nouvelle prestation au catalogue</button>',
      '<div id="adminServiceMsg"></div>',
      categoriesHtml
    ].join("");
  }

  function openAdminCategorySheet(group, catalog, entryByServiceId, containerId) {
    ui.showSheet([
      '<div class="modal-head">',
      "  <h3>" + utils.escapeHtml(group.category.name) + "</h3>",
      '  <button id="closeCategorySheetButton" class="x" type="button">x</button>',
      "</div>",
      '<div class="service-category-list">' +
        group.services.map(function (service) {
          return renderAdminServiceRow(service, entryByServiceId[service.id]);
        }).join("") +
      "</div>"
    ].join(""));

    ui.byId("closeCategorySheetButton").addEventListener("click", ui.closeSheet);

    ui.byId("sheetBox").querySelectorAll("[data-manage-service]").forEach(function (button) {
      button.addEventListener("click", function () {
        var service = utils.findById(catalog.services, button.dataset.manageService);
        var entry = entryByServiceId[button.dataset.manageService] || null;
        if (service) {
          ui.closeSheet();
          openCollaboratorServiceForm(service, entry, containerId);
        }
      });
    });

    ui.byId("sheetBox").querySelectorAll("[data-delete-service]").forEach(function (button) {
      button.addEventListener("click", function () {
        var service = utils.findById(catalog.services, button.dataset.deleteService);
        if (service) {
          confirmDeleteCatalogService(service, containerId);
        }
      });
    });
  }

  // Retire une prestation du catalogue general (toutes collaboratrices
  // confondues) - pas seulement le tarif d'une collaboratrice (voir
  // confirmDeleteCollaboratorService plus bas pour ce cas). Si elle est
  // deja utilisee (au moins une collaboratrice l'a tarifee, ou au moins un
  // rendez-vous y fait reference), on la desactive au lieu de la
  // supprimer, pour ne jamais casser l'historique des anciens rendez-vous.
  function confirmDeleteCatalogService(service, containerId) {
    supabaseData.countServiceUsage(service.id).then(function (usage) {
      var totalUsage = usage.collaboratorServices + usage.reservations;

      if (totalUsage > 0) {
        if (!window.confirm(
          "Cette prestation est utilisee par " + usage.collaboratorServices +
          " collaboratrice(s) et " + usage.reservations + " rendez-vous. " +
          "Impossible de la supprimer sans casser leur historique : voulez-vous la retirer du catalogue (elle disparaitra du menu de tout le monde) a la place ?"
        )) {
          return;
        }

        return supabaseData.upsertService({
          id: service.id,
          categoryId: service.categoryId,
          name: service.name,
          active: false,
          displayOrder: service.displayOrder
        }).then(function () {
          catalogCache = null;
          ui.closeSheet();
          renderAdminServicesBody(containerId);
        });
      }

      if (!window.confirm("Supprimer definitivement cette prestation du catalogue ?")) {
        return;
      }

      return supabaseData.deleteService(service.id).then(function () {
        catalogCache = null;
        ui.closeSheet();
        renderAdminServicesBody(containerId);
      });
    }).catch(function (error) {
      window.alert("Impossible de vérifier l'utilisation de cette prestation, réessayez.");
      window.console && window.console.error && window.console.error(error);
    });
  }

  function renderAdminServiceRow(service, entry) {
    var isAssigned = !!entry;
    var badges = [];

    if (isAssigned) {
      badges.push('<span class="badge">' + entry.price + " EUR</span>");
      badges.push('<span class="badge">' + entry.duration + " min</span>");
      badges.push(entry.active === false
        ? '<span class="badge status-cancel">Inactive</span>'
        : '<span class="badge status-done">Active</span>');
    }

    return [
      '<div class="service-admin-row">',
      '  <div class="grow">',
      "    <b>" + utils.escapeHtml(service.name) + "</b>",
      service.active === false ? '<div class="tiny">Prestation retiree du catalogue</div>' : "",
      '    <div class="row" style="margin-top:4px;flex-wrap:wrap;gap:6px">' + badges.join("") + "</div>",
      "  </div>",
      '  <div class="row" style="gap:6px">',
      '    <button class="secondary" type="button" data-manage-service="' + service.id + '">' +
        (isAssigned ? "Modifier" : "Ajouter") + "</button>",
      '    <button class="secondary danger" type="button" data-delete-service="' + service.id + '">Supprimer</button>',
      "  </div>",
      "</div>"
    ].join("");
  }

  function bindAdminServicesActions(containerId, catalog, entryByServiceId, categoryGroups) {
    ui.byId("servicesCollabSelect").addEventListener("change", function (event) {
      adminState.selectedCollaboratorId = event.target.value;
      renderAdminServicesBody(containerId);
    });

    ui.byId("addCatalogServiceButton").addEventListener("click", function () {
      openCatalogServiceForm(catalog, containerId);
    });

    document.querySelectorAll("[data-open-category]").forEach(function (button) {
      button.addEventListener("click", function () {
        var group = categoryGroups[Number(button.dataset.openCategory)];
        openAdminCategorySheet(group, catalog, entryByServiceId, containerId);
      });
    });
  }

  // Ajoute une prestation totalement nouvelle au catalogue general
  // (visible ensuite pour toutes les collaboratrices, chacune devant
  // encore lui definir son propre prix/sa propre duree).
  function openCatalogServiceForm(catalog, containerId) {
    var categoryOptions = catalog.categories
      .slice()
      .sort(function (a, b) { return a.displayOrder - b.displayOrder; })
      .map(function (category) {
        return '<option value="' + category.id + '">' + utils.escapeHtml(category.name) + "</option>";
      }).join("");

    ui.showModal([
      '<div class="modal-head">',
      "  <h3>Nouvelle prestation</h3>",
      '  <button id="closeCatalogServiceModal" class="x" type="button">x</button>',
      "</div>",
      '<div id="catalogServiceMsg"></div>',
      '<label for="csName">Nom de la prestation</label><input id="csName" class="field" placeholder="Ex. Pose gel">',
      '<label for="csCategory">Catégorie</label><select id="csCategory" class="field">' + categoryOptions + "</select>",
      '<div class="row" style="margin-top:14px">',
      '  <button id="saveCatalogServiceButton" class="primary grow" type="button">Ajouter au catalogue</button>',
      "</div>"
    ].join(""));

    ui.byId("closeCatalogServiceModal").addEventListener("click", ui.closeModal);
    ui.byId("saveCatalogServiceButton").addEventListener("click", function () {
      var name = ui.byId("csName").value.trim();
      var categoryId = ui.byId("csCategory").value;

      if (!name) {
        ui.showAlert("catalogServiceMsg", "Le nom est obligatoire.");
        return;
      }

      var duplicate = catalog.services.some(function (service) {
        return service.categoryId === categoryId && service.name.toLowerCase() === name.toLowerCase();
      });

      if (duplicate) {
        ui.showAlert("catalogServiceMsg", "Cette prestation existe déjà dans cette catégorie.");
        return;
      }

      supabaseData.upsertService({ categoryId: categoryId, name: name }).then(function (service) {
        catalogCache = null;
        ui.closeModal();
        return renderAdminServicesBody(containerId).then(function () {
          return loadCatalog().then(function (freshCatalog) {
            openCollaboratorServiceForm(service, null, containerId, freshCatalog);
          });
        });
      }).catch(function (error) {
        ui.showAlert("catalogServiceMsg", "Impossible d'ajouter cette prestation, réessayez.");
        window.console && window.console.error && window.console.error(error);
      });
    });
  }

  // Definit (ou modifie) le prix/la duree d'UNE collaboratrice pour UN
  // service du catalogue. C'est ici, et seulement ici, que le tarif est
  // propre a chaque collaboratrice.
  function openCollaboratorServiceForm(service, entry, containerId) {
    var collaborator = utils.findById(adminState.collaborators, adminState.selectedCollaboratorId);
    var isEdit = !!entry;

    ui.showModal([
      '<div class="modal-head">',
      "  <h3>" + utils.escapeHtml(service.name) + "</h3>",
      '  <button id="closeServiceEntryModal" class="x" type="button">x</button>',
      "</div>",
      '<p class="tiny">Pour ' + utils.escapeHtml(collaborator ? collaborator.name : "") + "</p>",
      '<div id="serviceEntryMsg"></div>',
      '<div class="grid2">',
      '  <div><label for="sePrice">Prix (EUR)</label><input id="sePrice" class="field" type="number" min="0" step="0.5" value="' +
        (entry ? entry.price : "") + '"></div>',
      '  <div><label for="seDuration">Duree (min)</label><input id="seDuration" class="field" type="number" min="5" step="5" value="' +
        (entry ? entry.duration : "") + '"></div>',
      "</div>",
      '<label class="checkbox-line"><input id="seActive" type="checkbox"' +
        (!entry || entry.active !== false ? " checked" : "") + "> Prestation active pour cette collaboratrice</label>",
      '<div class="row" style="margin-top:14px">',
      '  <button id="saveServiceEntryButton" class="primary grow" type="button">Enregistrer</button>',
      (isEdit ? '  <button id="deleteServiceEntryButton" class="secondary danger" type="button">Retirer</button>' : ""),
      "</div>"
    ].join(""));

    ui.byId("closeServiceEntryModal").addEventListener("click", ui.closeModal);

    ui.byId("saveServiceEntryButton").addEventListener("click", function () {
      var price = Number(ui.byId("sePrice").value);
      var duration = Number(ui.byId("seDuration").value);

      if (!(price >= 0)) {
        ui.showAlert("serviceEntryMsg", "Le prix ne peut pas être négatif.");
        return;
      }

      if (!duration || duration <= 0) {
        ui.showAlert("serviceEntryMsg", "La durée doit être supérieure à 0.");
        return;
      }

      supabaseData.upsertCollaboratorService({
        id: entry ? entry.id : undefined,
        collaboratorId: adminState.selectedCollaboratorId,
        serviceId: service.id,
        price: price,
        duration: duration,
        active: ui.byId("seActive").checked
      }).then(function () {
        ui.closeModal();
        renderAdminServicesBody(containerId);
      }).catch(function (error) {
        ui.showAlert("serviceEntryMsg", "Impossible d'enregistrer, réessayez.");
        window.console && window.console.error && window.console.error(error);
      });
    });

    var deleteButton = ui.byId("deleteServiceEntryButton");
    if (deleteButton) {
      deleteButton.addEventListener("click", function () {
        confirmDeleteCollaboratorService(entry, containerId);
      });
    }
  }

  // Une prestation deja utilisee dans au moins un rendez-vous (passe ou a
  // venir) ne doit jamais etre supprimee : les anciens rendez-vous doivent
  // pouvoir continuer a l'afficher. On la desactive a la place.
  function confirmDeleteCollaboratorService(entry, containerId) {
    supabaseData.countReservationsForService(adminState.selectedCollaboratorId, entry.serviceId).then(function (count) {
      if (count > 0) {
        if (!window.confirm(
          "Cette prestation a déjà " + count + " rendez-vous enregistré(s). " +
          "Impossible de la supprimer sans casser leur historique : voulez-vous la desactiver a la place ?"
        )) {
          return;
        }

        return supabaseData.upsertCollaboratorService({
          id: entry.id,
          collaboratorId: adminState.selectedCollaboratorId,
          serviceId: entry.serviceId,
          price: entry.price,
          duration: entry.duration,
          active: false
        }).then(function () {
          ui.closeModal();
          renderAdminServicesBody(containerId);
        });
      }

      if (!window.confirm("Retirer definitivement cette prestation pour cette collaboratrice ?")) {
        return;
      }

      return supabaseData.deleteCollaboratorService(entry.id).then(function () {
        ui.closeModal();
        renderAdminServicesBody(containerId);
      });
    }).catch(function (error) {
      ui.showAlert("serviceEntryMsg", "Impossible de vérifier l'historique, réessayez.");
      window.console && window.console.error && window.console.error(error);
    });
  }

  // ---- Vue collaboratrice (lecture seule) : ses propres prestations,
  // regroupees par categorie, avec son tarif et sa duree a elle. ----

  function renderMyServiceRow(item) {
    return [
      '<div class="service-admin-row">',
      '  <div class="grow">',
      "    <b>" + utils.escapeHtml(item.name) + "</b>",
      '    <div class="row" style="margin-top:4px;flex-wrap:wrap;gap:6px">',
      '      <span class="badge">' + item.price + " EUR</span>",
      '      <span class="badge">' + item.duration + " min</span>",
      item.active === false ? '<span class="badge status-cancel">Inactive</span>' : "",
      "    </div>",
      "  </div>",
      "</div>"
    ].join("");
  }

  function openMyCategorySheet(group) {
    ui.showSheet([
      '<div class="modal-head">',
      "  <h3>" + utils.escapeHtml(group.name) + "</h3>",
      '  <button id="closeMyCategorySheetButton" class="x" type="button">x</button>',
      "</div>",
      '<div class="service-category-list">' +
        group.items.map(renderMyServiceRow).join("") +
      "</div>"
    ].join(""));

    ui.byId("closeMyCategorySheetButton").addEventListener("click", ui.closeSheet);
  }

  // Meme menu burger que l'ecran admin, en lecture seule (chaque
  // categorie ouvre une feuille avec ses prestations).
  function renderMyServicesSection(containerId, user) {
    var container = ui.byId(containerId);
    if (!container) {
      return;
    }

    container.innerHTML = '<p class="tiny">Chargement de mes prestations...</p>';

    loadCollaboratorEntries(user.id).then(function (entries) {
      var groups = groupByCategory(entries);

      if (!groups.length) {
        container.innerHTML = '<p class="tiny">Aucune prestation ne vous a encore ete attribuee. Contactez l administrateur.</p>';
        return;
      }

      container.innerHTML = '<div class="service-category-menu">' + groups.map(function (group, index) {
        return '<button class="secondary service-category-burger" type="button" data-open-my-category="' + index + '">' +
          "<span>☰ " + utils.escapeHtml(group.name) + "</span>" +
          '<span class="tiny">(' + group.items.length + ")</span>" +
          "</button>";
      }).join("") + "</div>";

      container.querySelectorAll("[data-open-my-category]").forEach(function (button) {
        button.addEventListener("click", function () {
          openMyCategorySheet(groups[Number(button.dataset.openMyCategory)]);
        });
      });
    }).catch(function (error) {
      container.innerHTML = '<div class="alert">Impossible de charger vos prestations, réessayez.</div>';
      window.console && window.console.error && window.console.error(error);
    });
  }

  function renderServicesSection(containerId, user) {
    if (auth.isAdmin(user)) {
      renderAdminServicesSection(containerId);
    } else {
      renderMyServicesSection(containerId, user);
    }
  }

  window.SalonServiceForms = {
    groupByCategory: groupByCategory,
    loadCatalog: loadCatalog,
    loadCollaboratorEntries: loadCollaboratorEntries,
    openServicePickerSheet: openServicePickerSheet,
    renderServicesSection: renderServicesSection
  };
}());
