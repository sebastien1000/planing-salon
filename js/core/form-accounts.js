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

  function openProfileForm(userId) {
    var state = formState.state;
    var user = utils.findById(state.db.users, userId);

    if (!canManageAccount(userId)) {
      window.alert("Vous ne pouvez pas modifier ce compte.");
      return;
    }

    ui.showModal([
      '<div class="modal-head">',
      "  <h3>Profil</h3>",
      '  <button id="closeProfileModal" class="x" type="button">x</button>',
      "</div>",
      '<label for="uName">Nom affiche</label><input id="uName" class="field" value="' + utils.escapeHtml(user.name) + '">',
      '<label for="uPass">Nouveau mot de passe</label><input id="uPass" class="field" type="password" placeholder="Laisser vide pour ne pas changer">',
      '<button id="saveProfileButton" class="primary" style="width:100%;margin-top:14px" type="button">Enregistrer</button>'
    ].join(""));

    ui.byId("closeProfileModal").addEventListener("click", ui.closeModal);
    ui.byId("saveProfileButton").addEventListener("click", function () {
      saveProfile(userId);
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
    var password = ui.byId("uPass").value;

    user.name = newName;
    if (password) {
      user.password = password;
    }

    if (oldName !== newName) {
      domain.renameCollaborator(state.db, oldName, newName);
    }

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
    openProfileForm: openProfileForm,
    resetLink: resetLink,
    resetPassword: resetPassword
  };
}());
