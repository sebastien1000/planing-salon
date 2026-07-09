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
    ["maladie", "Maladie"],
    ["rdv_perso", "Rendez-vous personnel"],
    ["formation", "Formation"],
    ["urgence", "Urgence"],
    ["indisponibilite", "Indisponibilite temporaire"],
    ["autre", "Autre"]
  ];

  function buildDefault() {
    return {
      // Le mot de passe n'est plus stocke ici : il vit uniquement dans
      // Supabase Auth (hache cote serveur). L'email ci-dessous doit
      // correspondre a un compte Supabase reel pour pouvoir se connecter.
      users: [
        { id: "u1", login: "Julie", name: "Julie", role: "collab", color: "#f4b5c5", rooms: null, prestations: null, phone: "", email: "", photo: null, active: true },
        { id: "u2", login: "Marion", name: "Marion", role: "collab", color: "#b7dbef", rooms: null, prestations: null, phone: "", email: "", photo: null, active: true },
        { id: "u0", login: "admin", name: "Administration", role: "admin", color: "#d9c2a3", rooms: null, prestations: null, phone: "", email: "", photo: null, active: true }
      ],
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
      absences: [
        {
          id: "a1",
          collab: "Julie",
          startDate: utils.today(1),
          startTime: "09:00",
          endDate: utils.today(1),
          endTime: "12:00",
          category: "indisponibilite",
          notes: "Indisponible"
        }
      ],
      holidays: [],
      photos: []
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
    safe.photos = Array.isArray(safe.photos) ? safe.photos : [];
    // Nettoyage : clientes/rendez-vous vivent desormais dans Supabase, on
    // ne les laisse pas trainer en double dans le localStorage existant.
    delete safe.clients;
    delete safe.reservations;
    return safe;
  }

  function persistDb(db) {
    var payload = JSON.stringify(db);

    try {
      localStorage.setItem(STORAGE_KEY, payload);
      return db;
    } catch (error) {
      if (!db.photos || !db.photos.length) {
        throw error;
      }

      db.photos = [];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      return db;
    }
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
