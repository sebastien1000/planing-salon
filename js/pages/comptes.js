(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var forms = window.SalonForms;
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

  forms.configure({
    db: db,
    refresh: render,
    selectedDate: selectedDate,
    user: user
  });

  var RANGE_LABELS = { day: "Aujourd'hui", week: "Semaine", month: "Mois" };

  function renderStatButton(collab, range) {
    return '<button class="stat" type="button" data-history-collab="' + utils.escapeHtml(collab) +
      '" data-history-range="' + range + '">' +
      "<b>" + domain.revenueFor(db, collab, range, selectedDate) + "EUR</b>" +
      "<span>" + RANGE_LABELS[range] + "</span>" +
      "</button>";
  }

  function openHistorySheet(collab, range) {
    var items = domain.doneReservationsFor(db, collab, range, selectedDate);
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

  function renderUserCard(account) {
    var totalDone = db.reservations.filter(function (reservation) {
      return reservation.collab === account.name && reservation.status === "done";
    });
    var totalRevenue = totalDone.reduce(function (sum, reservation) {
      var prestation = db.prestations.find(function (item) {
        return item.name === reservation.prestation;
      });
      return sum + (prestation ? prestation.price : 0) + (reservation.supplement || 0);
    }, 0);
    var upcoming = db.reservations.filter(function (reservation) {
      return reservation.collab === account.name && reservation.status === "pre";
    }).length;

    return [
      '<div class="card">',
      '  <div class="profile-card-head">',
      ui.renderUserProfile(account.name, {
        className: "profile-user-card",
        avatarClassName: "profile-avatar-md",
        nameClassName: "profile-name-card"
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
      '    <span class="badge">' + domain.countFor(db, account.name, "cancel", "month", selectedDate) + ' annules ce mois</span>',
      "  </div>",
      '  <div class="row">',
      '    <button class="secondary" type="button" data-edit-profile="' + account.id + '">Modifier</button>',
      '    <button class="secondary danger" type="button" data-reset-password="' + account.id + '">Reinitialiser MDP</button>',
      '    <button class="secondary" type="button" data-reset-link="' + account.id + '">Lien reset</button>',
      account.id !== user.id
        ? '    <button class="secondary danger" type="button" data-delete-account="' + account.id + '">Supprimer</button>'
        : "",
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
        nameClassName: "profile-name-card"
      }),
      "  </div>",
      '  <div class="meta"><span class="badge">Administrateur</span></div>',
      '  <div class="row">',
      '    <button class="secondary" type="button" data-edit-profile="' + account.id + '">Modifier</button>',
      '    <button class="secondary danger" type="button" data-reset-password="' + account.id + '">Reinitialiser MDP</button>',
      account.id !== user.id
        ? '    <button class="secondary danger" type="button" data-delete-account="' + account.id + '">Supprimer</button>'
        : "",
      "  </div>",
      "</div>"
    ].join("");
  }

  function renderOwnCard() {
    return [
      '<div class="card">',
      "  <h3>Mon profil</h3>",
      ui.renderUserProfile(user.name, {
        className: "profile-user-card profile-user-card-self",
        avatarClassName: "profile-avatar-md",
        nameClassName: "profile-name-card"
      }),
      '  <div class="tiny">Tu vois uniquement ton propre compte.</div>',
      '  <div class="statgrid">',
      renderStatButton(user.name, "day"),
      renderStatButton(user.name, "week"),
      renderStatButton(user.name, "month"),
      "  </div>",
      '  <button id="editOwnProfile" class="primary" type="button">Modifier mon profil / mot de passe</button>',
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

    document.querySelectorAll("[data-edit-profile]").forEach(function (button) {
      button.addEventListener("click", function () {
        forms.openProfileForm(button.dataset.editProfile);
      });
    });

    document.querySelectorAll("[data-reset-password]").forEach(function (button) {
      button.addEventListener("click", function () {
        forms.resetPassword(button.dataset.resetPassword);
      });
    });

    document.querySelectorAll("[data-reset-link]").forEach(function (button) {
      button.addEventListener("click", function () {
        forms.resetLink(button.dataset.resetLink);
      });
    });

    document.querySelectorAll("[data-history-collab]").forEach(function (button) {
      button.addEventListener("click", function () {
        openHistorySheet(button.dataset.historyCollab, button.dataset.historyRange);
      });
    });

    document.querySelectorAll("[data-delete-account]").forEach(function (button) {
      button.addEventListener("click", function () {
        forms.deleteAccount(button.dataset.deleteAccount);
      });
    });
  }

  function render() {
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
  }

  render();
}());
