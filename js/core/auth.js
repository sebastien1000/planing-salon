(function () {
  var data = window.SalonData;
  var utils = window.SalonUtils;
  var supabaseClient = window.SalonSupabaseClient;
  var supabaseData = window.SalonSupabaseData;
  var AUTH_KEY = "salonCurrentUserId";

  function getDb() {
    return data.loadDb();
  }

  function saveCurrentUserId(id) {
    if (!id) {
      localStorage.removeItem(AUTH_KEY);
      return;
    }

    localStorage.setItem(AUTH_KEY, id);
  }

  function getCurrentUser() {
    var userId = localStorage.getItem(AUTH_KEY);
    if (!userId) {
      return null;
    }

    return utils.findById(getDb().users, userId) || null;
  }

  function findLocalUserByEmail(email) {
    var normalized = String(email || "").trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    return getDb().users.find(function (item) {
      return String(item.email || "").trim().toLowerCase() === normalized;
    }) || null;
  }

  // La table Supabase "profiles" n'utilise que 'admin'/'collab' (contrainte
  // CHECK dans schema.sql), mais on accepte ici quelques variantes en
  // ecriture libre (vieille fiche locale, saisie manuelle en SQL...) plutot
  // que de rejeter la connexion pour un simple mot different.
  var ROLE_ALIASES = {
    admin: "admin",
    administrateur: "admin",
    administratrice: "admin",
    collab: "collab",
    collaborateur: "collab",
    collaboratrice: "collab"
  };

  function normalizeRole(role) {
    var key = String(role || "").trim().toLowerCase();
    return ROLE_ALIASES[key] || null;
  }

  // Cree ou met a jour la fiche locale (couleur, salles/prestations
  // autorisees, telephone, photo... des champs qui ne vivent que dans
  // localStorage) a partir de la ligne "profiles" Supabase, qui reste la
  // source de verite pour l'identite/le role/l'activation.
  function syncLocalUserFromRemoteProfile(remoteProfile, normalizedRole) {
    var db = getDb();
    var local = utils.findById(db.users, remoteProfile.id) || findLocalUserByEmail(remoteProfile.email);

    if (!local) {
      local = {
        id: remoteProfile.id,
        login: remoteProfile.name,
        rooms: null,
        prestations: null,
        phone: "",
        photo: null
      };
      db.users.push(local);
    }

    local.name = remoteProfile.name || local.name;
    local.email = remoteProfile.email;
    local.role = normalizedRole;
    local.active = remoteProfile.active !== false;

    data.saveDb(db);
    return local;
  }

  // Le mot de passe n'est plus verifie ici : Supabase Auth compare le mot
  // de passe (jamais en clair, jamais hache par ce fichier) et renvoie une
  // vraie session si c'est correct. Le resultat n'est plus juste un profil
  // ou null : { status, user? } permet a l'ecran de connexion d'afficher un
  // message different selon la cause reelle de l'echec (identifiants faux,
  // profil manquant, compte desactive, role invalide...).
  function login(email, password) {
    if (!supabaseClient || !supabaseData) {
      return Promise.resolve({ status: "no-config" });
    }

    return supabaseClient.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: password
    }).then(function (result) {
      if (result.error || !result.data || !result.data.user) {
        return { status: "bad-credentials" };
      }

      var authUser = result.data.user;
      var normalizedAuthEmail = String(authUser.email || "").trim().toLowerCase();

      return supabaseData.listProfiles().then(function (profiles) {
        var remoteProfile = profiles.find(function (item) {
          return item.id === authUser.id ||
            String(item.email || "").trim().toLowerCase() === normalizedAuthEmail;
        });

        var localUser = findLocalUserByEmail(authUser.email);

        // Cas normal pour un collaborateur cree via "Ajouter un
        // collaborateur" (page Comptes) : sa fiche locale existe deja mais
        // sa ligne Supabase n'a encore jamais ete creee. On la cree
        // maintenant a partir de la fiche locale (comportement historique).
        if (!remoteProfile && localUser) {
          if (localUser.active === false) {
            return { status: "inactive" };
          }

          var localRole = normalizeRole(localUser.role);
          if (!localRole) {
            return { status: "bad-role" };
          }

          supabaseData.upsertProfile({
            id: authUser.id,
            email: localUser.email,
            name: localUser.name,
            role: localRole,
            active: localUser.active !== false
          }).catch(function () {});

          saveCurrentUserId(localUser.id);
          return { status: "ok", user: localUser };
        }

        // Aucune ligne "profiles" et aucune fiche locale : Supabase Auth a
        // accepte l'email/mot de passe, mais rien ne dit qui est cette
        // personne ni quels droits lui donner. On ne devine jamais un role.
        if (!remoteProfile) {
          return { status: "profile-missing" };
        }

        if (remoteProfile.active === false) {
          return { status: "inactive" };
        }

        var normalizedRole = normalizeRole(remoteProfile.role);
        if (!normalizedRole) {
          return { status: "bad-role" };
        }

        // La ligne "profiles" existe deja (compte cree directement dans
        // Supabase, ex. procedure d'ajout d'un 2e admin) : c'est elle qui
        // fait foi, on (re)cree/synchronise juste la fiche locale avec.
        var syncedUser = syncLocalUserFromRemoteProfile(remoteProfile, normalizedRole);
        saveCurrentUserId(syncedUser.id);
        return { status: "ok", user: syncedUser };
      });
    }).catch(function (error) {
      window.console && window.console.error && window.console.error(error);
      return { status: "error" };
    });
  }

  function logout() {
    saveCurrentUserId("");

    if (supabaseClient) {
      supabaseClient.auth.signOut();
    }

    window.location.href = "index.html";
  }

  function requireAuth() {
    var user = getCurrentUser();
    if (!user || user.active === false) {
      saveCurrentUserId("");
      window.location.href = "index.html";
      return null;
    }

    return user;
  }

  // Envoie un vrai email de reinitialisation via Supabase Auth. Reponse
  // toujours neutre cote appelant : ne jamais reveler si l'email existe.
  function requestPasswordReset(email) {
    if (!supabaseClient) {
      return Promise.resolve({ error: { message: "Supabase n'est pas configure." } });
    }

    var here = window.location.href.split(/[?#]/)[0];
    var base = here.slice(0, here.lastIndexOf("/") + 1);

    return supabaseClient.auth.resetPasswordForEmail(String(email || "").trim(), {
      redirectTo: base + "reset-password.html"
    });
  }

  function isAdmin(user) {
    return !!user && user.role === "admin";
  }

  function canSeeReservation(user, reservation) {
    return isAdmin(user) || reservation.collab === user.name;
  }

  window.SalonAuth = {
    canSeeReservation: canSeeReservation,
    getCurrentUser: getCurrentUser,
    isAdmin: isAdmin,
    login: login,
    logout: logout,
    requestPasswordReset: requestPasswordReset,
    requireAuth: requireAuth
  };
}());
