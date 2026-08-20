// Applique le dernier thème connu du compte avant le rendu de la page pour
// éviter un flash. Une clé sans UUID n'est jamais lue : aucun thème ne peut
// fuiter de Julie vers Marion sur un appareil partagé.
(function () {
  var theme = "default";
  var animations = true;
  try {
    var userId = localStorage.getItem("salonCurrentUserId");
    var raw = userId ? localStorage.getItem("salonThemePreference:" + userId) : null;
    var state = raw ? JSON.parse(raw) : null;
    theme = state && state.selectedTheme ? state.selectedTheme : "default";
    animations = !(state && state.animationsEnabled === false);
  } catch (error) {
    theme = "default";
    animations = true;
  }
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-animations", animations ? "on" : "off");
}());
