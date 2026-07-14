(function () {
  var utils = window.SalonUtils;
  var STORAGE_KEY = "salonMvpV4";

  var ROOMS = [
    "Salle Ongles",
    "Salle Ongles 2",
    "Salle Noire",
    "Baby Spa",
    "Exterieur"
  ];

  var DEFAULT_COLLAB_COLOR = "#e8a7b6";

  var STATUS = [
    ["pre", "Prevu"],
    ["run", "En cours"],
    ["done", "Termine"],
    ["cancel", "Annule"],
    ["absent", "Absente"],
    ["move", "A reprogrammer"]
  ];

  var HOLIDAY_CATEGORIES = [
    ["vacances", "Vacances"],
    ["conge", "Conge"],
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
      // Clientes et rendez-vous ne sont plus stockes ici : ils vivent dans
      // Supabase (voir supabase/schema.sql et js/core/supabase-data.js),
      // avec droits verifies cote serveur.
      // Absences : idem, plus d'absence de demonstration fixe ici - elle
      // revenait a chaque reinitialisation du localStorage (date "demain"
      // recalculee a chaque fois, donc jamais vraiment "supprimee").
      absences: [],
      holidays: []
    };
  }

  function sanitizeUser(user) {
    user.color = user.color || DEFAULT_COLLAB_COLOR;
    user.rooms = Array.isArray(user.rooms) ? user.rooms : null;
    user.prestations = Array.isArray(user.prestations) ? user.prestations : null;
    user.phone = user.phone || "";
    user.email = user.email || "";
    user.photo = user.photo || null;
    user.active = user.active !== false;
    // Nettoyage d'une eventuelle ancienne donnee : le mot de passe ne doit
    // plus jamais rester stocke en clair ici, seul Supabase Auth le connait.
    delete user.password;
    return user;
  }

  function timeToMinutes(time) {
    var parts = String(time || "00:00").split(":").map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }

  function minutesToTime(totalMinutes) {
    var capped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
    var hours = Math.floor(capped / 60);
    var minutes = capped % 60;
    return (hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes;
  }

  function sanitizeBlockedPeriod(item) {
    var safeItem = item && typeof item === "object" ? item : {};

    if (!safeItem.startDate && safeItem.date) {
      safeItem = {
        id: safeItem.id,
        collab: safeItem.collab,
        startDate: safeItem.date,
        startTime: safeItem.time || "00:00",
        endDate: safeItem.date,
        endTime: minutesToTime(timeToMinutes(safeItem.time || "00:00") + Number(safeItem.duration || 0)),
        category: "autre",
        notes: safeItem.label || ""
      };
    }

    return {
      id: safeItem.id || utils.uid("a"),
      collab: safeItem.collab || "",
      startDate: safeItem.startDate || utils.today(),
      startTime: safeItem.startTime || "00:00",
      endDate: safeItem.endDate || safeItem.startDate || utils.today(),
      endTime: safeItem.endTime || "23:59",
      category: safeItem.category || "autre",
      notes: safeItem.notes || ""
    };
  }

  function sanitizeDb(db) {
    var safe = db && typeof db === "object" ? db : {};
    safe.users = (Array.isArray(safe.users) ? safe.users : buildDefault().users).map(sanitizeUser);
    safe.prestations = Array.isArray(safe.prestations) ? safe.prestations : buildDefault().prestations;
    safe.absences = (Array.isArray(safe.absences) ? safe.absences : []).map(sanitizeBlockedPeriod);
    safe.holidays = (Array.isArray(safe.holidays) ? safe.holidays : []).map(sanitizeBlockedPeriod);
    // Nettoyage : clientes/rendez-vous vivent desormais dans Supabase, et
    // les photos "planning papier" (fonctionnalite retiree) ne doivent pas
    // trainer en double dans le localStorage existant.
    delete safe.clients;
    delete safe.reservations;
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
    // Meme migration pour l'ancienne absence de demonstration fixe (id
    // "a1", jamais genere par utils.uid("a") qui produit toujours 8
    // caracteres) : sans ca elle "revenait" a chaque reinitialisation du
    // localStorage, avec une date recalculee a "demain" a chaque fois.
    safe.absences = safe.absences.filter(function (absence) {
      return absence.id !== "a1";
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

  window.SalonData = {
    ABSENCE_CATEGORIES: ABSENCE_CATEGORIES,
    HOLIDAY_CATEGORIES: HOLIDAY_CATEGORIES,
    ROOMS: ROOMS,
    STATUS: STATUS,
    STORAGE_KEY: STORAGE_KEY,
    buildDefault: buildDefault,
    loadDb: loadDb,
    saveDb: saveDb
  };
}());
