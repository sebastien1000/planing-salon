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
    "halloween": {
      decor: [
        { type: "fog", count: 2 },
        { type: "bat", count: 3 },
        { type: "spider", count: 1 },
        { type: "ember", count: 12 }
      ],
      click: "icon"
    },
    "noel": {
      decor: [
        { type: "snow", count: 14 },
        { type: "garland", count: 1 },
        { type: "star", count: 6 }
      ],
      click: "icon"
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

  var PERMANENT_THEME_IDS = [
    "tropical", "cocooning", "disco", "galaxy", "floral", "chic-noir", "rose-gold"
  ];

  function themeById(id) {
    return THEME_LIST.find(function (theme) { return theme.id === id; }) || null;
  }

  function isValidThemeId(id) {
    return !!THEME_EFFECTS[id];
  }

  window.SalonThemeConfig = {
    THEME_LIST: THEME_LIST,
    THEME_EFFECTS: THEME_EFFECTS,
    PERMANENT_THEME_IDS: PERMANENT_THEME_IDS,
    themeById: themeById,
    isValidThemeId: isValidThemeId
  };
}());
