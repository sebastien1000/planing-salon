(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var formState = window.SalonFormState;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  function canManageAccount(userId) {
    var state = formState.state;
    return auth.isAdmin(state.user) || userId === state.user.id;
  }

  function countAdmins(users) {
    return users.filter(function (item) {
      return item.role === "admin";
    }).length;
  }

  function buildRoleOptionsHtml(selectedRole) {
    return [
      '<option value="collab"' + (selectedRole === "collab" ? " selected" : "") + ">Collaborateur</option>",
      '<option value="admin"' + (selectedRole === "admin" ? " selected" : "") + ">Administrateur</option>"
    ].join("");
  }

  function buildCheckboxGroup(namePrefix, options, selectedValues) {
    var dataAttr = "data-" + namePrefix.toLowerCase() + "-option";
    var list = selectedValues || [];

    return options.map(function (option, index) {
      var checked = !list.length || list.indexOf(option) !== -1;
      var id = namePrefix + index;
      return [
        '<label class="checkbox-line" for="' + id + '">',
        '  <input id="' + id + '" type="checkbox" ' + dataAttr + ' value="' +
          utils.escapeHtml(option) + '"' + (checked ? " checked" : "") + '>',
        "  " + utils.escapeHtml(option),
        "</label>"
      ].join("");
    }).join("");
  }

  function readCheckedValues(namePrefix) {
    var dataAttr = "data-" + namePrefix.toLowerCase() + "-option";
    var boxes = Array.prototype.slice.call(document.querySelectorAll("[" + dataAttr + "]"));
    return boxes.filter(function (box) { return box.checked; }).map(function (box) { return box.value; });
  }

  function buildAccountExtraFieldsHtml(user, lockRole) {
    var state = formState.state;
    var prestationNames = state.db.prestations.map(function (item) { return item.name; });
    var roleFieldHtml = lockRole
      ? '<label for="uRole">Role</label><input id="uRole" class="field" value="' +
        (user.role === "admin" ? "Administrateur" : "Collaborateur") + '" readonly data-locked-role="' + user.role + '">'
      : '<label for="uRole">Role</label><select id="uRole" class="field">' + buildRoleOptionsHtml(user.role) + "</select>";

    return [
      roleFieldHtml,
      '<label for="uColor">Couleur d affichage dans le planning</label>',
      '<input id="uColor" class="field" type="color" value="' + (user.color || "#e8a7b6") + '">',
      '<label>Salles autorisees (tout coche = aucune restriction, tout decoche = aucun acces)</label>',
      '<div class="checkbox-group">' + buildCheckboxGroup("uRoom", data.ROOMS, user.rooms) + "</div>",
      '<label>Prestations autorisees (tout coche = aucune restriction, tout decoche = aucun acces)</label>',
      '<div class="checkbox-group">' + buildCheckboxGroup("uPrestation", prestationNames, user.prestations) + "</div>"
    ].join("");
  }

  function openProfileForm(userId) {
    var state = formState.state;
    var user = utils.findById(state.db.users, userId);

    if (!canManageAccount(userId)) {
      window.alert("Vous ne pouvez pas modifier ce compte.");
      return;
    }

    var isAdminEditing = auth.isAdmin(state.user);

    ui.showModal([
      '<div class="modal-head">',
      "  <h3>Profil</h3>",
      '  <button id="closeProfileModal" class="x" type="button">x</button>',
      "</div>",
      '<div id="profileMsg"></div>',
      '<label for="uName">Nom affiche</label><input id="uName" class="field" value="' + utils.escapeHtml(user.name) + '">',
      '<label for="uPass">Nouveau mot de passe</label><input id="uPass" class="field" type="password" placeholder="Laisser vide pour ne pas changer">',
      isAdminEditing ? buildAccountExtraFieldsHtml(user, userId === state.user.id) : "",
      '<div class="row" style="margin-top:14px">',
      '  <button id="saveProfileButton" class="primary grow" type="button">Enregistrer</button>',
      (isAdminEditing && userId !== state.user.id)
        ? '  <button id="deleteAccountButton" class="secondary danger" type="button">Supprimer</button>'
        : "",
      "</div>"
    ].join(""));

    ui.byId("closeProfileModal").addEventListener("click", ui.closeModal);
    ui.byId("saveProfileButton").addEventListener("click", function () {
      saveProfile(userId);
    });

    var deleteButton = ui.byId("deleteAccountButton");
    if (deleteButton) {
      deleteButton.addEventListener("click", function () {
        deleteAccount(userId);
      });
    }
  }

  function saveProfile(userId) {
    var state = formState.state;
    var user = utils.findById(state.db.users, userId);

    if (!canManageAccount(userId)) {
      window.alert("Vous ne pouvez pas modifier ce compte.");
      return;
    }

    var oldName = user.name;
    var newName = ui.byId("uName").value.trim() || user.name;
    var password = ui.byId("uPass").value;

    user.name = newName;
    if (password) {
      user.password = password;
    }

    var roleField = ui.byId("uRole");
    if (auth.isAdmin(state.user) && roleField) {
      if (roleField.tagName === "SELECT") {
        var newRole = roleField.value;
        if (user.role === "admin" && newRole !== "admin" && countAdmins(state.db.users) <= 1) {
          ui.byId("profileMsg").innerHTML = '<div class="alert">Impossible : il doit rester au moins un administrateur.</div>';
          return;
        }

        user.role = newRole;
      }

      user.color = ui.byId("uColor").value;
      user.rooms = readCheckedValues("uRoom");
      user.prestations = readCheckedValues("uPrestation");
    }

    if (oldName !== newName) {
      domain.renameCollaborator(state.db, oldName, newName);
    }

    ui.closeModal();
    formState.saveAndRefresh();
  }

  function openAddAccountForm() {
    var state = formState.state;

    if (!auth.isAdmin(state.user)) {
      window.alert("Seul l'administrateur peut ajouter un collaborateur.");
      return;
    }

    var blankUser = { color: "#e8a7b6", prestations: [], role: "collab", rooms: [] };

    ui.showModal([
      '<div class="modal-head">',
      "  <h3>Ajouter un collaborateur</h3>",
      '  <button id="closeAddAccountModal" class="x" type="button">x</button>',
      "</div>",
      '<div id="addAccountMsg"></div>',
      '<label for="naName">Nom affiche</label><input id="naName" class="field" placeholder="Ex : Lea">',
      '<label for="naLogin">Identifiant de connexion</label><input id="naLogin" class="field" placeholder="Ex : Lea">',
      '<label for="naPass">Mot de passe</label><input id="naPass" class="field" type="password" placeholder="Laisser vide pour demo">',
      buildAccountExtraFieldsHtml(blankUser),
      '<button id="saveAddAccountButton" class="primary" style="width:100%;margin-top:14px" type="button">Ajouter</button>'
    ].join(""));

    ui.byId("closeAddAccountModal").addEventListener("click", ui.closeModal);
    ui.byId("saveAddAccountButton").addEventListener("click", saveNewAccount);
  }

  function saveNewAccount() {
    var state = formState.state;

    if (!auth.isAdmin(state.user)) {
      window.alert("Seul l'administrateur peut ajouter un collaborateur.");
      return;
    }

    var name = ui.byId("naName").value.trim();
    var login = ui.byId("naLogin").value.trim();
    var password = ui.byId("naPass").value.trim() || "demo";

    if (!name || !login) {
      ui.byId("addAccountMsg").innerHTML = '<div class="alert">Le nom et l identifiant sont obligatoires.</div>';
      return;
    }

    var duplicate = state.db.users.some(function (item) {
      return item.login.toLowerCase() === login.toLowerCase();
    });

    if (duplicate) {
      ui.byId("addAccountMsg").innerHTML = '<div class="alert">Cet identifiant existe deja.</div>';
      return;
    }

    state.db.users.push({
      id: utils.uid("u"),
      login: login,
      name: name,
      role: ui.byId("uRole").value,
      password: password,
      color: ui.byId("uColor").value,
      rooms: readCheckedValues("uRoom"),
      prestations: readCheckedValues("uPrestation")
    });

    ui.closeModal();
    formState.saveAndRefresh();
  }

  function deleteAccount(userId) {
    var state = formState.state;

    if (!auth.isAdmin(state.user)) {
      window.alert("Seul l'administrateur peut supprimer un compte.");
      return;
    }

    if (userId === state.user.id) {
      window.alert("Vous ne pouvez pas supprimer votre propre compte.");
      return;
    }

    var user = utils.findById(state.db.users, userId);
    if (!user) {
      return;
    }

    if (user.role === "admin" && countAdmins(state.db.users) <= 1) {
      window.alert("Impossible : il doit rester au moins un administrateur.");
      return;
    }

    var today = utils.today();
    var hasUpcoming = state.db.reservations.some(function (reservation) {
      return reservation.collab === user.name &&
        reservation.date >= today &&
        !domain.isCancelled(reservation);
    });

    if (hasUpcoming) {
      window.alert("Impossible de supprimer : ce compte a des rendez-vous a venir. Annulez ou reassignez-les d abord.");
      return;
    }

    if (!window.confirm("Supprimer ce compte ?")) {
      return;
    }

    state.db.users = state.db.users.filter(function (item) {
      return item.id !== userId;
    });

    ui.closeModal();
    formState.saveAndRefresh();
  }

  function resetPassword(userId) {
    var state = formState.state;
    var user = utils.findById(state.db.users, userId);

    if (!auth.isAdmin(state.user)) {
      window.alert("Seul l'administrateur peut reinitialiser un mot de passe.");
      return;
    }

    if (!window.confirm("Reinitialiser le mot de passe ?")) {
      return;
    }

    user.password = "demo";
    data.saveDb(state.db);
    window.alert("Mot de passe remis a demo.");
  }

  function resetLink(userId) {
    var state = formState.state;

    if (!auth.isAdmin(state.user)) {
      window.alert("Seul l'administrateur peut generer un lien de reinitialisation.");
      return;
    }

    var user = utils.findById(state.db.users, userId);
    window.alert("Lien de reinitialisation : salon-reset://" + user.login + "-" + utils.uid());
  }

  window.SalonAccountForms = {
    deleteAccount: deleteAccount,
    openAddAccountForm: openAddAccountForm,
    openProfileForm: openProfileForm,
    resetLink: resetLink,
    resetPassword: resetPassword
  };
}());
