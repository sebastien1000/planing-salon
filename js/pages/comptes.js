(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var forms = window.SalonForms;
  var supabaseData = window.SalonSupabaseData;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  var user = ui.initAppPage({
    activePage: "comptes",
    actions: {},
    pageTitle: "Comptes"
  });

  if (!user) {
    return;
  }

  var db = data.loadDb();
  var selectedDate = sessionStorage.getItem("planning:date") || utils.today();
  var reservations = [];
  var holidays = [];

  function virtualDb() {
    return { reservations: reservations, prestations: db.prestations };
  }

  var RANGE_LABELS = { day: "Aujourd'hui", week: "Semaine", month: "Mois" };

  function renderStatButton(collab, range) {
    return '<button class="stat" type="button" data-history-collab="' + utils.escapeHtml(collab) +
      '" data-history-range="' + range + '">' +
      "<b>" + domain.revenueFor(virtualDb(), collab, range, selectedDate) + "EUR</b>" +
      "<span>" + RANGE_LABELS[range] + "</span>" +
      "</button>";
  }

  function openHistorySheet(collab, range) {
    var items = domain.doneReservationsFor(virtualDb(), collab, range, selectedDate);
    var total = items.reduce(function (sum, item) { return sum + item.price; }, 0);

    var rows = items.length
      ? items.map(function (item) {
          return [
            '<div class="row" style="justify-content:space-between">',
            '  <div class="grow">',
            "    <b>" + utils.escapeHtml(item.client || "Client") + "</b>",
            '    <div class="tiny">' + utils.escapeHtml(item.prestation) + " · " +
              utils.escapeHtml(domain.fullDateLabel(item.date)) + " " + utils.escapeHtml(item.time) + "</div>",
            "  </div>",
            '  <span class="badge">' + item.price + " EUR</span>",
            "</div>"
          ].join("");
        }).join("")
      : '<p class="tiny">Aucun RDV termine sur cette periode.</p>';

    ui.showSheet([
      '<div class="modal-head">',
      "  <h3>Historique - " + RANGE_LABELS[range] + "</h3>",
      '  <button id="closeHistoryButton" class="x" type="button">x</button>',
      "</div>",
      '<p class="tiny">' + utils.escapeHtml(collab) + "</p>",
      '<div class="stack">' + rows + "</div>",
      '<div class="row" style="justify-content:space-between;margin-top:14px">',
      "  <b>Total</b>",
      '  <span class="badge">' + total + " EUR</span>",
      "</div>"
    ].join(""));

    ui.byId("closeHistoryButton").addEventListener("click", ui.closeSheet);
  }

  function openHolidaySheet(account) {
    var items = forms.holidaysForCollab(holidays, account.name);
    var isAdmin = auth.isAdmin(user);

    function refreshWhileOpen() {
      render().then(function () {
        openHolidaySheet(account);
      });
    }

    forms.configure({
      db: db,
      refresh: refreshWhileOpen,
      selectedDate: selectedDate,
      user: user,
      reservations: reservations,
      holidays: holidays
    });

    ui.showSheet([
      '<div class="modal-head">',
      "  <h3>Congés - " + utils.escapeHtml(account.name) + "</h3>",
      '  <button id="closeHolidaySheetButton" class="x" type="button">x</button>',
      "</div>",
      isAdmin ? '<button id="addHolidayButton" class="primary" style="width:100%;margin-bottom:12px" type="button">Ajouter un conge</button>' : "",
      '<div id="holidayList" class="stack">' +
        (items.length ? items.map(function (item) { return forms.holidayCard(item, !isAdmin); }).join("") : '<p class="tiny">Aucun conge enregistre.</p>') +
        "</div>"
    ].join(""));

    ui.byId("closeHolidaySheetButton").addEventListener("click", function () {
      forms.configure({
        db: db,
        refresh: render,
        selectedDate: selectedDate,
        user: user,
        reservations: reservations,
        holidays: holidays
      });
      ui.closeSheet();
    });
    forms.bindHolidayCardActions(ui.byId("holidayList"));

    var addButton = ui.byId("addHolidayButton");
    if (addButton) {
      addButton.addEventListener("click", function () {
        forms.openHolidayForm(null, account.name);
      });
    }
  }

  function accountBadges(account) {
    return account.active === false ? '<span class="badge">Compte desactive</span>' : "";
  }

  function accountSecondaryActions(account) {
    var isCollab = account.role === "collab";
    var isSelf = account.id === user.id;
    var actions = [];

    if (isCollab) {
      actions.push({ id: "manage-holidays", label: "Gérer les congés" });
    }

    actions.push({ id: "send-password-reset", label: "Envoyer un lien de reinitialisation" });

    if (!isSelf) {
      actions.push({
        id: "toggle-active",
        label: account.active === false ? "Reactiver le compte" : "Desactiver le compte"
      });
      actions.push({ id: "delete-account", label: "Supprimer le compte", danger: true });
    }

    return actions;
  }

  function runAccountAction(actionId, accountId) {
    if (actionId === "manage-holidays") {
      var account = utils.findById(db.users, accountId);
      if (account) {
        openHolidaySheet(account);
      }
      return;
    }

    if (actionId === "send-password-reset") {
      forms.sendPasswordReset(accountId);
      return;
    }

    if (actionId === "toggle-active") {
      forms.toggleAccountActive(accountId);
      return;
    }

    if (actionId === "delete-account") {
      forms.deleteAccount(accountId);
    }
  }

  function openAccountActionsSheet(account) {
    var rows = accountSecondaryActions(account);

    ui.showSheet([
      '<div class="modal-head">',
      "  <h3>Plus d'actions - " + utils.escapeHtml(account.name) + "</h3>",
      '  <button id="closeAccountActionsButton" class="x" type="button">x</button>',
      "</div>",
      '<div class="stack">' + rows.map(function (row) {
        return '<button class="secondary' + (row.danger ? " danger" : "") + '" style="width:100%" type="button" data-account-action="' +
          row.id + '">' + utils.escapeHtml(row.label) + "</button>";
      }).join("") + "</div>"
    ].join(""));

    ui.byId("closeAccountActionsButton").addEventListener("click", ui.closeSheet);

    document.querySelectorAll("[data-account-action]").forEach(function (button) {
      button.addEventListener("click", function () {
        ui.closeSheet();
        runAccountAction(button.dataset.accountAction, account.id);
      });
    });
  }

  function renderUserCard(account) {
    var totalDone = reservations.filter(function (reservation) {
      return reservation.collab === account.name && reservation.status === "done";
    });
    var totalRevenue = totalDone.reduce(function (sum, reservation) {
      var basePrice = reservation.price != null
        ? reservation.price
        : (db.prestations.find(function (item) { return item.name === reservation.prestation; }) || {}).price || 0;
      return sum + basePrice + (reservation.supplement || 0);
    }, 0);
    var upcoming = reservations.filter(function (reservation) {
      return reservation.collab === account.name && reservation.status === "pre";
    }).length;

    return [
      '<div class="card">',
      '  <div class="profile-card-head">',
      ui.renderUserProfile(account.name, {
        className: "profile-user-card",
        avatarClassName: "profile-avatar-md",
        nameClassName: "profile-name-card",
        photoSrc: account.photo
      }),
      "  </div>",
      '  <div class="statgrid">',
      renderStatButton(account.name, "day"),
      renderStatButton(account.name, "week"),
      renderStatButton(account.name, "month"),
      "  </div>",
      '  <div class="meta">',
      '    <span class="badge">Recette totale ' + totalRevenue + ' EUR</span>',
      '    <span class="badge">' + totalDone.length + ' termines</span>',
      '    <span class="badge">' + upcoming + ' a venir</span>',
      '    <span class="badge">' + domain.countFor(virtualDb(), account.name, "cancel", "month", selectedDate) + ' annules ce mois</span>',
      accountBadges(account),
      "  </div>",
      '  <div class="row">',
      '    <button class="secondary" type="button" data-edit-profile="' + account.id + '">Modifier</button>',
      '    <button class="secondary" type="button" data-account-menu="' + account.id + '">Plus d actions</button>',
      "  </div>",
      "</div>"
    ].join("");
  }

  function renderAdminCard(account) {
    return [
      '<div class="card">',
      '  <div class="profile-card-head">',
      ui.renderUserProfile(account.name, {
        className: "profile-user-card",
        avatarClassName: "profile-avatar-md",
        nameClassName: "profile-name-card",
        photoSrc: account.photo
      }),
      "  </div>",
      '  <div class="meta"><span class="badge">Administrateur</span>' + accountBadges(account) + "</div>",
      '  <div class="row">',
      '    <button class="secondary" type="button" data-edit-profile="' + account.id + '">Modifier</button>',
      '    <button class="secondary" type="button" data-account-menu="' + account.id + '">Plus d actions</button>',
      "  </div>",
      "</div>"
    ].join("");
  }

  function renderOwnCard() {
    var myHolidays = forms.holidaysForCollab(holidays, user.name);

    return [
      '<div class="card">',
      "  <h3>Mon profil</h3>",
      ui.renderUserProfile(user.name, {
        className: "profile-user-card profile-user-card-self",
        avatarClassName: "profile-avatar-md",
        nameClassName: "profile-name-card",
        photoSrc: user.photo
      }),
      '  <div class="tiny">Tu vois uniquement ton propre compte.</div>',
      '  <div class="statgrid">',
      renderStatButton(user.name, "day"),
      renderStatButton(user.name, "week"),
      renderStatButton(user.name, "month"),
      "  </div>",
      '  <button id="editOwnProfile" class="primary" type="button">Modifier mon profil / mot de passe</button>',
      "</div>",
      '<div class="card">',
      '  <div class="row">',
      '    <div class="grow"><h3>Mes congés</h3></div>',
      '    <button id="addHolidayButton" class="primary" type="button">+ Ajouter</button>',
      "  </div>",
      '  <div id="myHolidayList" class="stack" style="margin-top:12px">' +
        (myHolidays.length ? myHolidays.map(function (item) { return forms.holidayCard(item, false); }).join("") : '<p class="tiny">Aucun conge enregistre.</p>') +
        "</div>",
      "</div>"
    ].join("");
  }

  function bindActions() {
    var addButton = ui.byId("addAccountButton");
    if (addButton) {
      addButton.addEventListener("click", function () {
        forms.openAddAccountForm();
      });
    }

    var ownButton = ui.byId("editOwnProfile");
    if (ownButton) {
      ownButton.addEventListener("click", function () {
        forms.openProfileForm(user.id);
      });
    }

    var addHolidayButton = ui.byId("addHolidayButton");
    if (addHolidayButton) {
      addHolidayButton.addEventListener("click", function () {
        forms.openHolidayForm(null, user.name);
      });
    }

    var myHolidayList = ui.byId("myHolidayList");
    if (myHolidayList) {
      forms.bindHolidayCardActions(myHolidayList);
    }

    document.querySelectorAll("[data-edit-profile]").forEach(function (button) {
      button.addEventListener("click", function () {
        forms.openProfileForm(button.dataset.editProfile);
      });
    });

    document.querySelectorAll("[data-history-collab]").forEach(function (button) {
      button.addEventListener("click", function () {
        openHistorySheet(button.dataset.historyCollab, button.dataset.historyRange);
      });
    });

    document.querySelectorAll("[data-account-menu]").forEach(function (button) {
      button.addEventListener("click", function () {
        var account = utils.findById(db.users, button.dataset.accountMenu);
        if (account) {
          openAccountActionsSheet(account);
        }
      });
    });
  }

  function showLoadError(error) {
    ui.setMain([
      '<div class="card">',
      '  <div class="alert">Impossible de charger les rendez-vous depuis Supabase. Verifiez la configuration et votre connexion.</div>',
      "</div>"
    ].join(""));
    window.console && window.console.error && window.console.error(error);
  }

  function render() {
    // L'admin doit voir tous les comptes, pas seulement ceux qui se sont
    // deja connectes sur cet appareil (chaque appareil a son propre
    // stockage local) : on recupere donc la vraie liste Supabase et on met
    // a jour la fiche locale de chacun avant d'afficher quoi que ce soit.
    var profilesPromise = auth.isAdmin(user) ? supabaseData.listProfiles() : Promise.resolve(null);

    return Promise.all([
      supabaseData.listAllReservations(),
      profilesPromise,
      supabaseData.listBlockedPeriods()
    ]).then(function (results) {
      reservations = results[0];
      var profiles = results[1];
      holidays = results[2].filter(function (item) { return item.kind === "holiday"; });

      if (profiles) {
        auth.syncProfilesToLocal(profiles);
        db = data.loadDb();
      }

      forms.configure({
        db: db,
        refresh: render,
        selectedDate: selectedDate,
        user: user,
        reservations: reservations,
        holidays: holidays
      });

      if (auth.isAdmin(user)) {
        var collabs = db.users.filter(function (account) {
          return account.role === "collab";
        });
        var admins = db.users.filter(function (account) {
          return account.role === "admin";
        });

        ui.setMain([
          '<div class="card">',
          "  <h3>Comptes collaborateurs</h3>",
          '  <div class="tiny">L admin voit les recettes de chaque collaborateur individuellement.</div>',
          '  <button id="addAccountButton" class="primary" style="width:100%;margin-top:10px" type="button">Ajouter un collaborateur</button>',
          "</div>",
          '<div class="cards">',
          collabs.map(renderUserCard).join(""),
          "</div>",
          '<div class="card">',
          "  <h3>Comptes administrateurs</h3>",
          "</div>",
          '<div class="cards">',
          admins.map(renderAdminCard).join(""),
          "</div>"
        ].join(""));
      } else {
        ui.setMain(renderOwnCard());
      }

      bindActions();
    }).catch(showLoadError);
  }

  render();
}());
