(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var formState = window.SalonFormState;
  var supabaseData = window.SalonSupabaseData;
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
    var checked = boxes.filter(function (box) { return box.checked; }).map(function (box) { return box.value; });
    return checked.length === boxes.length ? null : checked;
  }

  var PHOTO_MAX_SIZE = 200;
  var pendingPhoto; // undefined = no change, null = removed, "data:..." = new photo

  function resizeImageToDataUrl(file, maxSize, onDone, onError) {
    var reader = new FileReader();

    reader.onerror = function () {
      onError("Impossible de lire ce fichier.");
    };

    reader.onload = function () {
      var img = new Image();

      img.onerror = function () {
        onError("Ce fichier n est pas une image valide.");
      };

      img.onload = function () {
        var scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        var canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale) || 1;
        canvas.height = Math.round(img.height * scale) || 1;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        onDone(canvas.toDataURL("image/jpeg", 0.85));
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  }

  function buildPhotoPreviewHtml(photoSrc) {
    return photoSrc
      ? '<img id="uPhotoPreview" src="' + photoSrc + '" alt="" style="width:56px;height:56px;border-radius:50%;object-fit:cover">'
      : '<div id="uPhotoPreview" style="width:56px;height:56px;border-radius:50%;background:#f4dbe3"></div>';
  }

  function buildPhotoFieldHtml(user) {
    return [
      '<label for="uPhotoInput">Photo de profil</label>',
      '<div id="photoMsg"></div>',
      '<div class="row" style="align-items:center;gap:12px;margin-bottom:14px">',
      buildPhotoPreviewHtml(user.photo),
      '  <input id="uPhotoInput" class="field grow" style="margin-bottom:0" type="file" accept="image/*">',
      '  <button id="removePhotoButton" class="secondary danger" type="button"' +
        (user.photo ? "" : " disabled") + '>Retirer</button>',
      "</div>"
    ].join("");
  }

  function bindPhotoField() {
    var input = ui.byId("uPhotoInput");
    var removeButton = ui.byId("removePhotoButton");

    if (!input) {
      return;
    }

    input.addEventListener("change", function () {
      var file = input.files[0];
      if (!file) {
        return;
      }

      resizeImageToDataUrl(file, PHOTO_MAX_SIZE, function (dataUrl) {
        pendingPhoto = dataUrl;
        ui.byId("uPhotoPreview").outerHTML = buildPhotoPreviewHtml(dataUrl);
        removeButton.disabled = false;
      }, function (message) {
        ui.showAlert("photoMsg", message);
      });
    });

    removeButton.addEventListener("click", function () {
      pendingPhoto = null;
      ui.byId("uPhotoPreview").outerHTML = buildPhotoPreviewHtml(null);
      removeButton.disabled = true;
    });
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
    var isSelf = userId === state.user.id;
    pendingPhoto = undefined;

    ui.showModal([
      '<div class="modal-head">',
      "  <h3>Profil</h3>",
      '  <button id="closeProfileModal" class="x" type="button">x</button>',
      "</div>",
      '<div id="profileMsg"></div>',
      (user.active === false ? '<div class="alert">Ce compte est desactive.</div>' : ""),
      buildPhotoFieldHtml(user),
      '<label for="uName">Nom affiche</label><input id="uName" class="field" value="' + utils.escapeHtml(user.name) + '">',
      '<label for="uPhone">Telephone</label><input id="uPhone" class="field" type="tel" value="' + utils.escapeHtml(user.phone || "") + '">',
      '<label for="uEmail">Email</label><input id="uEmail" class="field" type="email" value="' + utils.escapeHtml(user.email || "") + '">',
      '<button id="sendResetButton" class="secondary" style="width:100%;margin-bottom:14px" type="button">Envoyer un lien de reinitialisation</button>',
      isAdminEditing ? buildAccountExtraFieldsHtml(user, isSelf) : "",
      '<div class="row" style="margin-top:14px">',
      '  <button id="saveProfileButton" class="primary grow" type="button">Enregistrer</button>',
      (isAdminEditing && !isSelf)
        ? '  <button id="toggleActiveButton" class="secondary" type="button">' +
          (user.active === false ? "Reactiver" : "Desactiver") + "</button>"
        : "",
      (isAdminEditing && !isSelf)
        ? '  <button id="deleteAccountButton" class="secondary danger" type="button">Supprimer</button>'
        : "",
      "</div>"
    ].join(""));

    bindPhotoField();

    ui.byId("closeProfileModal").addEventListener("click", ui.closeModal);
    ui.byId("saveProfileButton").addEventListener("click", function () {
      saveProfile(userId);
    });
    ui.byId("sendResetButton").addEventListener("click", function () {
      sendPasswordReset(userId);
    });

    var deleteButton = ui.byId("deleteAccountButton");
    if (deleteButton) {
      deleteButton.addEventListener("click", function () {
        deleteAccount(userId);
      });
    }

    var toggleActiveButton = ui.byId("toggleActiveButton");
    if (toggleActiveButton) {
      toggleActiveButton.addEventListener("click", function () {
        toggleAccountActive(userId);
      });
    }
  }

  // Pousse tout de suite le nouveau role vers la ligne "profiles" Supabase
  // (la seule que PostgreSQL regarde pour les droits RLS), au lieu d'attendre
  // la prochaine connexion de la personne. is_admin() est reevalue a chaque
  // requete a partir de cette table, donc des que l'upsert reussit, les
  // droits reels changent immediatement, sans deconnexion necessaire.
  // Si la personne ne s'est jamais connectee a Supabase, sa ligne "profiles"
  // n'existe pas encore : impossible de la mettre a jour maintenant, on le
  // dit clairement plutot que de laisser croire que c'est deja applique.
  // Synchronise role/active vers Supabase "profiles", qui fait foi pour la
  // connexion (voir auth.js login()). Sans cet appel, un changement de role
  // ou une desactivation ne resterait que local et n'empecherait pas la
  // vraie connexion Supabase de la personne concernee.
  function syncAccountToSupabase(user, changeLabel) {
    if (!supabaseData) {
      window.alert(
        changeLabel + " change localement, mais Supabase n'est pas configure : impossible de synchroniser les droits reels."
      );
      return;
    }

    if (!user.email) {
      window.alert(
        changeLabel + " change localement. " + user.name + " n'a pas d'email enregistre : " +
        "impossible de synchroniser les droits reels tant qu'un email n'est pas ajoute a sa fiche."
      );
      return;
    }

    supabaseData.listProfiles().then(function (profiles) {
      var normalizedEmail = String(user.email).trim().toLowerCase();
      var match = profiles.find(function (item) {
        return String(item.email || "").trim().toLowerCase() === normalizedEmail;
      });

      if (!match) {
        window.alert(
          changeLabel + " change localement. " + user.name + " ne s'est jamais connecte a Supabase : " +
          "le changement sera applique automatiquement a sa prochaine connexion, pas avant."
        );
        return;
      }

      return supabaseData.upsertProfile({
        id: match.id,
        email: user.email,
        name: user.name,
        role: user.role,
        active: user.active !== false
      }).then(function () {
        window.alert(changeLabel + " mis a jour : les droits reels de " + user.name + " ont change immediatement, sans reconnexion.");
      });
    }).catch(function (error) {
      window.alert(
        changeLabel + " a ete change localement mais la synchronisation avec Supabase a echoue : " +
        user.name + " garde ses anciens droits reels tant que ce n'est pas corrige. Reessayez."
      );
      window.console && window.console.error && window.console.error(error);
    });
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

    user.name = newName;
    user.phone = ui.byId("uPhone").value.trim();
    user.email = ui.byId("uEmail").value.trim();
    if (pendingPhoto !== undefined) {
      user.photo = pendingPhoto;
    }

    var roleChanged = false;
    var roleField = ui.byId("uRole");
    if (auth.isAdmin(state.user) && roleField) {
      if (roleField.tagName === "SELECT") {
        var newRole = roleField.value;
        if (user.role === "admin" && newRole !== "admin" && countAdmins(state.db.users) <= 1) {
          ui.showAlert("profileMsg", "Impossible : il doit rester au moins un administrateur.");
          return;
        }

        roleChanged = newRole !== user.role;
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

    if (roleChanged) {
      syncAccountToSupabase(user, "Role");
    }
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
      '<label for="naPhone">Telephone (facultatif)</label><input id="naPhone" class="field">',
      '<label for="naEmail">Email</label><input id="naEmail" class="field" type="email" placeholder="obligatoire pour la connexion">',
      '<p class="tiny">Le mot de passe n est plus defini ici : creez le compte correspondant dans Supabase avec le meme email, ' +
        'puis utilisez "Envoyer un lien de reinitialisation" pour que la personne choisisse son mot de passe.</p>',
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
    var email = ui.byId("naEmail").value.trim();

    if (!name || !login || !email) {
      ui.showAlert("addAccountMsg", "Le nom, l identifiant et l email sont obligatoires.");
      return;
    }

    var duplicate = state.db.users.some(function (item) {
      return item.login.toLowerCase() === login.toLowerCase();
    });

    if (duplicate) {
      ui.showAlert("addAccountMsg", "Cet identifiant existe deja.");
      return;
    }

    state.db.users.push({
      id: utils.uid("u"),
      login: login,
      name: name,
      role: ui.byId("uRole").value,
      color: ui.byId("uColor").value,
      rooms: readCheckedValues("uRoom"),
      prestations: readCheckedValues("uPrestation"),
      phone: ui.byId("naPhone").value.trim(),
      email: email,
      photo: null,
      active: true
    });

    ui.closeModal();
    formState.saveAndRefresh();
  }

  function toggleAccountActive(userId) {
    var state = formState.state;

    if (!auth.isAdmin(state.user)) {
      window.alert("Seul l'administrateur peut activer ou desactiver un compte.");
      return;
    }

    if (userId === state.user.id) {
      window.alert("Vous ne pouvez pas desactiver votre propre compte.");
      return;
    }

    var user = utils.findById(state.db.users, userId);
    if (!user) {
      return;
    }

    var activeAdmins = state.db.users.filter(function (item) {
      return item.role === "admin" && item.active !== false;
    });

    if (user.role === "admin" && user.active !== false && activeAdmins.length <= 1) {
      window.alert("Impossible : il doit rester au moins un administrateur actif.");
      return;
    }

    user.active = user.active === false;

    ui.closeModal();
    formState.saveAndRefresh();
    syncAccountToSupabase(user, "Statut du compte");
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
    var hasUpcoming = (state.reservations || []).some(function (reservation) {
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

    // Supabase n'autorise aucune policy "delete" sur profiles (voisement
    // volontaire, pour ne pas casser l'historique des reservations/clients
    // lies a ce collab_id) : on desactive le profil distant au lieu de le
    // supprimer, sinon le compte resterait actif et utilisable pour se
    // connecter malgre sa suppression locale.
    user.active = false;
    syncAccountToSupabase(user, "Suppression du compte");

    state.db.users = state.db.users.filter(function (item) {
      return item.id !== userId;
    });

    ui.closeModal();
    formState.saveAndRefresh();
  }

  // Remplace les anciens resetPassword("demo" en clair) et resetLink (faux
  // lien salon-reset://) : la seule action reelle possible cote navigateur
  // est de demander a Supabase d'envoyer un vrai email de reinitialisation.
  function sendPasswordReset(userId) {
    var state = formState.state;
    var user = utils.findById(state.db.users, userId);

    if (!user || !canManageAccount(userId)) {
      window.alert("Vous ne pouvez pas demander une reinitialisation pour ce compte.");
      return;
    }

    if (!user.email) {
      window.alert("Ce compte n'a pas d'email enregistre. Ajoutez-en un avant d'envoyer un lien.");
      return;
    }

    auth.requestPasswordReset(user.email).then(function () {
      window.alert("Si un compte Supabase existe pour " + user.email + ", un lien de reinitialisation vient d etre envoye.");
    });
  }

  window.SalonAccountForms = {
    deleteAccount: deleteAccount,
    openAddAccountForm: openAddAccountForm,
    openProfileForm: openProfileForm,
    sendPasswordReset: sendPasswordReset,
    toggleAccountActive: toggleAccountActive
  };
}());
