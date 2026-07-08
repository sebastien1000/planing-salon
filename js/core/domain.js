(function () {
  var utils = window.SalonUtils;
  var data = window.SalonData;

  function roomReservationsForDate(db, room, date) {
    return db.reservations
      .filter(function (item) {
        return item.room === room && item.date === date && isActiveReservation(item);
      })
      .sort(function (a, b) { return a.time.localeCompare(b.time); });
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
    var prestation = db.prestations.find(function (item) {
      return item.name === prestationName;
    });

    if (!prestation) {
      return "";
    }

    var user = utils.findByName(db.users, collab);
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

  function catLabel(cat) {
    return {
      ongles: "Ongles",
      noire: "Salle Noire",
      baby: "Baby Spa",
      outside: "Exterieur"
    }[cat] || cat;
  }

  function previewRoomForCat(cat) {
    if (cat === "ongles") {
      return "Salle Ongles (ou salle secondaire si occupee)";
    }

    if (cat === "noire") {
      return "Salle Noire";
    }

    if (cat === "baby") {
      return "Baby Spa";
    }

    if (cat === "outside") {
      return "Exterieur";
    }

    return "A definir";
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

  function rangesOverlap(rangeA, rangeB) {
    var startA = periodStamp(rangeA.startDate, rangeA.startTime || "00:00");
    var endA = periodStamp(rangeA.endDate || rangeA.startDate, rangeA.endTime || "23:59");
    var startB = periodStamp(rangeB.startDate, rangeB.startTime || "00:00");
    var endB = periodStamp(rangeB.endDate || rangeB.startDate, rangeB.endTime || "23:59");
    return startA < endB && endA > startB;
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
        var prestation = db.prestations.find(function (item) {
          return item.name === reservation.prestation;
        });
        return {
          id: reservation.id,
          client: reservation.client,
          prestation: reservation.prestation,
          date: reservation.date,
          time: reservation.time,
          supplement: reservation.supplement || 0,
          price: (prestation ? prestation.price : 0) + (reservation.supplement || 0)
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

  function renameCollaborator(db, oldName, newName) {
    db.clients.forEach(function (client) {
      if (client.collab === oldName) {
        client.collab = newName;
      }
    });

    db.reservations.forEach(function (reservation) {
      if (reservation.collab === oldName) {
        reservation.collab = newName;
      }
    });

    db.absences.forEach(function (absence) {
      if (absence.collab === oldName) {
        absence.collab = newName;
      }
    });

    db.holidays.forEach(function (holiday) {
      if (holiday.collab === oldName) {
        holiday.collab = newName;
      }
    });
  }

  window.SalonDomain = {
    assignmentError: assignmentError,
    catLabel: catLabel,
    conflict: conflict,
    conflictDetails: conflictDetails,
    countFor: countFor,
    datesForRange: datesForRange,
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
    previewRoomForCat: previewRoomForCat,
    rangesOverlap: rangesOverlap,
    renameCollaborator: renameCollaborator,
    revenueFor: revenueFor,
    roomFor: roomFor,
    roomReservationsForDate: roomReservationsForDate,
    roomStatus: roomStatus,
    slotOverlapsRange: slotOverlapsRange,
    addMinutes: addMinutes
  };
}());
