(function () {
  var data = window.SalonData;
  var utils = window.SalonUtils;
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

  function login(loginName, password) {
    var db = getDb();
    var normalized = String(loginName || "").trim().toLowerCase();
    var user = db.users.find(function (item) {
      return item.login.toLowerCase() === normalized && item.password === password;
    });

    if (!user || user.active === false) {
      return null;
    }

    saveCurrentUserId(user.id);
    return user;
  }

  function logout() {
    saveCurrentUserId("");
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
    requireAuth: requireAuth
  };
}());
