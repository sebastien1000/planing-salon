(function () {
  var utils = window.SalonUtils;
  var data = window.SalonData;

  // Timestamp reel (pas une comparaison de chaines) pour trier les
  // rendez-vous chronologiquement : necessaire notamment autour du
  // changement d'annee/mois, ou une comparaison purement textuelle de
  // "date" et "time" separement resterait correcte ici (formats ISO
  // zero-padded) mais serait fragile si l'un des deux champs changeait de
  // format un jour.
  function reservationTimestamp(reservation) {
    var time = reservation && reservation.time ? reservation.time : "00:00";
    return new Date((reservation && reservation.date) + "T" + time + ":00").getTime();
  }

  function compareReservationsByDateTime(a, b) {
    return reservationTimestamp(a) - reservationTimestamp(b);
  }

  function roomStatus(reservations, isToday, nowTime) {
    if (!reservations.length) {
      return "libre";
    }

    if (isToday) {
      var occupiedNow = reservations.some(function (item) {
        var start = utils.mins(item.time);
        var end = start + Number(item.duration || 0);
        var now = utils.mins(nowTime);
        return now >= start && now < end;
      });

      if (occupiedNow) {
        return "occupee";
      }
    }

    return "reservee";
  }

  function getStatusLabel(status) {
    var normalized = normalizeStatus(status);
    var pair = data.STATUS.find(function (item) {
      return normalizeStatus(item[0]) === normalized;
    });

    return pair ? pair[1] : (status || "");
  }

  function roomFor(db, collab, prestationName) {
    var user = utils.findByName(db.users, collab);

    // Salle choisie explicitement par l'admin pour cette collaboratrice
    // (ex. Marion -> Salle Ongles 2), prioritaire sur tout le reste - mais
    // seulement si elle reste dans ses salles autorisees (au cas ou les deux
    // reglages divergeraient). Distinct de "Salles autorisees" plus bas :
    // celui-ci restreint l'acces, celui-la ne fait que suggerer un choix par
    // defaut modifiable a tout moment dans le formulaire de RDV. Verifiee
    // AVANT meme de savoir si une prestation est choisie : la salle doit
    // etre deja proposee des l'ouverture du formulaire, pas seulement une
    // fois une prestation selectionnee.
    if (user && user.defaultRoom && isRoomAllowedForUser(user, user.defaultRoom)) {
      return user.defaultRoom;
    }

    var prestation = db.prestations.find(function (item) {
      return item.name === prestationName;
    });

    if (!prestation) {
      return "";
    }

    if (user && user.rooms && user.rooms.length) {
      return user.rooms[0];
    }

    if (prestation.cat === "ongles") {
      return "Salle Ongles";
    }

    if (prestation.cat === "baby") {
      return "Baby Spa";
    }

    if (prestation.cat === "noire") {
      return "Salle Noire";
    }

    return "Exterieur";
  }

  function isRoomAllowedForUser(user, room) {
    return !user || user.rooms == null || user.rooms.indexOf(room) !== -1;
  }

  function isPrestationAllowedForUser(user, prestationName) {
    return !user || user.prestations == null || user.prestations.indexOf(prestationName) !== -1;
  }

  function assignmentError(db, reservation) {
    var user = utils.findByName(db.users, reservation.collab);

    if (!user) {
      return null;
    }

    if (reservation.room && !isRoomAllowedForUser(user, reservation.room)) {
      return reservation.collab + " ne peut pas utiliser la salle " + reservation.room + ".";
    }

    if (reservation.prestation && !isPrestationAllowedForUser(user, reservation.prestation)) {
      return reservation.collab + " ne peut pas proposer la prestation " + reservation.prestation + ".";
    }

    return null;
  }

  function periodStamp(date, time) {
    return date + "T" + (time || "00:00");
  }

  function slotOverlapsRange(date, time, duration, range) {
    var slotStart = periodStamp(date, time);
    var slotEnd = periodStamp(date, addMinutes(time, duration));
    var rangeStart = periodStamp(range.startDate, range.startTime || "00:00");
    var rangeEnd = periodStamp(range.endDate || range.startDate, range.endTime || "23:59");
    return slotStart < rangeEnd && slotEnd > rangeStart;
  }

  function periodCoversDate(period, date) {
    return date >= period.startDate && date <= (period.endDate || period.startDate);
  }

  function findBlockingPeriod(list, collab, date, time, duration, ignoreId) {
    return list.find(function (item) {
      return item.id !== ignoreId &&
        item.collab === collab &&
        slotOverlapsRange(date, time, duration, item);
    });
  }

  function buildConflictPayload(type, reservation, item, message) {
    var isPeriod = item && item.startDate;
    var periodTime = isPeriod ? item.startTime || "00:00" : null;
    var periodDuration = isPeriod
      ? (item.startDate === item.endDate
        ? Math.max(0, utils.mins(item.endTime || "23:59") - utils.mins(periodTime))
        : (24 * 60 - utils.mins(periodTime)))
      : null;

    return {
      type: type,
      message: message,
      reservation: item ? {
        id: item.id || "",
        client: item.client || "",
        collab: item.collab || "",
        room: item.room || "",
        date: item.date || item.startDate || reservation.date,
        time: item.time || periodTime || reservation.time,
        duration: Number(isPeriod ? periodDuration : item.duration || 0)
      } : null
    };
  }

  function conflictDetails(db, reservation, ignoreId) {
    var roomConflict;
    var collabConflict;
    var holidayConflict;
    var absenceConflict;

    roomConflict = db.reservations.find(function (item) {
      return item.id !== ignoreId &&
        item.date === reservation.date &&
        item.room === reservation.room &&
        isActiveReservation(item) &&
        utils.overlaps(item.time, item.duration, reservation.time, reservation.duration);
    });

    if (roomConflict && reservation.room !== "Exterieur") {
      return buildConflictPayload(
        "room",
        reservation,
        roomConflict,
        "Conflit : " + reservation.room + " est deja reservee a " + roomConflict.time + "."
      );
    }

    collabConflict = db.reservations.find(function (item) {
      return item.id !== ignoreId &&
        item.date === reservation.date &&
        item.collab === reservation.collab &&
        isActiveReservation(item) &&
        utils.overlaps(item.time, item.duration, reservation.time, reservation.duration);
    });

    if (collabConflict) {
      return buildConflictPayload(
        "collab",
        reservation,
        collabConflict,
        "Conflit : " + reservation.collab + " a deja un rendez-vous a " + collabConflict.time + "."
      );
    }

    holidayConflict = findBlockingPeriod(
      db.holidays,
      reservation.collab,
      reservation.date,
      reservation.time,
      reservation.duration,
      ignoreId
    );

    if (holidayConflict) {
      return buildConflictPayload(
        "holiday",
        reservation,
        holidayConflict,
        "Conflit : " + reservation.collab + " est en conge sur ce creneau."
      );
    }

    absenceConflict = findBlockingPeriod(
      db.absences,
      reservation.collab,
      reservation.date,
      reservation.time,
      reservation.duration,
      ignoreId
    );

    if (absenceConflict) {
      return buildConflictPayload(
        "absence",
        reservation,
        absenceConflict,
        "Conflit : " + reservation.collab + " est indisponible sur ce creneau."
      );
    }

    return null;
  }

  function conflict(db, reservation, ignoreId) {
    var details = conflictDetails(db, reservation, ignoreId);
    return details ? details.message : null;
  }

  function isActiveReservation(reservation) {
    return !isCancelled(reservation);
  }

  function normalizeStatus(status) {
    return String(status || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function isCancelled(reservation) {
    var normalized = normalizeStatus(reservation && reservation.status);
    return normalized === "cancel" ||
      normalized === "cancelled" ||
      normalized === "annule";
  }

  function addMinutes(time, duration) {
    var total = utils.mins(time) + Number(duration || 0);
    var hours = Math.floor(total / 60);
    var minutes = total % 60;
    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
  }

  // Grille horaire (vues jour/semaine) : 08h-20h par defaut (horaires
  // habituels du salon), elargie automatiquement (arrondie a l'heure
  // pleine) si un rendez-vous deborde de cette plage, pour ne jamais
  // couper un RDV existant hors champ.
  var DAY_GRID_DEFAULT_START = 8 * 60;
  var DAY_GRID_DEFAULT_END = 20 * 60;
  var DAY_GRID_SLOT_MINUTES = 30;

  function minutesToTime(totalMinutes) {
    var hours = Math.floor(totalMinutes / 60);
    var minutes = totalMinutes % 60;
    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
  }

  function dayGridRange(reservations) {
    var start = DAY_GRID_DEFAULT_START;
    var end = DAY_GRID_DEFAULT_END;

    reservations.forEach(function (reservation) {
      var reservationStart = utils.mins(reservation.time);
      var reservationEnd = reservationStart + Number(reservation.duration || 0);
      start = Math.min(start, Math.floor(reservationStart / 60) * 60);
      end = Math.max(end, Math.ceil(reservationEnd / 60) * 60);
    });

    return { start: start, end: end };
  }

  // Un repere toutes les 30 min : heure pleine (08:00) mise en avant,
  // demi-heure (08:30) plus discrete (voir isHour cote CSS/JS appelant).
  function dayGridSlots(range) {
    var slots = [];

    for (var minutes = range.start; minutes <= range.end; minutes += DAY_GRID_SLOT_MINUTES) {
      slots.push({
        minutes: minutes,
        isHour: minutes % 60 === 0,
        label: minutesToTime(minutes)
      });
    }

    return slots;
  }

  // Deux rendez-vous au meme horaire (salles differentes) doivent
  // s'afficher cote a cote plutot que de se superposer visuellement :
  // "bin packing" classique - chaque rendez-vous prend la premiere colonne
  // libre parmi ceux encore actifs, regroupes par chevauchement transitif
  // pour calculer le nombre total de colonnes necessaires par groupe.
  function layoutDayGridEvents(reservations) {
    var sorted = reservations.slice().sort(function (a, b) {
      return utils.mins(a.time) - utils.mins(b.time);
    });

    var active = [];
    var group = [];
    var groups = [];

    sorted.forEach(function (reservation) {
      var start = utils.mins(reservation.time);
      var end = start + Number(reservation.duration || 0);

      active = active.filter(function (item) { return item.end > start; });

      if (!active.length && group.length) {
        groups.push(group);
        group = [];
      }

      var usedColumns = active.map(function (item) { return item.column; });
      var column = 0;
      while (usedColumns.indexOf(column) !== -1) {
        column += 1;
      }

      reservation._gridColumn = column;
      active.push({ column: column, end: end });
      group.push(reservation);
    });

    if (group.length) {
      groups.push(group);
    }

    groups.forEach(function (groupItems) {
      var columns = groupItems.reduce(function (max, item) {
        return Math.max(max, item._gridColumn);
      }, 0) + 1;

      groupItems.forEach(function (item) {
        item._gridColumns = columns;
      });
    });

    return sorted;
  }

  function fullDateLabel(value) {
    return utils.dateObj(value).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
  }

  function datesForRange(selectedDate, range) {
    if (range === "day") {
      return [selectedDate];
    }

    if (range === "week") {
      var start = utils.startWeek(selectedDate);
      return Array.from({ length: 7 }, function (_, index) {
        return utils.addDays(start, index);
      });
    }

    return utils.monthDates(selectedDate);
  }

  function doneReservationsFor(db, collab, range, selectedDate) {
    var dates = datesForRange(selectedDate, range);

    return db.reservations
      .filter(function (reservation) {
        return reservation.collab === collab &&
          reservation.status === "done" &&
          dates.includes(reservation.date);
      })
      .map(function (reservation) {
        // Photo figee au moment du rendez-vous (reservation.price) si
        // disponible : le prix affiche ne doit jamais changer si le tarif
        // de la prestation est modifie plus tard. Pour un ancien
        // rendez-vous enregistre avant cette colonne, on retombe sur
        // l'ancien catalogue local le temps de la migration progressive.
        var basePrice = reservation.price != null
          ? reservation.price
          : (db.prestations.find(function (item) { return item.name === reservation.prestation; }) || {}).price || 0;

        return {
          id: reservation.id,
          client: reservation.client,
          prestation: reservation.prestation,
          date: reservation.date,
          time: reservation.time,
          supplement: reservation.supplement || 0,
          price: basePrice + (reservation.supplement || 0)
        };
      })
      .sort(function (a, b) {
        return a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date);
      });
  }

  function revenueFor(db, collab, range, selectedDate) {
    return doneReservationsFor(db, collab, range, selectedDate).reduce(function (sum, item) {
      return sum + item.price;
    }, 0);
  }

  function countFor(db, collab, status, range, selectedDate) {
    var dates = datesForRange(selectedDate, range);

    return db.reservations.filter(function (reservation) {
      return reservation.collab === collab &&
        reservation.status === status &&
        dates.includes(reservation.date);
    }).length;
  }


  window.SalonDomain = {
    assignmentError: assignmentError,
    conflict: conflict,
    conflictDetails: conflictDetails,
    countFor: countFor,
    datesForRange: datesForRange,
    dayGridRange: dayGridRange,
    dayGridSlots: dayGridSlots,
    layoutDayGridEvents: layoutDayGridEvents,
    minutesToTime: minutesToTime,
    DAY_GRID_SLOT_MINUTES: DAY_GRID_SLOT_MINUTES,
    doneReservationsFor: doneReservationsFor,
    findBlockingPeriod: findBlockingPeriod,
    fullDateLabel: fullDateLabel,
    getStatusLabel: getStatusLabel,
    isCancelled: isCancelled,
    isActiveReservation: isActiveReservation,
    isPrestationAllowedForUser: isPrestationAllowedForUser,
    isRoomAllowedForUser: isRoomAllowedForUser,
    normalizeStatus: normalizeStatus,
    periodCoversDate: periodCoversDate,
    revenueFor: revenueFor,
    roomFor: roomFor,
    roomStatus: roomStatus,
    compareReservationsByDateTime: compareReservationsByDateTime,
    slotOverlapsRange: slotOverlapsRange,
    addMinutes: addMinutes
  };
}());
