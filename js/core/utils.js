(function () {
  function today(add) {
    var offset = Number(add || 0);
    var date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  function uid(prefix) {
    return (prefix || "id") + Math.random().toString(36).slice(2, 9);
  }

  function dateObj(value) {
    return new Date(value + "T12:00");
  }

  function iso(date) {
    return date.toISOString().slice(0, 10);
  }

  function addDays(value, count) {
    var date = dateObj(value);
    date.setDate(date.getDate() + count);
    return iso(date);
  }

  function startWeek(value) {
    var date = dateObj(value);
    var day = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - day);
    return iso(date);
  }

  function startMonth(value) {
    var date = dateObj(value);
    date.setDate(1);
    return iso(date);
  }

  function monthDates(value) {
    var start = dateObj(startMonth(value));
    var month = start.getMonth();
    var dates = [];
    var cursor = new Date(start);

    while (cursor.getMonth() === month) {
      dates.push(iso(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  function fmtDate(value) {
    return dateObj(value).toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short"
    });
  }

  function mins(time) {
    var parts = time.split(":").map(Number);
    return parts[0] * 60 + parts[1];
  }

  function overlaps(aStart, aDuration, bStart, bDuration) {
    var aEnd = mins(aStart) + Number(aDuration);
    var bEnd = mins(bStart) + Number(bDuration);
    return mins(aStart) < bEnd && aEnd > mins(bStart);
  }

  function findById(list, id) {
    return list.find(function (item) {
      return item.id === id;
    });
  }

  function findByName(list, name) {
    return list.find(function (item) {
      return item.name === name;
    });
  }

  function readableTextColor(hex) {
    var value = String(hex || "").replace("#", "");
    if (value.length !== 6) {
      return "#241019";
    }

    var r = parseInt(value.slice(0, 2), 16);
    var g = parseInt(value.slice(2, 4), 16);
    var b = parseInt(value.slice(4, 6), 16);
    var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#241019" : "#ffffff";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var PASSWORD_EYE_OPEN_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  var PASSWORD_EYE_OFF_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"></path><path d="M10.6 10.6a3 3 0 0 0 4.24 4.24"></path><path d="M6.5 6.7C3.9 8.3 2 12 2 12s4 8 11 8c1.9 0 3.6-.4 5-.1"></path><path d="M17.9 17.9C20.4 16.2 22 12 22 12s-1.2-2.4-3.3-4.4"></path></svg>';

  // Bouton "oeil" sur un champ mot de passe : bascule uniquement l'attribut
  // type (password/text), ne touche jamais a la valeur saisie. Partage
  // entre index.html (connexion) et reset-password.html (nouveau mot de
  // passe) : les deux chargent utils.js mais pas forcement js/core/ui.js.
  function bindPasswordToggle(inputId, buttonId) {
    var input = document.getElementById(inputId);
    var button = document.getElementById(buttonId);

    if (!input || !button) {
      return;
    }

    function setVisible(visible) {
      input.type = visible ? "text" : "password";
      button.innerHTML = visible ? PASSWORD_EYE_OFF_ICON : PASSWORD_EYE_OPEN_ICON;
      button.setAttribute("aria-label", visible ? "Masquer le mot de passe" : "Afficher le mot de passe");
    }

    setVisible(false);

    button.addEventListener("click", function () {
      setVisible(input.type === "password");
    });
  }

  window.SalonUtils = {
    addDays: addDays,
    bindPasswordToggle: bindPasswordToggle,
    dateObj: dateObj,
    escapeHtml: escapeHtml,
    findById: findById,
    findByName: findByName,
    fmtDate: fmtDate,
    iso: iso,
    mins: mins,
    monthDates: monthDates,
    overlaps: overlaps,
    readableTextColor: readableTextColor,
    startMonth: startMonth,
    startWeek: startWeek,
    today: today,
    uid: uid
  };
}());
