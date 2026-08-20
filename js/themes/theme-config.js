// Configuration centralisee du Theme Engine (voir js/themes/theme-manager.js
// et js/themes/theme-decorations.js). Purement declaratif : ajouter un
// theme = ajouter une entree ici + ses couleurs dans css/themes/theme-vars.css,
// jamais de nouveau "if" dans le reste du code.
(function () {
  // Liste affichee dans Admin > Apparence (js/pages/plus.js), dans l'ordre
  // d'affichage souhaite.
  var THEME_LIST = [
    { id: "default", label: "Normal" },
    { id: "halloween", label: "Halloween" },
    { id: "christmas", label: "Noël" },
    { id: "valentine", label: "Saint-Valentin" },
    { id: "easter", label: "Pâques" },
    { id: "spring", label: "Printemps" },
    { id: "summer", label: "Été" },
    { id: "autumn", label: "Automne" },
    { id: "new-year", label: "Nouvel An" }
  ];

  // Decorations par theme : liste de {type, count}. Les "type" sont un
  // petit vocabulaire reutilisable (voir css/themes/theme-effects.css et
  // js/themes/theme-decorations.js), colore differemment par theme via les
  // variables CSS de css/themes/theme-vars.css - pas de nouvelle forme a
  // creer pour chaque theme.
  var THEME_EFFECTS = {
    "default": {
      decor: [],
      fab: "default",
      click: "ripple"
    },
    "halloween": {
      decor: [
        { type: "fog", count: 2 },
        { type: "bat", count: 3 },
        { type: "spider", count: 1 },
        { type: "ember", count: 12 }
      ],
      fab: "halloween",
      click: "shadow"
    },
    "christmas": {
      decor: [
        { type: "snow", count: 18 },
        { type: "garland", count: 1 },
        { type: "star", count: 6 }
      ],
      fab: "christmas",
      click: "spark"
    },
    "valentine": {
      decor: [
        { type: "petal", count: 9 },
        { type: "ember", count: 8 }
      ],
      fab: "valentine",
      click: "heart"
    },
    "easter": {
      decor: [
        { type: "petal", count: 8 },
        { type: "flower", count: 5 }
      ],
      fab: "easter",
      click: "pastel"
    },
    "spring": {
      decor: [
        { type: "petal", count: 7 },
        { type: "leaf", count: 6 },
        { type: "butterfly", count: 2 }
      ],
      fab: "spring",
      click: "petal"
    },
    "summer": {
      decor: [
        { type: "shimmer", count: 1 },
        { type: "ember", count: 10 }
      ],
      fab: "summer",
      click: "sun"
    },
    "autumn": {
      decor: [
        { type: "leaf", count: 12 },
        { type: "ember", count: 8 }
      ],
      fab: "autumn",
      click: "leaf"
    },
    "new-year": {
      decor: [
        { type: "confetti", count: 10 },
        { type: "ember", count: 10 },
        { type: "star", count: 4 }
      ],
      fab: "new-year",
      click: "spark"
    }
  };

  // Periodes par defaut du mode Automatique, format "MM-DD". Une periode ou
  // start > end traverse le 31/12 -> 01/01 (ex. Noel, Nouvel An) : geree par
  // isWithinPeriod ci-dessous, pas besoin de la dupliquer.
  // Priorite en cas de chevauchement = ordre de cette liste (le premier
  // theme dont la periode couvre la date gagne). Nouvel An est place avant
  // Noel : les deux periodes se chevauchent fin decembre / debut janvier,
  // et Nouvel An doit gagner sur cette fenetre commune.
  var THEME_PERIODS = [
    { id: "new-year", start: "12-28", end: "01-02" },
    { id: "christmas", start: "11-25", end: "01-05" },
    { id: "halloween", start: "10-20", end: "11-01" },
    { id: "valentine", start: "02-07", end: "02-14" },
    // Paques est une fete mobile (date differente chaque annee) : periode
    // large approximative couvrant la plage habituelle plutot qu'un calcul
    // exact de la date de Paques. Ajustable ici sans toucher au reste du
    // code.
    { id: "easter", start: "03-15", end: "04-20" },
    { id: "autumn", start: "09-01", end: "10-19" },
    { id: "summer", start: "06-01", end: "08-31" },
    { id: "spring", start: "03-21", end: "05-31" }
  ];

  function monthDayNumber(month, day) {
    return month * 100 + day;
  }

  function parsePeriodBound(value) {
    var parts = value.split("-");
    return monthDayNumber(Number(parts[0]), Number(parts[1]));
  }

  function isWithinPeriod(period, monthDay) {
    var start = parsePeriodBound(period.start);
    var end = parsePeriodBound(period.end);

    if (start <= end) {
      return monthDay >= start && monthDay <= end;
    }

    // Periode a cheval sur le nouvel an (ex. 12-28 -> 01-02).
    return monthDay >= start || monthDay <= end;
  }

  // Fonction centralisee de selection automatique du theme : le mode
  // Automatique (js/themes/theme-manager.js) et les tests (voir
  // js/themes/theme-config.test.js si present) passent tous par ici, aucune
  // date n'est comparee ailleurs dans le code.
  function getSeasonalTheme(date) {
    var reference = date instanceof Date ? date : new Date();
    var monthDay = monthDayNumber(reference.getMonth() + 1, reference.getDate());

    for (var i = 0; i < THEME_PERIODS.length; i++) {
      if (isWithinPeriod(THEME_PERIODS[i], monthDay)) {
        return THEME_PERIODS[i].id;
      }
    }

    return "default";
  }

  function isValidThemeId(id) {
    return !!THEME_EFFECTS[id];
  }

  window.SalonThemeConfig = {
    THEME_LIST: THEME_LIST,
    THEME_EFFECTS: THEME_EFFECTS,
    THEME_PERIODS: THEME_PERIODS,
    getSeasonalTheme: getSeasonalTheme,
    isValidThemeId: isValidThemeId
  };
}());
