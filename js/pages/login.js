(function () {
  var auth = window.SalonAuth;
  var uiMessage = document.getElementById("loginMsg");
  var loginButton = document.getElementById("loginSubmit");
  var forgotPasswordButton = document.getElementById("forgotPassword");
  var userField = document.getElementById("loginUser");
  var passwordField = document.getElementById("loginPass");

  if (auth.getCurrentUser()) {
    window.location.href = "planning.html";
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  function showError(message) {
    uiMessage.textContent = message;
    uiMessage.classList.remove("hidden");
  }

  function submitLogin() {
    var user = auth.login(userField.value, passwordField.value);
    if (!user) {
      showError("Identifiant ou mot de passe incorrect.");
      return;
    }

    window.location.href = "planning.html";
  }

  loginButton.addEventListener("click", submitLogin);
  passwordField.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      submitLogin();
    }
  });

  forgotPasswordButton.addEventListener("click", function () {
    window.alert("Demande envoyee a l administrateur du salon.");
  });

  document.querySelectorAll("[data-demo-user]").forEach(function (button) {
    button.addEventListener("click", function () {
      userField.value = button.dataset.demoUser;
      passwordField.value = "demo";
      submitLogin();
    });
  });
}());
