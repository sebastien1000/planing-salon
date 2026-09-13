// Configuration centralisee du Theme Engine (voir js/themes/theme-manager.js
// et js/themes/theme-decorations.js). Purement declaratif : ajouter un
// theme = ajouter une entree ici + ses couleurs dans css/themes/theme-vars.css,
// jamais de nouveau "if" dans le reste du code.
(function () {
  var THEME_PRIORITIES = {
    DEFAULT: 0,
    SEASONAL: 200,
    HALLOWEEN: 300,
    EASTER: 400,
    VALENTINE: 500,
    BIRTHDAY: 600,
  };

  // Liste affichee dans Admin > Apparence (js/pages/plus.js), dans l'ordre
  // d'affichage souhaite.
  var THEME_LIST = [
    { id: "default", label: "Normal" },
    { id: "halloween", label: "Halloween" },
    { id: "noel", label: "Noël" },
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
    { id: "rose-gold", label: "Rose Gold" },
  ];

  // Decorations par theme : liste de {type, count}. Les "type" sont un
  // petit vocabulaire reutilisable (voir css/themes/theme-effects.css et
  // js/themes/theme-decorations.js), colore differemment par theme via les
  // variables CSS de css/themes/theme-vars.css - pas de nouvelle forme a
  // creer pour chaque theme. "click" vaut toujours "icon" (la silhouette du
  // theme, voir --theme-icon) sauf pour "default" qui reste un simple
  // ripple neutre.
  var THEME_EFFECTS = {
    default: {
      decor: [],
      click: "ripple",
    },
    halloween: {
      decor: [
        { type: "fog", count: 2 },
        { type: "bat", count: 3 },
        { type: "spider", count: 1 },
        { type: "ember", count: 12 },
      ],
      click: "icon",
    },
    noel: {
      decor: [
        { type: "snow", count: 14 },
        { type: "garland", count: 1 },
        { type: "star", count: 6 },
      ],
      click: "icon",
    },
    tropical: {
      decor: [
        { type: "leaf", count: 9 },
        { type: "flower", count: 4 },
        { type: "ember", count: 6 },
      ],
      click: "icon",
    },
    plage: {
      decor: [
        { type: "shimmer", count: 1 },
        { type: "ember", count: 10 },
      ],
      click: "icon",
    },
    cocooning: {
      decor: [{ type: "ember", count: 14 }],
      click: "icon",
    },
    disco: {
      decor: [
        { type: "confetti", count: 10 },
        { type: "ember", count: 14 },
        { type: "shimmer", count: 1 },
      ],
      click: "icon",
    },
    galaxy: {
      decor: [
        { type: "star", count: 10 },
        { type: "ember", count: 10 },
      ],
      click: "icon",
    },
    floral: {
      decor: [
        { type: "petal", count: 10 },
        { type: "flower", count: 6 },
      ],
      click: "icon",
    },
    "nouvel-an": {
      decor: [
        { type: "confetti", count: 10 },
        { type: "ember", count: 10 },
        { type: "star", count: 4 },
      ],
      click: "icon",
    },
    printemps: {
      decor: [
        { type: "petal", count: 10 },
        { type: "leaf", count: 6 },
        { type: "butterfly", count: 3 },
      ],
      click: "icon",
    },
    automne: {
      decor: [
        { type: "leaf", count: 16 },
        { type: "ember", count: 10 },
      ],
      click: "icon",
    },
    hiver: {
      decor: [
        { type: "snow", count: 18 },
        { type: "ember", count: 6 },
      ],
      click: "icon",
    },
    "chic-noir": {
      decor: [
        { type: "ember", count: 12 },
        { type: "confetti", count: 6 },
      ],
      click: "icon",
    },
    "rose-gold": {
      decor: [
        { type: "shimmer", count: 1 },
        { type: "ember", count: 12 },
      ],
      click: "icon",
    },
  };

  // Dates locales de l'appareil. null = anniversaire désactivé, à compléter.
  var MARION_BIRTHDAY = { day: 20, month: 3 };
  var JULIIE_BIRTHDAY = { day: 20, month: 6 };
  // Jour de l'anniversaire inclus : J, J+1, J+2 et J+3.
  var BIRTHDAY_DURATION_DAYS = 4;
  var SPECIAL_THEMES = [
    {
      id: "anniversaire-marion",
      label: "Anniversaire Marion",
      priority: THEME_PRIORITIES.BIRTHDAY,
      hiddenFromThemeSelector: true,
      birthday: MARION_BIRTHDAY,
      durationDays: BIRTHDAY_DURATION_DAYS,
      message: "Joyeux anniversaire Marion 🎂",
      decor: [
        { type: "confetti", count: 12 },
        { type: "balloon", count: 12 },
        { type: "heart", count: 4 },
        { type: "star", count: 3 },
      ],
    },
    {
      id: "anniversaire-juliie",
      label: "Anniversaire Juliie",
      priority: THEME_PRIORITIES.BIRTHDAY,
      hiddenFromThemeSelector: true,
      birthday: JULIIE_BIRTHDAY,
      durationDays: BIRTHDAY_DURATION_DAYS,
      message: "Joyeux anniversaire Juliie 🎂",
      decor: [
        { type: "confetti", count: 12 },
        { type: "balloon", count: 12 },
        { type: "heart", count: 4 },
        { type: "star", count: 3 },
      ],
    },
    {
      id: "saint-valentin",
      label: "Saint-Valentin",
      priority: THEME_PRIORITIES.VALENTINE,
      hiddenFromThemeSelector: true,
      start: "02-12",
      end: "02-15",
      decor: [
        { type: "heart", count: 12 },
        { type: "petal", count: 12 },
        { type: "star", count: 3 },
      ],
    },
    {
      id: "paques",
      label: "Pâques",
      priority: THEME_PRIORITIES.EASTER,
      hiddenFromThemeSelector: true,
      easter: { daysBefore: 2, daysAfter: 1 },
      decor: [
        { type: "egg", count: 12 },
        { type: "flower", count: 12 },
        { type: "petal", count: 2 },
      ],
    },
  ];

  SPECIAL_THEMES.forEach(function (theme) {
    THEME_EFFECTS[theme.id] = { decor: theme.decor, click: "icon" };
  });

  function isSelectableThemeId(id) {
    var theme = themeById(id);
    return !!theme && !theme.hiddenFromThemeSelector;
  }

  var SEASONAL_THEME_IDS = [
    "nouvel-an",
    "hiver",
    "printemps",
    "plage",
    "automne",
    "halloween",
    "noel",
  ];

  var PERMANENT_THEME_IDS = [
    "tropical",
    "cocooning",
    "disco",
    "galaxy",
    "floral",
    "chic-noir",
    "rose-gold",
  ];

  function themeById(id) {
    return (
      THEME_LIST.find(function (theme) {
        return theme.id === id;
      }) || null
    );
  }

  function specialThemeById(id) {
    return (
      SPECIAL_THEMES.find(function (theme) {
        return theme.id === id;
      }) || null
    );
  }

  function isValidThemeId(id) {
    return !!THEME_EFFECTS[id];
  }

  window.SalonThemeConfig = {
    THEME_PRIORITIES: THEME_PRIORITIES,
    SEASONAL_THEME_IDS: SEASONAL_THEME_IDS,
    SPECIAL_THEMES: SPECIAL_THEMES,
    MARION_BIRTHDAY: MARION_BIRTHDAY,
    JULIIE_BIRTHDAY: JULIIE_BIRTHDAY,
    BIRTHDAY_DURATION_DAYS: BIRTHDAY_DURATION_DAYS,
    isSelectableThemeId: isSelectableThemeId,
    THEME_LIST: THEME_LIST,
    THEME_EFFECTS: THEME_EFFECTS,
    PERMANENT_THEME_IDS: PERMANENT_THEME_IDS,
    themeById: themeById,
    specialThemeById: specialThemeById,
    isValidThemeId: isValidThemeId,
  };
})();
