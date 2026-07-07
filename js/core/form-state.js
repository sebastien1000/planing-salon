(function () {
  var data = window.SalonData;
  var utils = window.SalonUtils;

  var state = {
    db: null,
    user: null,
    selectedDate: utils.today(),
    refresh: function () {}
  };

  function configure(options) {
    state.db = options.db;
    state.user = options.user;
    state.selectedDate = options.selectedDate || utils.today();
    state.refresh = options.refresh;
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
