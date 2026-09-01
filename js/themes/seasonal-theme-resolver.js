// Calendrier saisonnier central du Theme Engine.
// Une saison expose un identifiant annuel stable afin que son activation
// automatique ne puisse avoir lieu qu'une seule fois par collaborateur.
(function () {
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
      end: "05-31",
    },
    { theme: "plage", activationSlug: "beach", start: "06-01", end: "08-31" },
    {
      theme: "automne",
      activationSlug: "autumn",
      start: "09-01",
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
    // La saison du Nouvel An commencée le 28 décembre porte l'année que
    // l'on célèbre (28/12/2026 -> new-year-2027, 03/01/2027 -> idem).
    if (period.crossesYear && date.getMonth() === 11) {
      return date.getFullYear() + 1;
    }
    return date.getFullYear();
  }

  function getSeasonalActivation(date) {
    var reference = date instanceof Date ? date : new Date();
    var value = monthDay(reference);

    for (var i = 0; i < PERIODS.length; i++) {
      var period = PERIODS[i];
      if (contains(period, value)) {
        return {
          theme: period.theme,
          activationId:
            period.activationSlug + "-" + activationYear(period, reference),
          start: period.start,
          end: period.end,
        };
      }
    }

    return null;
  }

  window.SalonSeasonalTheme = {
    PERIODS: PERIODS,
    getSeasonalActivation: getSeasonalActivation,
  };
})();
