(function () {
  function today(add) {
    var offset = Number(add || 0);
    var date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  function uid(prefix) {
    return (prefix || "id") + Math.random().toString(36).slice(2, 9);
  }

  function dateObj(value) {
    return new Date(value + "T12:00");
  }

  function iso(date) {
    return date.toISOString().slice(0, 10);
  }

  function addDays(value, count) {
    var date = dateObj(value);
    date.setDate(date.getDate() + count);
    return iso(date);
  }

  function startWeek(value) {
    var date = dateObj(value);
    var day = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - day);
    return iso(date);
  }

  function startMonth(value) {
    var date = dateObj(value);
    date.setDate(1);
    return iso(date);
  }

  function monthDates(value) {
    var start = dateObj(startMonth(value));
    var month = start.getMonth();
    var dates = [];
    var cursor = new Date(start);

    while (cursor.getMonth() === month) {
      dates.push(iso(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
  }

  function fmtDate(value) {
    return dateObj(value).toLocaleDateString("fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "short"
    });
  }

  function mins(time) {
    var parts = time.split(":").map(Number);
    return parts[0] * 60 + parts[1];
  }

  function overlaps(aStart, aDuration, bStart, bDuration) {
    var aEnd = mins(aStart) + Number(aDuration);
    var bEnd = mins(bStart) + Number(bDuration);
    return mins(aStart) < bEnd && aEnd > mins(bStart);
  }

  function findById(list, id) {
    return list.find(function (item) {
      return item.id === id;
    });
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function boolAttr(condition, name) {
    return condition ? " " + name : "";
  }

  function collaboratorClassName(name) {
    return "collab-" + String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
  }

  window.SalonUtils = {
    addDays: addDays,
    boolAttr: boolAttr,
    collaboratorClassName: collaboratorClassName,
    dateObj: dateObj,
    escapeHtml: escapeHtml,
    findById: findById,
    fmtDate: fmtDate,
    iso: iso,
    mins: mins,
    monthDates: monthDates,
    overlaps: overlaps,
    startMonth: startMonth,
    startWeek: startWeek,
    today: today,
    uid: uid
  };
}());
