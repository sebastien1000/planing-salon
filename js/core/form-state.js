(function () {
  var data = window.SalonData;
  var utils = window.SalonUtils;

  var state = {
    db: null,
    user: null,
    selectedDate: utils.today(),
    refresh: function () {},
    // Clientes/rendez-vous/profils/absences/conges vivent desormais dans
    // Supabase (pas dans db) : ces tableaux sont rafraichis par chaque page
    // avant de rendre.
    clients: [],
    reservations: [],
    profiles: [],
    holidays: [],
    absences: []
  };

  function configure(options) {
    state.db = options.db;
    state.user = options.user;
    state.selectedDate = options.selectedDate || utils.today();
    state.refresh = options.refresh;

    if (options.clients) {
      state.clients = options.clients;
    }

    if (options.reservations) {
      state.reservations = options.reservations;
    }

    if (options.profiles) {
      state.profiles = options.profiles;
    }

    if (options.holidays) {
      state.holidays = options.holidays;
    }

    if (options.absences) {
      state.absences = options.absences;
    }
  }

  function saveAndRefresh() {
    data.saveDb(state.db);
    state.refresh();
  }

  window.SalonFormState = {
    configure: configure,
    saveAndRefresh: saveAndRefresh,
    state: state
  };
}());
