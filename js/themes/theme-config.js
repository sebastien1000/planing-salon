// Configuration centralisee du Theme Engine (voir js/themes/theme-manager.js
// et js/themes/theme-decorations.js). Purement declaratif : ajouter un
// theme = ajouter une entree ici + ses couleurs dans css/themes/theme-vars.css,
// jamais de nouveau "if" dans le reste du code.
(function () {
  // Liste affichee dans Admin > Apparence (js/pages/plus.js), dans l'ordre
  // d'affichage souhaite.
  var THEME_LIST = [
    { id: "default", label: "Normal" },
    { id: "tropical", label: "Tropical" },
    { id: "plage", label: "Plage / Vacances" },
    { id: "cocooning", label: "Cocooning" },
    { id: "disco", label: "Disco" },
    { id: "galaxy", label: "Galaxy" },
    { id: "floral", label: "Floral" },
    { id: "nouvel-an", label: "Nouvel An" },
    { id: "printemps", label: "Printemps" },
    { id: "automne", label: "Automne" },
    { id: "hiver", label: "Hiver" },
    { id: "chic-noir", label: "Chic Noir & Or" },
    { id: "rose-gold", label: "Rose Gold" }
  ];

  // Decorations par theme : liste de {type, count}. Les "type" sont un
  // petit vocabulaire reutilisable (voir css/themes/theme-effects.css et
  // js/themes/theme-decorations.js), colore differemment par theme via les
  // variables CSS de css/themes/theme-vars.css - pas de nouvelle forme a
  // creer pour chaque theme. "click" vaut toujours "icon" (la silhouette du
  // theme, voir --theme-icon) sauf pour "default" qui reste un simple
  // ripple neutre.
  var THEME_EFFECTS = {
    "default": {
      decor: [],
      click: "ripple"
    },
    "tropical": {
      decor: [
        { type: "leaf", count: 9 },
        { type: "flower", count: 4 },
        { type: "ember", count: 6 }
      ],
      click: "icon"
    },
    "plage": {
      decor: [
        { type: "shimmer", count: 1 },
        { type: "ember", count: 10 }
      ],
      click: "icon"
    },
    "cocooning": {
      decor: [
        { type: "ember", count: 14 }
      ],
      click: "icon"
    },
    "disco": {
      decor: [
        { type: "confetti", count: 10 },
        { type: "ember", count: 14 },
        { type: "shimmer", count: 1 }
      ],
      click: "icon"
    },
    "galaxy": {
      decor: [
        { type: "star", count: 10 },
        { type: "ember", count: 10 }
      ],
      click: "icon"
    },
    "floral": {
      decor: [
        { type: "petal", count: 10 },
        { type: "flower", count: 6 }
      ],
      click: "icon"
    },
    "nouvel-an": {
      decor: [
        { type: "confetti", count: 10 },
        { type: "ember", count: 10 },
        { type: "star", count: 4 }
      ],
      click: "icon"
    },
    "printemps": {
      decor: [
        { type: "petal", count: 10 },
        { type: "leaf", count: 6 },
        { type: "butterfly", count: 3 }
      ],
      click: "icon"
    },
    "automne": {
      decor: [
        { type: "leaf", count: 16 },
        { type: "ember", count: 10 }
      ],
      click: "icon"
    },
    "hiver": {
      decor: [
        { type: "snow", count: 18 },
        { type: "ember", count: 6 }
      ],
      click: "icon"
    },
    "chic-noir": {
      decor: [
        { type: "ember", count: 12 },
        { type: "confetti", count: 6 }
      ],
      click: "icon"
    },
    "rose-gold": {
      decor: [
        { type: "shimmer", count: 1 },
        { type: "ember", count: 12 }
      ],
      click: "icon"
    }
  };

  // Periodes par defaut du mode Automatique, format "MM-DD". Une periode ou
  // start > end traverse le 31/12 -> 01/01 (geree par isWithinPeriod
  // ci-dessous). Seuls les themes lies a une vraie saison/periode de
  // l'annee (Nouvel An, Hiver, Printemps, Automne, Plage/ete) participent au
  // mode Automatique ; les themes "ambiance" (Tropical, Cocooning, Disco,
  // Galaxy, Floral, Chic Noir, Rose Gold) restent uniquement accessibles en
  // choix manuel par l'admin. Priorite en cas de chevauchement = ordre de
  // cette liste (Nouvel An gagne sur Hiver fin decembre/debut janvier).
  var THEME_PERIODS = [
    { id: "nouvel-an", start: "12-28", end: "01-02" },
    { id: "hiver", start: "11-25", end: "01-05" },
    { id: "printemps", start: "03-21", end: "05-31" },
    { id: "automne", start: "09-01", end: "11-24" },
    { id: "plage", start: "06-01", end: "08-31" }
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
  // Automatique (js/themes/theme-manager.js) et les tests passent tous par
  // ici, aucune date n'est comparee ailleurs dans le code.
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
