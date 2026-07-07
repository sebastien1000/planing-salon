(function () {
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var formState = window.SalonFormState;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  function openProfileForm(userId) {
    var state = formState.state;
    var user = state.db.users.find(function (item) {
      return item.id === userId;
    });

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
    var user = state.db.users.find(function (item) {
      return item.id === userId;
    });
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
    var user = state.db.users.find(function (item) {
      return item.id === userId;
    });

    if (!window.confirm("Reinitialiser le mot de passe ?")) {
      return;
    }

    user.password = "demo";
    data.saveDb(state.db);
    window.alert("Mot de passe remis a demo.");
  }

  function resetLink(userId) {
    var state = formState.state;
    var user = state.db.users.find(function (item) {
      return item.id === userId;
    });
    window.alert("Lien de reinitialisation : salon-reset://" + user.login + "-" + utils.uid());
  }

  window.SalonAccountForms = {
    openProfileForm: openProfileForm,
    resetLink: resetLink,
    resetPassword: resetPassword
  };
}());
