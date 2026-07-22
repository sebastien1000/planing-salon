(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var forms = window.SalonForms;
  var supabaseData = window.SalonSupabaseData;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  var user = ui.initAppPage({
    activePage: "planning",
    actions: { fab: true },
    pageTitle: "Planning"
  });

  if (!user) {
    return;
  }

  var db = data.loadDb();
  // Marion prefere ouvrir le planning directement sur la vue mois plutot
  // que jour ; un choix de vue deja fait avant (sessionStorage) reste
  // toujours prioritaire.
  var view = sessionStorage.getItem("planning:view") || (user.name === "Marion" ? "month" : "day");
  var roomFilter = sessionStorage.getItem("planning:room") || "Toutes";
  // Toutes les collaboratrices (et l'admin) voient par defaut TOUS les RDV
  // (les siens en clair, ceux des autres hachures/anonymises via
  // reservation.client masque par reservations_public + auth.canSeeReservation)
  // : c'est necessaire pour reperer une salle deja prise et eviter une
  // double reservation. Filtrer sur une seule collaboratrice reste possible
  // via le menu "Filtres", mais n'est plus jamais le choix par defaut. Un
  // choix de filtre deja fait avant (sessionStorage) reste toujours
  // prioritaire.
  var collabFilter = sessionStorage.getItem("planning:collab") || "Toutes";
  var selectedDate = sessionStorage.getItem("planning:date") || utils.today();
  var showTypes = loadShowTypes();
  var roomOccupancyFilter = loadRoomOccupancyFilter();

  // Clientes/rendez-vous/profils viennent de Supabase, rafraichis a chaque
  // render() ; le reste (collaborateurs, prestations, absences, conges)
  // reste dans localStorage via db.
  var reservations = [];
  var clients = [];
  var profiles = [];

  function loadShowTypes() {
    try {
      var parsed = JSON.parse(sessionStorage.getItem("planning:showTypes"));
      return {
        reservations: parsed ? parsed.reservations !== false : true,
        absences: parsed ? parsed.absences !== false : true,
        holidays: parsed ? parsed.holidays !== false : true
      };
    } catch (error) {
      return { reservations: true, absences: true, holidays: true };
    }
  }

  function loadRoomOccupancyFilter() {
    try {
      var parsed = JSON.parse(sessionStorage.getItem("planning:roomOccupancy"));
      return { occupee: !!(parsed && parsed.occupee), libre: !!(parsed && parsed.libre) };
    } catch (error) {
      return { occupee: false, libre: false };
    }
  }

  ui.bindActionButton("fabButton", function () {
    forms.openReservation();
  });

  function persistState() {
    sessionStorage.setItem("planning:view", view);
    sessionStorage.setItem("planning:room", roomFilter);
    sessionStorage.setItem("planning:collab", collabFilter);
    sessionStorage.setItem("planning:date", selectedDate);
    sessionStorage.setItem("planning:showTypes", JSON.stringify(showTypes));
    sessionStorage.setItem("planning:roomOccupancy", JSON.stringify(roomOccupancyFilter));
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

  function categoryLabelFor(type, category) {
    var list = type === "holiday" ? data.HOLIDAY_CATEGORIES : data.ABSENCE_CATEGORIES;
    var pair = list.find(function (item) { return item[0] === category; });
    return pair ? pair[1] : category;
  }

  function canSeeBlockedDetail(type, collab) {
    return type === "holiday" || auth.isAdmin(user) || collab === user.name;
  }

  function matchesCollabFilter(collab) {
    return collabFilter === "Toutes" || collab === collabFilter;
  }

  function blockedPeriodsOnDate(date) {
    var absences = showTypes.absences
      ? db.absences
        .filter(function (item) { return domain.periodCoversDate(item, date) && matchesCollabFilter(item.collab); })
        .map(function (item) { return Object.assign({ type: "absence" }, item); })
      : [];
    var holidays = showTypes.holidays
      ? db.holidays
        .filter(function (item) { return domain.periodCoversDate(item, date) && matchesCollabFilter(item.collab); })
        .map(function (item) { return Object.assign({ type: "holiday" }, item); })
      : [];
    return absences.concat(holidays);
  }

  function filteredReservationsForDate(date) {
    if (!showTypes.reservations) {
      return [];
    }

    return reservations.filter(function (reservation) {
      return reservation.date === date &&
        (roomFilter === "Toutes" || reservation.room === roomFilter) &&
        matchesCollabFilter(reservation.collab);
    });
  }

  function filteredReservations(dates) {
    return dates.reduce(function (acc, date) {
      return acc.concat(filteredReservationsForDate(date));
    }, []);
  }

  // Rendez-vous actifs d'une salle pour la date choisie, a partir des
  // rendez-vous deja recuperes depuis Supabase pour la vue courante
  // (selectedDate fait toujours partie des dates visibles).
  function roomReservationsForSelectedDate(room) {
    return reservations.filter(function (item) {
      return item.room === room && item.date === selectedDate && domain.isActiveReservation(item);
    }).sort(function (a, b) { return a.time.localeCompare(b.time); });
  }

  var ROOM_STATUS_LABELS = { libre: "Libre", reservee: "Reservee", occupee: "Occupee" };
  var ROOM_STATUS_BADGE_CLASS = { libre: "status-done", reservee: "status-pre", occupee: "status-run" };

  function roomStatusListHtml() {
    var isToday = selectedDate === utils.today();
    var nowTime = new Date().toTimeString().slice(0, 5);
    var occupancyFilterActive = roomOccupancyFilter.occupee || roomOccupancyFilter.libre;

    var rooms = data.ROOMS.filter(function (room) {
      if (!occupancyFilterActive) {
        return true;
      }

      var status = domain.roomStatus(roomReservationsForSelectedDate(room), isToday, nowTime);
      var isFree = status === "libre";
      return (roomOccupancyFilter.libre && isFree) || (roomOccupancyFilter.occupee && !isFree);
    });

    if (!rooms.length) {
      return '<p class="tiny">Aucune salle ne correspond a ce filtre.</p>';
    }

    return rooms.map(function (room) {
      var allRoomReservations = roomReservationsForSelectedDate(room);
      // Le badge Occupee/Libre doit toujours refleter l'occupation reelle de
      // la salle (toutes collaboratrices confondues), meme si le filtre
      // "Collaborateur" est reduit a une seule personne : sinon une salle
      // deja prise par l'autre collaboratrice apparaitrait a tort "Libre"
      // et exposerait au risque de double reservation que ce planning doit
      // justement empecher.
      var status = domain.roomStatus(allRoomReservations, isToday, nowTime);
      var roomReservations = allRoomReservations
        .filter(function (item) { return matchesCollabFilter(item.collab); });

      var slotsHtml = roomReservations.map(function (reservation) {
        var canSee = auth.canSeeReservation(user, reservation);
        var who = canSee ? reservation.client : "Reserve - " + reservation.collab;
        var endTime = domain.addMinutes(reservation.time, reservation.duration);

        return [
          '<div class="row" style="justify-content:space-between">',
          '  <div class="grow">',
          "    <b>" + utils.escapeHtml(who) + "</b>",
          '    <div class="tiny">' + utils.escapeHtml(reservation.collab) + "</div>",
          "  </div>",
          '  <span class="badge">' + utils.escapeHtml(reservation.time) + " - " + utils.escapeHtml(endTime) + "</span>",
          "</div>"
        ].join("");
      }).join("");

      return [
        '<div class="card">',
        '  <div class="row" style="justify-content:space-between">',
        "    <h3>" + utils.escapeHtml(room) + "</h3>",
        '    <span class="badge ' + ROOM_STATUS_BADGE_CLASS[status] + '">' + ROOM_STATUS_LABELS[status] + "</span>",
        "  </div>",
        slotsHtml || '<p class="tiny">Aucun rendez-vous ce jour.</p>',
        "</div>"
      ].join("");
    }).join("");
  }

  function activeFilterSummary() {
    var parts = [];

    if (collabFilter !== "Toutes") {
      parts.push(collabFilter);
    }

    if (roomFilter !== "Toutes") {
      parts.push(roomFilter);
    }

    if (!showTypes.reservations) {
      parts.push("RDV masques");
    }

    if (!showTypes.absences) {
      parts.push("Absences masquees");
    }

    if (!showTypes.holidays) {
      parts.push("Conges masques");
    }

    return parts.join(" · ");
  }

  function collabFilterOptions() {
    return ["Toutes"].concat(
      db.users.filter(function (item) { return item.role === "collab"; }).map(function (item) { return item.name; })
    );
  }

  function buildTypeCheckboxHtml(key, label) {
    return [
      '<label class="checkbox-line">',
      '  <input type="checkbox" data-filter-type="' + key + '"' + (showTypes[key] ? " checked" : "") + '>',
      "  " + label,
      "</label>"
    ].join("");
  }

  function buildOccupancyCheckboxHtml(key, label) {
    return [
      '<label class="checkbox-line">',
      '  <input type="checkbox" data-filter-occupancy="' + key + '"' + (roomOccupancyFilter[key] ? " checked" : "") + '>',
      "  " + label,
      "</label>"
    ].join("");
  }

  function openFilterMenu() {
    ui.showSheet([
      '<div class="modal-head">',
      "  <h3>Filtres du planning</h3>",
      "</div>",

      '<div class="section-title">Collaborateur</div>',
      '<div class="chips">' + collabFilterOptions().map(function (name) {
        var className = name === collabFilter ? "chip active" : "chip";
        return '<button class="' + className + '" type="button" data-filter-collab="' + utils.escapeHtml(name) + '">' +
          utils.escapeHtml(name) + "</button>";
      }).join("") + "</div>",

      '<div class="section-title" style="margin-top:14px">Salle</div>',
      '<div class="chips">' + ["Toutes"].concat(data.ROOMS).map(function (room) {
        var className = room === roomFilter ? "chip active" : "chip";
        return '<button class="' + className + '" type="button" data-filter-room="' + utils.escapeHtml(room) + '">' +
          utils.escapeHtml(room) + "</button>";
      }).join("") + "</div>",

      '<div class="section-title" style="margin-top:14px">Afficher</div>',
      '<div class="checkbox-group">',
      buildTypeCheckboxHtml("reservations", "Rendez-vous"),
      buildTypeCheckboxHtml("absences", "Absences"),
      buildTypeCheckboxHtml("holidays", "Conges / vacances"),
      "</div>",

      '<div class="section-title" style="margin-top:14px">Filtrer les salles par etat</div>',
      '<div class="checkbox-group">',
      buildOccupancyCheckboxHtml("occupee", "Salles occupees"),
      buildOccupancyCheckboxHtml("libre", "Salles libres"),
      "</div>",

      '<div class="row" style="margin-top:16px">',
      '  <button id="showAllFilterButton" class="secondary grow" type="button">Tout afficher</button>',
      '  <button id="resetFilterButton" class="secondary danger grow" type="button">Reinitialiser les filtres</button>',
      "</div>",

      '<div class="section-title" style="margin-top:18px">Salles - ' + utils.escapeHtml(utils.fmtDate(selectedDate)) + "</div>",
      '<div id="roomStatusList" class="stack">' + roomStatusListHtml() + "</div>",

      '<button id="validateFilterButton" class="primary" style="width:100%;margin-top:16px" type="button">Valider</button>'
    ].join(""));

    bindFilterMenuEvents();
  }

  function bindFilterMenuEvents() {
    ui.byId("validateFilterButton").addEventListener("click", ui.closeSheet);

    document.querySelectorAll("[data-filter-collab]").forEach(function (button) {
      button.addEventListener("click", function () {
        collabFilter = button.dataset.filterCollab;
        persistState();
        document.querySelectorAll("[data-filter-collab]").forEach(function (btn) {
          btn.classList.toggle("active", btn === button);
        });
        render();
        var list = ui.byId("roomStatusList");
        if (list) {
          list.innerHTML = roomStatusListHtml();
        }
      });
    });

    document.querySelectorAll("[data-filter-room]").forEach(function (button) {
      button.addEventListener("click", function () {
        roomFilter = button.dataset.filterRoom;
        persistState();
        document.querySelectorAll("[data-filter-room]").forEach(function (btn) {
          btn.classList.toggle("active", btn === button);
        });
        render();
      });
    });

    document.querySelectorAll("[data-filter-type]").forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        showTypes[checkbox.dataset.filterType] = checkbox.checked;
        persistState();
        render();
      });
    });

    document.querySelectorAll("[data-filter-occupancy]").forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        roomOccupancyFilter[checkbox.dataset.filterOccupancy] = checkbox.checked;
        persistState();
        var list = ui.byId("roomStatusList");
        if (list) {
          list.innerHTML = roomStatusListHtml();
        }
      });
    });

    ui.byId("showAllFilterButton").addEventListener("click", function () {
      showTypes = { reservations: true, absences: true, holidays: true };
      persistState();
      ui.closeSheet();
      render();
      openFilterMenu();
    });

    ui.byId("resetFilterButton").addEventListener("click", function () {
      collabFilter = "Toutes";
      roomFilter = "Toutes";
      showTypes = { reservations: true, absences: true, holidays: true };
      roomOccupancyFilter = { occupee: false, libre: false };
      persistState();
      ui.closeSheet();
      render();
      openFilterMenu();
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
    var summary = activeFilterSummary();

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
      '<div class="card">',
      '  <div class="row" style="justify-content:space-between">',
      '    <div class="grow">',
      '      <div class="section-title">Filtres</div>',
      '      <div class="tiny">' + (summary ? utils.escapeHtml(summary) : "Tout affiche") + "</div>",
      "    </div>",
      '    <button id="filterMenuButton" class="secondary" type="button">☰ Filtres</button>',
      "  </div>",
      "</div>"
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
        var dateReservations = filteredReservationsForDate(date);
        var blocked = blockedPeriodsOnDate(date);

        return [
          '<button class="month-cell ' + ((dateReservations.length || blocked.length) ? "has" : "") +
            (date === utils.today() ? " today" : "") + '" type="button" data-open-day="' + date + '">',
          '  <span class="day-num">' + utils.dateObj(date).getDate() + "</span>",
          dateReservations.slice(0, 2).map(function (reservation) {
            var isMine = reservation.collab === user.name;
            var dotClassName = [
              "dot",
              isMine ? "planning-dot-own" : "planning-dot-other"
            ].join(" ");
            var collabUser = utils.findByName(db.users, reservation.collab);
            var dotStyle = collabUser && collabUser.color
              ? ' style="background:' + collabUser.color + ';color:' + utils.readableTextColor(collabUser.color) + '"'
              : "";
            var label = auth.canSeeReservation(user, reservation)
              ? reservation.client
              : "Reserve - " + reservation.collab;
            return '<span class="' + dotClassName + '"' + dotStyle + '>' + utils.escapeHtml(label + " - " + reservation.time) + "</span>";
          }).join(""),
          blocked.length ? '<span class="dot">Blocage ' + blocked.length + "</span>" : "",
          dateReservations.length > 2 ? '<span class="dot">+' + (dateReservations.length - 2) + " autre</span>" : "",
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
      var dateReservations = filteredReservationsForDate(date);
      var blocked = blockedPeriodsOnDate(date);

      return [
        '<div class="card">',
        '  <div class="week-day-head">',
        "    <h3>" + utils.fmtDate(date) + "</h3>",
        '    <button class="secondary mini-action" type="button" data-add-date="' + date + '">+ RDV</button>',
        "  </div>",
        blocked.map(function (item) {
          var visible = canSeeBlockedDetail(item.type, item.collab);
          var title = visible ? categoryLabelFor(item.type, item.category) : "Indisponible";

          return [
            '<div class="card absence-slot">',
            "  <b>" + utils.escapeHtml(title) + "</b>",
            '  <div class="meta">',
            '    <span class="badge">' + utils.escapeHtml(item.collab) + "</span>",
            '    <span class="badge">' + utils.escapeHtml(item.startTime) + " - " + utils.escapeHtml(item.endTime) + "</span>",
            (item.startDate !== item.endDate
              ? '    <span class="badge">jusqu au ' + utils.escapeHtml(item.endDate) + "</span>"
              : ""),
            "  </div>",
            (visible && item.notes ? '  <div class="tiny">' + utils.escapeHtml(item.notes) + "</div>" : ""),
            "</div>"
          ].join("");
        }).join(""),
        dateReservations.length ? dateReservations.map(forms.reservationCard).join("") : '<div class="empty">Aucune reservation</div>',
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
      forms.openReservation();
    });

    ui.byId("filterMenuButton").addEventListener("click", openFilterMenu);

    document.querySelectorAll("[data-view]").forEach(function (button) {
      button.addEventListener("click", function () {
        view = button.dataset.view;
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

  function showLoadError(error) {
    ui.setMain([
      '<div class="card">',
      '  <div class="alert">Impossible de charger le planning depuis Supabase. Verifiez la configuration (js/core/supabase-client.js) et votre connexion.</div>',
      "</div>"
    ].join(""));
    window.console && window.console.error && window.console.error(error);
  }

  function render() {
    var dates = visibleDates();

    return Promise.all([
      supabaseData.listReservationsForDates(dates),
      supabaseData.listClients(),
      supabaseData.listProfiles()
    ]).then(function (results) {
      reservations = results[0];
      clients = results[1];
      profiles = results[2];

      forms.configure({
        db: db,
        refresh: render,
        selectedDate: selectedDate,
        user: user,
        clients: clients,
        reservations: reservations,
        profiles: profiles
      });

      var content = renderHeader(filteredReservations(dates));
      content += view === "month" ? renderMonth(dates) : renderDays(dates);
      ui.setMain(content);
      bindPlanningEvents();
    }).catch(showLoadError);
  }

  forms.configure({
    db: db,
    refresh: render,
    selectedDate: selectedDate,
    user: user
  });

  render();
}());
