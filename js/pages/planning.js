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
  // reservations_public + auth.canSeeReservation) : necessaire pour reperer
  // une salle deja prise et eviter une double reservation. Filtrer sur une
  // seule collaboratrice reste possible via le menu "Filtres", mais n'est
  // plus jamais le choix par defaut. Un choix de filtre deja fait avant
  // (sessionStorage) reste toujours prioritaire.
  var collabFilter = sessionStorage.getItem("planning:collab") || "Toutes";
  var selectedDate = sessionStorage.getItem("planning:date") || utils.today();
  var showTypes = loadShowTypes();
  var roomOccupancyFilter = loadRoomOccupancyFilter();

  // Revient sur la date du jour si "aujourd'hui" a change depuis la
  // derniere fois que ce code a tourne (localStorage : survit a une
  // fermeture complete de l'app, contrairement a sessionStorage). Necessaire
  // car sur Android/Capacitor, la WebView n'est pas forcement rechargee
  // quand l'app repasse en arriere-plan puis revient au premier plan : sans
  // ce controle, selectedDate resterait bloque en memoire sur une date
  // devenue perimee. Ne reinitialise jamais si l'utilisateur est toujours
  // le meme jour (navigation active, y compris vers une date future
  // volontairement choisie) : uniquement quand le jour civil a reellement
  // change.
  function resetSelectedDateIfNewDay() {
    var lastKnownToday = localStorage.getItem("planning:lastKnownToday");
    var currentToday = utils.today();

    localStorage.setItem("planning:lastKnownToday", currentToday);

    if (lastKnownToday && lastKnownToday !== currentToday) {
      selectedDate = currentToday;
      persistState();
      return true;
    }

    return false;
  }

  resetSelectedDateIfNewDay();

  // Couvre le retour au premier plan sans rechargement de page (app
  // mise en arriere-plan puis reprise) : sur une simple navigation entre
  // pages, le script se recharge de toute facon et l'appel ci-dessus
  // suffit deja.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && resetSelectedDateIfNewDay()) {
      render();
    }
  });

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

  // Vue mois : un badge distinct par type de blocage plutot qu'un "Blocage
  // N" generique qui melangeait conges et absences - une periode "holiday"
  // (conges/vacances) affiche "Vacances", une periode "absence" affiche
  // "Absence", chacune avec son propre compteur si plusieurs ce jour-la.
  function blockedDotsHtml(blocked) {
    var holidayCount = blocked.filter(function (item) { return item.type === "holiday"; }).length;
    var absenceCount = blocked.filter(function (item) { return item.type === "absence"; }).length;

    return [
      holidayCount ? '<span class="dot">Vacances' + (holidayCount > 1 ? " " + holidayCount : "") + "</span>" : "",
      absenceCount ? '<span class="dot">Absence' + (absenceCount > 1 ? " " + absenceCount : "") + "</span>" : ""
    ].join("");
  }

  function filteredReservationsForDate(date) {
    if (!showTypes.reservations) {
      return [];
    }

    return reservations.filter(function (reservation) {
      return reservation.date === date &&
        domain.isActiveReservation(reservation) &&
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
          blockedDotsHtml(blocked),
          dateReservations.length > 2 ? '<span class="dot">+' + (dateReservations.length - 2) + " autre</span>" : "",
          "</button>"
        ].join("");
      }).join(""),
      "  </div>",
      '  <p class="tiny">Touchez un jour pour ouvrir la vue jour.</p>',
      "</div>"
    ].join("");
  }

  // Hauteur en pixels d'une tranche de 30 min dans la grille horaire :
  // assez grand pour qu'un RDV de 30 min (le minimum) reste lisible
  // (heure + titre), la prestation ne s'ajoute qu'a partir d'1h pleine
  // (voir showDetail plus bas), pour ne jamais rendre le texte illisible.
  var GRID_SLOT_HEIGHT = 44;

  function timeGridHtml(dateReservations) {
    var range = domain.dayGridRange(dateReservations);
    var slots = domain.dayGridSlots(range);
    var slotMinutes = domain.DAY_GRID_SLOT_MINUTES;
    var totalHeight = ((range.end - range.start) / slotMinutes) * GRID_SLOT_HEIGHT;
    var laidOutReservations = domain.layoutDayGridEvents(dateReservations);

    var timesHtml = slots.map(function (slot) {
      var top = ((slot.minutes - range.start) / slotMinutes) * GRID_SLOT_HEIGHT;
      var className = "grid-time " + (slot.isHour ? "grid-time-hour" : "grid-time-half");
      return '<div class="' + className + '" style="top:' + top + 'px">' + slot.label + "</div>";
    }).join("");

    var eventsHtml = laidOutReservations.map(function (reservation) {
      var start = utils.mins(reservation.time);
      var top = ((start - range.start) / slotMinutes) * GRID_SLOT_HEIGHT;
      var height = (Number(reservation.duration || 0) / slotMinutes) * GRID_SLOT_HEIGHT;
      var columns = reservation._gridColumns || 1;
      var column = reservation._gridColumn || 0;
      var widthPct = 100 / columns;
      var leftPct = widthPct * column;

      var isMine = reservation.collab === user.name;
      var canSee = auth.canSeeReservation(user, reservation);
      // Seules les infos clientes (nom, tel, email, notes) sont
      // confidentielles pour un RDV d'une autre collaboratrice : la
      // prestation, elle, reste toujours visible (voir showPrestation).
      var title = canSee ? reservation.client : "Reserve - " + reservation.collab;
      var endTime = domain.addMinutes(reservation.time, reservation.duration);
      var collabUser = utils.findByName(db.users, reservation.collab);
      var borderStyle = collabUser && collabUser.color
        ? "border-left-color:" + utils.escapeHtml(collabUser.color) + ";"
        : "";
      // Sur un RDV masque, la prestation est l'une des seules informations
      // que la regle metier autorise a montrer : elle reste donc toujours
      // affichee, meme sur un creneau court. Sur un RDV "a soi", le detail
      // complet est de toute facon a un clic (modale), donc la prestation
      // ne s'ajoute que si la place le permet (>= 1h) pour rester lisible.
      var showPrestation = !canSee || height >= GRID_SLOT_HEIGHT * 2;
      var clickAttr = canSee ? ' data-action="view-reservation" data-id="' + reservation.id + '"' : "";

      return [
        '<div class="grid-event ' + (isMine ? "grid-event--mine" : "grid-event--other") + '"',
        ' style="top:' + top + "px;height:" + Math.max(height, GRID_SLOT_HEIGHT) + "px;left:" + leftPct + "%;width:calc(" + widthPct + "% - 4px);" + borderStyle + '"',
        clickAttr,
        ">",
        '  <div class="grid-event-time">' + utils.escapeHtml(reservation.time) + " - " + utils.escapeHtml(endTime) + " · " + utils.escapeHtml(reservation.room) + "</div>",
        '  <div class="grid-event-title">' + utils.escapeHtml(title) + "</div>",
        (showPrestation ? '  <div class="grid-event-sub">' + utils.escapeHtml(reservation.prestation) + "</div>" : ""),
        "</div>"
      ].join("");
    }).join("");

    return [
      '<div class="time-grid" style="height:' + totalHeight + 'px">',
      '  <div class="time-grid-times">' + timesHtml + "</div>",
      '  <div class="time-grid-body">' + eventsHtml + "</div>",
      "</div>"
    ].join("");
  }

  // En-tete "jour + gros numero de date", style agenda papier - partage par
  // la vue jour et la vue semaine pour rester visuellement identiques.
  function weekDayHeadTitleHtml(date) {
    return [
      '<div class="week-day-label">',
      "  <span class=\"week-day-name\">" + utils.escapeHtml(utils.weekdayLabel(date)) + "</span>",
      "  <span class=\"week-day-num" + (date === utils.today() ? " today" : "") + "\">" +
        utils.dateObj(date).getDate() + "</span>",
      "</div>"
    ].join("");
  }

  function dayCardHtml(date) {
    var dateReservations = filteredReservationsForDate(date);
    var blocked = blockedPeriodsOnDate(date);

    return [
      '<div class="card">',
      '  <div class="week-day-head">',
      weekDayHeadTitleHtml(date),
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
      timeGridHtml(dateReservations),
      "</div>"
    ].join("");
  }

  function renderDays(dates) {
    return '<div class="cards">' + dates.map(dayCardHtml).join("") + "</div>";
  }

  // Vue semaine : les 7 jours cote a cote sur une seule ligne horizontale
  // (jamais empiles verticalement), avec defilement horizontal propre sur
  // petit ecran si la largeur ne suffit pas (voir .week-grid/.week-col dans
  // css/components.css). Reutilise dayCardHtml (meme contenu que la vue
  // jour : blocages, RDV masques/hachures pour les autres collaboratrices)
  // pour ne pas dupliquer cette logique.
  function renderWeek(dates) {
    return '<div class="week-grid">' + dates.map(function (date) {
      return '<div class="week-col">' + dayCardHtml(date) + "</div>";
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
      content += view === "month" ? renderMonth(dates) : (view === "week" ? renderWeek(dates) : renderDays(dates));
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
