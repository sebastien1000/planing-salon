// Rendu des decorations/animations d'un theme (voir js/themes/theme-config.js
// pour la liste des decorations par theme et css/themes/theme-effects.css
// pour leur apparence). Toutes les decorations vivent dans un calque
// #theme-decorations en position fixed + pointer-events:none : elles ne
// peuvent jamais intercepter un clic, bloquer le scroll ni gener la
// navigation (voir css/themes/animations-common.css).
(function () {
  var config = window.SalonThemeConfig;
  var OVERLAY_ID = "theme-decorations";
  var currentThemeId = "default";
  var currentAnimationsEnabled = true;

  function ensureOverlay() {
    var overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.setAttribute("aria-hidden", "true");
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function buildParticle(type, index) {
    var particle = document.createElement("span");
    particle.className = "theme-particle";
    particle.dataset.decor = type;
    particle.style.setProperty("--i", String(index));
    particle.style.setProperty("--x", randomBetween(2, 96).toFixed(1) + "%");
    particle.style.setProperty("--drift", randomBetween(-40, 40).toFixed(0) + "px");
    particle.style.setProperty("--delay", randomBetween(0, 6).toFixed(2) + "s");
    particle.style.setProperty("--dur", randomBetween(7, 16).toFixed(2) + "s");
    particle.style.setProperty("--scale", randomBetween(0.7, 1.3).toFixed(2));
    return particle;
  }

  function render(themeId, animationsEnabled) {
    currentThemeId = themeId;
    currentAnimationsEnabled = animationsEnabled;

    var overlay = ensureOverlay();
    overlay.innerHTML = "";
    overlay.classList.toggle("is-static", !animationsEnabled);

    var theme = config.THEME_EFFECTS[themeId] || config.THEME_EFFECTS.default;

    theme.decor.forEach(function (item) {
      for (var i = 0; i < item.count; i++) {
        overlay.appendChild(buildParticle(item.type, i));
      }
    });
  }

  // ---- Micro-effet au clic sur un rendez-vous (section "bouton +"/RDV du
  // cahier des charges) : ecouteur additionnel, purement visuel, qui ne
  // touche ni preventDefault ni stopPropagation et n'interfere donc jamais
  // avec forms.bindReservationCardActions (js/core/forms.js), deja
  // responsable d'ouvrir la fiche du rendez-vous.
  function spawnClickEffect(x, y) {
    if (!currentAnimationsEnabled) {
      return;
    }

    var theme = config.THEME_EFFECTS[currentThemeId] || config.THEME_EFFECTS.default;
    var overlay = ensureOverlay();
    var burst = document.createElement("span");
    burst.className = "theme-click-effect";
    burst.dataset.click = theme.click;
    burst.style.left = x + "px";
    burst.style.top = y + "px";
    overlay.appendChild(burst);

    window.setTimeout(function () {
      if (burst.parentNode) {
        burst.parentNode.removeChild(burst);
      }
    }, 1200);
  }

  document.addEventListener("click", function (event) {
    var card = event.target.closest && event.target.closest(".grid-event[data-action=\"view-reservation\"]");
    if (card) {
      spawnClickEffect(event.clientX, event.clientY);
    }
  });

  window.SalonThemeDecorations = {
    render: render
  };
}());
