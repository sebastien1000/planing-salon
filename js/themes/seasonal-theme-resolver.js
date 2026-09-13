// Calendrier saisonnier central du Theme Engine.
// Une saison expose un identifiant annuel stable afin que son activation
// automatique ne puisse avoir lieu qu'une seule fois par collaborateur.
(function () {
  var config = window.SalonThemeConfig;
  var priorities = config.THEME_PRIORITIES;
  var PERIODS = [
    {
      theme: "nouvel-an",
      activationSlug: "new-year",
      start: "12-26",
      end: "01-03",
      crossesYear: true,
    },
    { theme: "hiver", activationSlug: "winter", start: "01-04", end: "03-19" },
    {
      theme: "printemps",
      activationSlug: "spring",
      start: "03-20",
      end: "06-21",
    },
    { theme: "plage", activationSlug: "beach", start: "06-22", end: "09-20" },
    {
      theme: "automne",
      activationSlug: "autumn",
      start: "09-21",
      end: "10-19",
    },
    {
      theme: "halloween",
      activationSlug: "halloween",
      start: "10-20",
      end: "11-01",
    },
    {
      theme: "automne",
      activationSlug: "autumn",
      start: "11-02",
      end: "11-30",
    },
    {
      theme: "noel",
      activationSlug: "christmas",
      start: "12-01",
      end: "12-25",
    },
  ];

  function monthDay(date) {
    return (date.getMonth() + 1) * 100 + date.getDate();
  }

  function bound(value) {
    var parts = value.split("-");
    return Number(parts[0]) * 100 + Number(parts[1]);
  }

  function contains(period, value) {
    var start = bound(period.start);
    var end = bound(period.end);
    return start <= end
      ? value >= start && value <= end
      : value >= start || value <= end;
  }

  function activationYear(period, date) {
    // La saison commencée le 26 décembre porte l'année que l'on célèbre.
    // 26/12/2026 et 03/01/2027 partagent ainsi new-year-2027.
    if (period.crossesYear && date.getMonth() === 11) {
      return date.getFullYear() + 1;
    }
    return date.getFullYear();
  }

  function periodPriority(period) {
    return period.priority || (period.theme === "halloween" ? priorities.HALLOWEEN : priorities.SEASONAL);
  }

  function getSeasonalActivation(date) {
    var reference = date instanceof Date ? date : new Date();
    var value = monthDay(reference);

    // Un seul parcours, sans modifier ni trier le calendrier.
    var period = PERIODS.reduce(function (winner, candidate) {
      if (!contains(candidate, value)) return winner;
      return !winner || periodPriority(candidate) > periodPriority(winner) ? candidate : winner;
    }, null);

    if (!period) return null;

    return {
      theme: period.theme,
      priority: periodPriority(period),
      activationId: period.activationSlug + "-" + activationYear(period, reference),
      start: period.start,
      end: period.end
    };
  }

  // Comput grégorien : dimanche de Pâques, recalculé pour chaque année.
  function getEasterDate(year) {
    var a = year % 19, b = Math.floor(year / 100), c = year % 100;
    var d = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var value = h + l - 7 * m + 114;
    return new Date(year, Math.floor(value / 31) - 1, value % 31 + 1);
  }

  function isSpecialActive(theme, date) {
    if (theme.birthday) {
      var birthday = theme.birthday;
      if (!Number.isInteger(birthday.day) || !Number.isInteger(birthday.month)) return false;

      // L'année précédente couvre une période commencée fin décembre.
      // Les bornes civiles évitent les décalages lors du changement d'heure.
      return [date.getFullYear(), date.getFullYear() - 1].some(function (year) {
        var start = new Date(year, birthday.month - 1, birthday.day);
        if (start.getMonth() !== birthday.month - 1 || start.getDate() !== birthday.day) return false;
        var end = new Date(year, birthday.month - 1, birthday.day + (theme.durationDays || 1));
        return date >= start && date < end;
      });
    }
    if (theme.easter) {
      var easter = getEasterDate(date.getFullYear());
      var start = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() - theme.easter.daysBefore);
      var end = new Date(easter.getFullYear(), easter.getMonth(), easter.getDate() + theme.easter.daysAfter + 1);
      return date >= start && date < end;
    }
    return contains(theme, monthDay(date));
  }

  // Le choix persistant reste la base. Les événements cachés le remplacent
  // uniquement pendant leur période. À égalité, l'ordre de configuration gagne.
  function resolveTheme(date, selectedTheme) {
    var candidates = config.SPECIAL_THEMES.filter(function (theme) {
      return isSpecialActive(theme, date);
    }).map(function (theme) {
      return { theme: theme.id, priority: theme.priority, special: theme };
    });
    candidates.push({
      theme: selectedTheme || "default",
      priority: selectedTheme === "halloween" ? priorities.HALLOWEEN : priorities.DEFAULT,
      special: null
    });
    return candidates.reduce(function (winner, candidate) {
      return candidate.priority > winner.priority ? candidate : winner;
    });
  }

  window.SalonSeasonalTheme = {
    getEasterDate: getEasterDate,
    isSpecialActive: isSpecialActive,
    resolveTheme: resolveTheme,
    PERIODS: PERIODS,
    getSeasonalActivation: getSeasonalActivation,
  };
})();
