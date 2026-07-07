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

    if (prestation.cat === "ongles") {
      return collab === "Marion" ? "Salle Ongles 2" : "Salle Ongles";
    }

    if (prestation.cat === "baby") {
      return "Baby Spa";
    }

    if (prestation.cat === "noire") {
      return "Salle Noire";
    }

    return "Exterieur";
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
      return "Salle Ongles pour Julie / Salle Ongles 2 pour Marion";
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

  function conflict(db, reservation, ignoreId) {
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
      return "Conflit : " + reservation.room + " est deja reservee a " + roomConflict.time + ".";
    }

    collabConflict = db.reservations.find(function (item) {
      return item.id !== ignoreId &&
        item.date === reservation.date &&
        item.collab === reservation.collab &&
        isActiveReservation(item) &&
        utils.overlaps(item.time, item.duration, reservation.time, reservation.duration);
    });

    if (collabConflict) {
      return "Conflit : " + reservation.collab + " a deja un rendez-vous a " + collabConflict.time + ".";
    }

    absenceConflict = db.absences.find(function (item) {
      return item.date === reservation.date &&
        item.collab === reservation.collab &&
        utils.overlaps(item.time, item.duration, reservation.time, reservation.duration);
    });

    if (absenceConflict) {
      return "Conflit : " + reservation.collab + " est indisponible sur ce creneau.";
    }

    return null;
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

  function revenueFor(db, collab, range, selectedDate) {
    var dates = datesForRange(selectedDate, range);

    return db.reservations
      .filter(function (reservation) {
        return reservation.collab === collab &&
          reservation.status === "done" &&
          dates.includes(reservation.date);
      })
      .reduce(function (sum, reservation) {
        var prestation = db.prestations.find(function (item) {
          return item.name === reservation.prestation;
        });
        return sum + (prestation ? prestation.price : 0);
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
    catLabel: catLabel,
    conflict: conflict,
    countFor: countFor,
    datesForRange: datesForRange,
    fullDateLabel: fullDateLabel,
    getStatusLabel: getStatusLabel,
    isCancelled: isCancelled,
    isActiveReservation: isActiveReservation,
    normalizeStatus: normalizeStatus,
    previewRoomForCat: previewRoomForCat,
    renameCollaborator: renameCollaborator,
    revenueFor: revenueFor,
    roomFor: roomFor,
    addMinutes: addMinutes
  };
}());
