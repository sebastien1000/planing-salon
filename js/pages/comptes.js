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

  function renderUserCard(account) {
    var totalDone = db.reservations.filter(function (reservation) {
      return reservation.collab === account.name && reservation.status === "done";
    });
    var totalRevenue = totalDone.reduce(function (sum, reservation) {
      var prestation = db.prestations.find(function (item) {
        return item.name === reservation.prestation;
      });
      return sum + (prestation ? prestation.price : 0);
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
      '    <div class="stat"><b>' + domain.revenueFor(db, account.name, "day", selectedDate) + 'EUR</b><span>Aujourd\'hui</span></div>',
      '    <div class="stat"><b>' + domain.revenueFor(db, account.name, "week", selectedDate) + 'EUR</b><span>Semaine</span></div>',
      '    <div class="stat"><b>' + domain.revenueFor(db, account.name, "month", selectedDate) + 'EUR</b><span>Mois</span></div>',
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
      '    <div class="stat"><b>' + domain.revenueFor(db, user.name, "day", selectedDate) + 'EUR</b><span>Aujourd\'hui</span></div>',
      '    <div class="stat"><b>' + domain.revenueFor(db, user.name, "week", selectedDate) + 'EUR</b><span>Semaine</span></div>',
      '    <div class="stat"><b>' + domain.revenueFor(db, user.name, "month", selectedDate) + 'EUR</b><span>Mois</span></div>',
      "  </div>",
      '  <button id="editOwnProfile" class="primary" type="button">Modifier mon profil / mot de passe</button>',
      "</div>"
    ].join("");
  }

  function bindActions() {
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
  }

  function render() {
    if (auth.isAdmin(user)) {
      var collabs = db.users.filter(function (account) {
        return account.role === "collab";
      });

      ui.setMain([
        '<div class="card">',
        "  <h3>Comptes collaboratrices</h3>",
        '  <div class="tiny">L admin voit les recettes de chaque collaboratrice individuellement.</div>',
        "</div>",
        '<div class="cards">',
        collabs.map(renderUserCard).join(""),
        "</div>"
      ].join(""));
    } else {
      ui.setMain(renderOwnCard());
    }

    bindActions();
  }

  render();
}());
