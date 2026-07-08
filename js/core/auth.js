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

  function findProfileByEmail(email) {
    var normalized = String(email || "").trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    return getDb().users.find(function (item) {
      return String(item.email || "").trim().toLowerCase() === normalized;
    }) || null;
  }

  // Le mot de passe n'est plus verifie ici : Supabase Auth compare le mot
  // de passe (jamais en clair, jamais hache par ce fichier) et renvoie une
  // vraie session si c'est correct.
  function login(email, password) {
    if (!supabaseClient) {
      window.alert("Supabase n'est pas configure. Voir js/core/supabase-client.js.");
      return Promise.resolve(null);
    }

    return supabaseClient.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: password
    }).then(function (result) {
      if (result.error || !result.data || !result.data.user) {
        return null;
      }

      var profile = findProfileByEmail(result.data.user.email);
      if (!profile || profile.active === false) {
        return null;
      }

      // Garde la ligne "profiles" Supabase (utilisee par les regles de
      // securite et affichee sur les rendez-vous) synchronisee avec la
      // fiche locale a chaque connexion : c'est ce qui cree la ligne la
      // toute premiere fois qu'un collaborateur se connecte.
      if (supabaseData) {
        supabaseData.upsertProfile({
          id: result.data.user.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
          active: profile.active !== false
        }).catch(function () {});
      }

      saveCurrentUserId(profile.id);
      return profile;
    }).catch(function () {
      return null;
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
