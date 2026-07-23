(function () {
  var supabaseClient = window.SalonSupabaseClient;
  var utils = window.SalonUtils;
  var checkingPanel = document.getElementById("checkingPanel");
  var invalidPanel = document.getElementById("invalidPanel");
  var resetPanel = document.getElementById("resetPanel");
  var donePanel = document.getElementById("donePanel");
  var resetMsg = document.getElementById("resetMsg");
  var newPasswordField = document.getElementById("newPassword");
  var confirmPasswordField = document.getElementById("confirmPassword");
  var resetSubmitButton = document.getElementById("resetSubmit");

  utils.bindPasswordToggle("newPassword", "newPasswordToggle");
  utils.bindPasswordToggle("confirmPassword", "confirmPasswordToggle");

  function showPanel(panel) {
    [checkingPanel, invalidPanel, resetPanel, donePanel].forEach(function (item) {
      item.classList.toggle("hidden", item !== panel);
    });
  }

  function showError(message) {
    resetMsg.textContent = message;
    resetMsg.classList.remove("hidden");
  }

  if (!supabaseClient) {
    showPanel(invalidPanel);
    return;
  }

  var handled = false;

  function handleRecoverySession(session) {
    if (handled || !session) {
      return;
    }

    handled = true;
    showPanel(resetPanel);
  }

  supabaseClient.auth.onAuthStateChange(function (event, session) {
    if (event === "PASSWORD_RECOVERY") {
      handleRecoverySession(session);
    }
  });

  // Si le lien a deja ete traite avant l'ajout du listener ci-dessus.
  supabaseClient.auth.getSession().then(function (result) {
    if (!handled && result.data && result.data.session) {
      handleRecoverySession(result.data.session);
    }
  });

  // Le lien de recuperation contient un jeton dans l'URL ; s'il n'y en a
  // pas et qu'aucune session n'apparait rapidement, le lien est invalide
  // ou a deja ete utilise (usage unique impose par Supabase).
  setTimeout(function () {
    if (!handled) {
      showPanel(invalidPanel);
    }
  }, 4000);

  resetSubmitButton.addEventListener("click", function () {
    var password = newPasswordField.value;
    var confirmPassword = confirmPasswordField.value;

    resetMsg.classList.add("hidden");

    if (!password || password.length < 6) {
      showError("Le mot de passe doit contenir au moins 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      showError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    resetSubmitButton.disabled = true;

    supabaseClient.auth.updateUser({ password: password }).then(function (result) {
      resetSubmitButton.disabled = false;

      if (result.error) {
        showError("Impossible de mettre a jour le mot de passe. Le lien a peut-etre expire.");
        return;
      }

      supabaseClient.auth.signOut().then(function () {
        showPanel(donePanel);
      });
    });
  });
}());
