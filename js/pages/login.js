(function () {
  var auth = window.SalonAuth;
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

  function submitLogin() {
    loginButton.disabled = true;
    uiMessage.classList.add("hidden");

    auth.login(emailField.value, passwordField.value).then(function (user) {
      loginButton.disabled = false;

      if (!user) {
        showMessage(uiMessage, "Email ou mot de passe incorrect.");
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
