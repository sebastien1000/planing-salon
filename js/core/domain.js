(function () {
  var utils = window.SalonUtils;
  var data = window.SalonData;

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

  function buildConflictPayload(type, reservation, item, message) {
    return {
      type: type,
      message: message,
      reservation: item ? {
        id: item.id || "",
        client: item.client || "",
        collab: item.collab || "",
        room: item.room || "",
        date: item.date || reservation.date,
        time: item.time || reservation.time,
        duration: Number(item.duration || 0)
      } : null
    };
  }

  function conflictDetails(db, reservation, ignoreId) {
    var roomConflict;
    var collabConflict;
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

    absenceConflict = db.absences.find(function (item) {
      return item.date === reservation.date &&
        item.collab === reservation.collab &&
        utils.overlaps(item.time, item.duration, reservation.time, reservation.duration);
    });

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
  }

  window.SalonDomain = {
    assignmentError: assignmentError,
    catLabel: catLabel,
    conflict: conflict,
    conflictDetails: conflictDetails,
    countFor: countFor,
    datesForRange: datesForRange,
    doneReservationsFor: doneReservationsFor,
    fullDateLabel: fullDateLabel,
    getStatusLabel: getStatusLabel,
    isCancelled: isCancelled,
    isActiveReservation: isActiveReservation,
    isPrestationAllowedForUser: isPrestationAllowedForUser,
    isRoomAllowedForUser: isRoomAllowedForUser,
    normalizeStatus: normalizeStatus,
    previewRoomForCat: previewRoomForCat,
    renameCollaborator: renameCollaborator,
    revenueFor: revenueFor,
    roomFor: roomFor,
    addMinutes: addMinutes
  };
}());
