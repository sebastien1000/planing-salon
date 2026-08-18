(function () {
  var utils = window.SalonUtils;
  var STORAGE_KEY = "salonMvpV4";

  var ROOMS = [
    "Salle Ongles",
    "Salle Ongles 2",
    "Salle Noire",
    "Salle Semi Pieds",
    "Baby Spa",
    "Exterieur"
  ];

  var DEFAULT_COLLAB_COLOR = "#e8a7b6";

  var STATUS = [
    ["pre", "Prévu"],
    ["run", "En cours"],
    ["done", "Terminé"],
    ["cancel", "Annulé"],
    ["absent", "Absente"],
    ["move", "À reprogrammer"]
  ];

  var HOLIDAY_CATEGORIES = [
    ["vacances", "Vacances"],
    ["conge", "Congé"],
    ["formation", "Formation"],
    ["autre", "Autre"]
  ];

  var ABSENCE_CATEGORIES = [
    ["vacances", "Vacances"],
    ["maladie", "Maladie"],
    ["rdv_perso", "Rendez-vous personnel"],
    ["formation", "Formation"],
    ["urgence", "Urgence"],
    ["indisponibilite", "Indisponibilite temporaire"],
    ["autre", "Autre"]
  ];

  function buildDefault() {
    return {
      // Les comptes (Julie/Marion/admin...) ne sont plus inventes ici : ils
      // sont crees automatiquement a la premiere connexion de chacun, a
      // partir de sa ligne Supabase "profiles" (voir js/core/auth.js,
      // syncLocalUserFromRemoteProfile). Un utilisateur de demonstration
      // fixe ici (avec un id/email factices) créait un doublon a chaque
      // fois que le localStorage etait recree (cache vide, stockage
      // efface...) : la vraie fiche Supabase ne correspondait jamais a
      // cette fiche locale fantome (id/email differents), donc une
      // deuxieme fiche etait ajoutee au lieu d'etre reutilisee.
      users: [],
      prestations: [
        { id: "p1", name: "Pose gel", cat: "ongles", duration: 120, price: 45 },
        { id: "p2", name: "Remplissage gel", cat: "ongles", duration: 90, price: 38 },
        { id: "p3", name: "Semi-permanent", cat: "ongles", duration: 60, price: 30 },
        { id: "p4", name: "Cils", cat: "noire", duration: 120, price: 55 },
        { id: "p5", name: "Epilation", cat: "noire", duration: 45, price: 25 },
        { id: "p6", name: "Tatouage", cat: "noire", duration: 120, price: 80 },
        { id: "p7", name: "Baby spa", cat: "baby", duration: 60, price: 40 },
        { id: "p8", name: "Prestation exterieure", cat: "outside", duration: 120, price: 60 }
      ],
      // Clientes, rendez-vous, absences et conges ne sont plus stockes ici :
      // ils vivent dans Supabase (voir supabase/schema.sql et
      // js/core/supabase-data.js), avec droits verifies cote serveur.
    };
  }

  function sanitizeUser(user) {
    user.color = user.color || DEFAULT_COLLAB_COLOR;
    user.rooms = Array.isArray(user.rooms) ? user.rooms : null;
    user.prestations = Array.isArray(user.prestations) ? user.prestations : null;
    user.defaultRoom = user.defaultRoom || "";
    user.phone = user.phone || "";
    user.email = user.email || "";
    user.photo = user.photo || null;
    user.active = user.active !== false;
    // Nettoyage d'une eventuelle ancienne donnee : le mot de passe ne doit
    // plus jamais rester stocke en clair ici, seul Supabase Auth le connait.
    delete user.password;
    return user;
  }

  function sanitizeDb(db) {
    var safe = db && typeof db === "object" ? db : {};
    safe.users = (Array.isArray(safe.users) ? safe.users : buildDefault().users).map(sanitizeUser);
    safe.prestations = Array.isArray(safe.prestations) ? safe.prestations : buildDefault().prestations;
    // Nettoyage : clientes/rendez-vous/absences/conges vivent desormais dans
    // Supabase, et les photos "planning papier" (fonctionnalite retiree) ne
    // doivent pas trainer en double dans le localStorage existant.
    delete safe.clients;
    delete safe.reservations;
    delete safe.absences;
    delete safe.holidays;
    delete safe.photos;
    // Migration : retire les anciennes fiches de demonstration (Julie/
    // Marion/admin fixes avec id "u0"/"u1"/"u2" et email vide) qu'un ancien
    // buildDefault() recreait a chaque reinitialisation du localStorage.
    // Repere uniquement a ces id fixes + email vide : un vrai compte
    // synchronise depuis Supabase a toujours un id (uuid) et un email reels,
    // donc ce filtre ne touche jamais une fiche reelle.
    var LEGACY_DEMO_USER_IDS = { u0: true, u1: true, u2: true };
    safe.users = safe.users.filter(function (user) {
      return !(LEGACY_DEMO_USER_IDS[user.id] && !user.email);
    });
    return safe;
  }

  function persistDb(db) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return db;
  }

  function loadDb() {
    var raw = localStorage.getItem(STORAGE_KEY);
    var db;

    if (!raw) {
      db = buildDefault();
      return saveDb(db);
    }

    try {
      db = sanitizeDb(JSON.parse(raw));
    } catch (error) {
      db = buildDefault();
    }

    try {
      return saveDb(db);
    } catch (error) {
      db = buildDefault();
      return saveDb(db);
    }
  }

  function saveDb(db) {
    return persistDb(sanitizeDb(db));
  }

  // Options activables/desactivables depuis l'onglet Plus (voir
  // js/pages/plus.js). Stockees a part de "db" (localStorage separe) :
  // ce sont des preferences d'appareil, pas des donnees metier partagees
  // via Supabase. Ajouter une nouvelle option = ajouter sa cle ici avec sa
  // valeur par defaut (le comportement actuel, pour ne rien changer pour
  // qui ne touche jamais l'onglet Plus).
  var SETTINGS_KEY = "salonSettingsV1";

  function defaultSettings() {
    return {
      autoProposeNextRdv: true
    };
  }

  function loadSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      return Object.assign(defaultSettings(), raw ? JSON.parse(raw) : {});
    } catch (error) {
      return defaultSettings();
    }
  }

  function saveSettings(settings) {
    var safe = Object.assign(defaultSettings(), settings);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(safe));
    return safe;
  }

  window.SalonData = {
    ABSENCE_CATEGORIES: ABSENCE_CATEGORIES,
    HOLIDAY_CATEGORIES: HOLIDAY_CATEGORIES,
    ROOMS: ROOMS,
    STATUS: STATUS,
    STORAGE_KEY: STORAGE_KEY,
    buildDefault: buildDefault,
    loadDb: loadDb,
    loadSettings: loadSettings,
    saveDb: saveDb,
    saveSettings: saveSettings
  };
}());
