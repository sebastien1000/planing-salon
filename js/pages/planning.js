(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var forms = window.SalonForms;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  var user = ui.initAppPage({
    activePage: "planning",
    actions: { fab: true, photo: true },
    pageTitle: "Planning"
  });

  if (!user) {
    return;
  }

  var db = data.loadDb();
  var view = sessionStorage.getItem("planning:view") || "day";
  var roomFilter = sessionStorage.getItem("planning:room") || "Toutes";
  var selectedDate = sessionStorage.getItem("planning:date") || utils.today();

  function collaboratorClassName(name) {
    return "collab-" + String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
  }

  ui.bindActionButton("fabButton", function () {
    forms.openReservation();
  });

  forms.configure({
    db: db,
    refresh: render,
    selectedDate: selectedDate,
    user: user
  });
  forms.bindPhotoInput();

  function persistState() {
    sessionStorage.setItem("planning:view", view);
    sessionStorage.setItem("planning:room", roomFilter);
    sessionStorage.setItem("planning:date", selectedDate);
  }

  function movePlanning(direction) {
    if (view === "day") {
      selectedDate = utils.addDays(selectedDate, direction);
    } else if (view === "week") {
      selectedDate = utils.addDays(selectedDate, direction * 7);
    } else {
      var date = utils.dateObj(selectedDate);
      date.setMonth(date.getMonth() + direction);
      selectedDate = utils.iso(date);
    }

    persistState();
    render();
  }

  function viewLabel() {
    if (view === "day") {
      return utils.fmtDate(selectedDate);
    }

    if (view === "week") {
      return "Semaine du " + utils.fmtDate(utils.startWeek(selectedDate));
    }

    return utils.dateObj(selectedDate).toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric"
    });
  }

  function visibleDates() {
    if (view === "week") {
      return domain.datesForRange(selectedDate, "week");
    }

    if (view === "month") {
      return utils.monthDates(selectedDate);
    }

    return [selectedDate];
  }

  function renderHeader(visibleReservations) {
    return [
      '<div class="card page-header-card">',
      '  <div class="row">',
      '    <button id="planningPrev" class="secondary" type="button">‹</button>',
      '    <div class="grow">',
      '      <div class="section-title">Vue planning modifiable</div>',
      "      <h3>" + viewLabel() + "</h3>",
      "    </div>",
      '    <button id="planningNext" class="secondary" type="button">›</button>',
      "  </div>",
      '  <input id="planningDate" class="field" type="date" value="' + selectedDate + '" style="margin-top:8px">',
      '  <div class="chips">' + ["day", "week", "month"].map(function (item) {
        var label = item === "day" ? "Jour" : (item === "week" ? "Semaine" : "Mois");
        var className = item === view ? "chip active" : "chip";
        return '<button class="' + className + '" type="button" data-view="' + item + '">' + label + "</button>";
      }).join("") + "</div>",
      '  <div class="statgrid statgrid-2">',
      '    <div class="stat"><b>' + visibleReservations.length + '</b><span>RDV affiches</span></div>',
      '    <div class="stat"><b>' + visibleReservations.filter(function (item) { return item.status === "done"; }).length + '</b><span>Termines</span></div>',
      "  </div>",
      '  <button id="headerAddReservation" class="primary" type="button" style="width:100%">Ajouter un RDV</button>',
      "</div>",
      '<div class="chips">' + ["Toutes"].concat(data.ROOMS).map(function (room) {
        var className = room === roomFilter ? "chip active" : "chip";
        return '<button class="' + className + '" type="button" data-room="' + room + '">' + room + "</button>";
      }).join("") + "</div>"
    ].join("");
  }

  function renderMonth(dates) {
    var firstDay = utils.dateObj(utils.startMonth(selectedDate));
    var blanks = (firstDay.getDay() + 6) % 7;
    var labels = ["L", "M", "M", "J", "V", "S", "D"].map(function (label) {
      return '<div class="tiny" style="text-align:center;font-weight:900">' + label + "</div>";
    }).join("");

    return [
      '<div class="card">',
      '  <div class="month-grid">',
      labels,
      Array.from({ length: blanks }).map(function () {
        return "<div></div>";
      }).join(""),
      dates.map(function (date) {
        var reservations = db.reservations.filter(function (reservation) {
          return reservation.date === date &&
            (roomFilter === "Toutes" || reservation.room === roomFilter);
        });
        var absences = db.absences.filter(function (absence) {
          return absence.date === date &&
            (auth.isAdmin(user) || absence.collab === user.name);
        });

        return [
          '<button class="month-cell ' + ((reservations.length || absences.length) ? "has" : "") +
            (date === utils.today() ? " today" : "") + '" type="button" data-open-day="' + date + '">',
          '  <span class="day-num">' + utils.dateObj(date).getDate() + "</span>",
          reservations.slice(0, 2).map(function (reservation) {
            var isMine = reservation.collab === user.name;
            var dotClassName = [
              "dot",
              "planning-dot-" + collaboratorClassName(reservation.collab),
              isMine ? "planning-dot-own" : "planning-dot-other"
            ].join(" ");
            var label = auth.canSeeReservation(user, reservation)
              ? reservation.client
              : "Reserve - " + reservation.collab;
            return '<span class="' + dotClassName + '">' + utils.escapeHtml(label + " - " + reservation.time) + "</span>";
          }).join(""),
          absences.length ? '<span class="dot">Blocage ' + absences.length + "</span>" : "",
          reservations.length > 2 ? '<span class="dot">+' + (reservations.length - 2) + " autre</span>" : "",
          "</button>"
        ].join("");
      }).join(""),
      "  </div>",
      '  <p class="tiny">Touchez un jour pour ouvrir la vue jour.</p>',
      "</div>"
    ].join("");
  }

  function renderDays(dates) {
    return '<div class="cards">' + dates.map(function (date) {
      var reservations = db.reservations.filter(function (reservation) {
        return reservation.date === date &&
          (roomFilter === "Toutes" || reservation.room === roomFilter);
      });
      var absences = db.absences.filter(function (absence) {
        return absence.date === date &&
          (auth.isAdmin(user) || absence.collab === user.name);
      });

      return [
        '<div class="card">',
        '  <div class="week-day-head">',
        "    <h3>" + utils.fmtDate(date) + "</h3>",
        '    <button class="secondary mini-action" type="button" data-add-date="' + date + '">+ RDV</button>',
        "  </div>",
        absences.map(function (absence) {
          return [
            '<div class="card absence-slot">',
            "  <b>Blocage " + utils.escapeHtml(absence.label) + "</b>",
            '  <div class="meta">',
            '    <span class="badge">' + utils.escapeHtml(absence.collab) + "</span>",
            '    <span class="badge">' + utils.escapeHtml(absence.time) + " - " + absence.duration + " min</span>",
            "  </div>",
            "</div>"
          ].join("");
        }).join(""),
        reservations.length ? reservations.map(forms.reservationCard).join("") : '<div class="empty">Aucune reservation</div>',
        "</div>"
      ].join("");
    }).join("") + "</div>";
  }

  function bindPlanningEvents() {
    ui.byId("planningPrev").addEventListener("click", function () {
      movePlanning(-1);
    });

    ui.byId("planningNext").addEventListener("click", function () {
      movePlanning(1);
    });

    ui.byId("planningDate").addEventListener("change", function (event) {
      selectedDate = event.target.value;
      persistState();
      render();
    });

    ui.byId("headerAddReservation").addEventListener("click", function () {
      forms.configure({ db: db, refresh: render, selectedDate: selectedDate, user: user });
      forms.openReservation();
    });

    document.querySelectorAll("[data-view]").forEach(function (button) {
      button.addEventListener("click", function () {
        view = button.dataset.view;
        persistState();
        render();
      });
    });

    document.querySelectorAll("[data-room]").forEach(function (button) {
      button.addEventListener("click", function () {
        roomFilter = button.dataset.room;
        persistState();
        render();
      });
    });

    document.querySelectorAll("[data-open-day]").forEach(function (button) {
      button.addEventListener("click", function () {
        selectedDate = button.dataset.openDay;
        view = "day";
        persistState();
        render();
      });
    });

    document.querySelectorAll("[data-add-date]").forEach(function (button) {
      button.addEventListener("click", function () {
        selectedDate = button.dataset.addDate;
        persistState();
        forms.configure({ db: db, refresh: render, selectedDate: selectedDate, user: user });
        forms.openReservation();
      });
    });

    forms.bindReservationCardActions(document);
  }

  function render() {
    forms.configure({
      db: db,
      refresh: render,
      selectedDate: selectedDate,
      user: user
    });

    var dates = visibleDates();
    var reservations = db.reservations.filter(function (reservation) {
      return dates.includes(reservation.date) &&
        (roomFilter === "Toutes" || reservation.room === roomFilter);
    });

    var content = renderHeader(reservations);
    content += view === "month" ? renderMonth(dates) : renderDays(dates);
    ui.setMain(content);
    bindPlanningEvents();
  }

  render();
}());
