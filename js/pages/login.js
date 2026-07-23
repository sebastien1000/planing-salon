(function () {
  var auth = window.SalonAuth;
  var utils = window.SalonUtils;
  var loginPanel = document.getElementById("loginPanel");
  var forgotPanel = document.getElementById("forgotPanel");
  var uiMessage = document.getElementById("loginMsg");
  var forgotMessage = document.getElementById("forgotMsg");
  var loginButton = document.getElementById("loginSubmit");
  var forgotPasswordButton = document.getElementById("forgotPassword");
  var backToLoginButton = document.getElementById("backToLogin");
  var forgotSubmitButton = document.getElementById("forgotSubmit");
  var emailField = document.getElementById("loginEmail");
  var passwordField = document.getElementById("loginPass");
  var forgotEmailField = document.getElementById("forgotEmail");

  utils.bindPasswordToggle("loginPass", "loginPassToggle");

  if (auth.getCurrentUser()) {
    window.location.href = "planning.html";
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  function showMessage(element, message) {
    element.textContent = message;
    element.classList.remove("hidden");
  }

  // Messages distincts pour chaque cause d'echec : Supabase Auth peut avoir
  // reussi la connexion (email/mot de passe corrects) alors que le probleme
  // vient de la fiche "profiles" (absente, desactivee, role invalide) - ce
  // n'est plus jamais confondu avec un vrai mauvais mot de passe.
  var LOGIN_ERROR_MESSAGES = {
    "bad-credentials": "Email ou mot de passe incorrect.",
    "profile-missing": "Connexion Supabase reussie, mais aucun profil trouve dans la table profiles. Contactez l administrateur.",
    "inactive": "Ce compte est desactive.",
    "bad-role": "Role inconnu ou non autorise pour ce compte.",
    "no-config": "Supabase n'est pas configure. Voir js/core/supabase-client.js.",
    "error": "Erreur technique, réessayez."
  };

  function submitLogin() {
    loginButton.disabled = true;
    uiMessage.classList.add("hidden");

    auth.login(emailField.value, passwordField.value).then(function (result) {
      loginButton.disabled = false;

      if (!result || result.status !== "ok") {
        var status = result && result.status;
        showMessage(uiMessage, LOGIN_ERROR_MESSAGES[status] || LOGIN_ERROR_MESSAGES.error);
        return;
      }

      window.location.href = "planning.html";
    });
  }

  loginButton.addEventListener("click", submitLogin);
  passwordField.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      submitLogin();
    }
  });

  forgotPasswordButton.addEventListener("click", function () {
    forgotEmailField.value = emailField.value;
    forgotMessage.classList.add("hidden");
    loginPanel.classList.add("hidden");
    forgotPanel.classList.remove("hidden");
  });

  backToLoginButton.addEventListener("click", function () {
    forgotPanel.classList.add("hidden");
    loginPanel.classList.remove("hidden");
  });

  forgotSubmitButton.addEventListener("click", function () {
    forgotSubmitButton.disabled = true;

    auth.requestPasswordReset(forgotEmailField.value).then(function () {
      forgotSubmitButton.disabled = false;
      // Message volontairement identique dans tous les cas : on ne revele
      // jamais si un email existe dans la base.
      showMessage(forgotMessage, "Si ce compte existe, un lien de reinitialisation a ete envoye.");
    });
  });
}());
