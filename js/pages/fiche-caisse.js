(function () {
  var auth = window.SalonAuth;
  var data = window.SalonData;
  var domain = window.SalonDomain;
  var supabaseData = window.SalonSupabaseData;
  var ui = window.SalonUI;
  var utils = window.SalonUtils;

  var user = ui.initAppPage({
    activePage: "comptes",
    actions: {},
    pageTitle: "Fiche de caisse"
  });

  if (!user) {
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var collabName = params.get("collab") || user.name;
  var month = params.get("month") || utils.today().slice(0, 7);

  // Chaque collaboratrice ne genere que SA PROPRE fiche : seul l'admin peut
  // consulter celle d'une autre (meme regle que comptes.js, qui n'affiche
  // meme pas la carte d'une autre collaboratrice a une non-admin).
  if (!auth.isAdmin(user) && collabName !== user.name) {
    window.location.href = "comptes.html";
    return;
  }

  var db = data.loadDb();
  var account = (db.users || []).find(function (item) { return item.name === collabName; });

  var PAYMENT_LABELS = { cash: "Especes", card: "CB", transfer: "Virement", check: "Cheque" };

  function fmt(amount) {
    return (amount || 0).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + " EUR";
  }

  function shortDate(iso) {
    var parts = String(iso || "").split("-");
    return parts.length === 3 ? parts[2] + "/" + parts[1] : iso;
  }

  function monthLabel(value) {
    return utils.dateObj(value + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  }

  function renderRow(row) {
    var remiseCell = '<span class="fc-none">—</span>';
    var amountCell = fmt(row.amount);
    var paiementCell;

    if (row.free) {
      remiseCell = '<span class="fc-badge fc-badge-free">Offert</span>';
      amountCell = '<span class="fc-price-orig">' + fmt(row.listPrice) + '</span><span class="fc-price-final">' + fmt(0) + '</span>';
      paiementCell = '<span class="chip fc-chip-free">Offert</span>';
    } else {
      if (row.discount > 0) {
        remiseCell = '<span class="fc-badge fc-badge-discount">-' + fmt(row.discount) + '</span>';
        amountCell = '<span class="fc-price-orig">' + fmt(row.listPrice) + '</span><span class="fc-price-final">' + fmt(row.amount) + '</span>';
      }
      paiementCell = row.paymentMethod
        ? '<span class="chip fc-chip-' + row.paymentMethod + '">' + (PAYMENT_LABELS[row.paymentMethod] || row.paymentMethod) + '</span>'
        : '<span class="fc-none">—</span>';
    }

    return [
      "<tr>",
      "<td>" + shortDate(row.date) + " " + utils.escapeHtml(row.time || "") + "</td>",
      '<td class="fc-client">' + utils.escapeHtml(row.client || "Client") + "</td>",
      '<td class="fc-presta">' + utils.escapeHtml(row.prestation || "") + "</td>",
      "<td>" + remiseCell + "</td>",
      "<td>" + paiementCell + "</td>",
      '<td class="fc-amount">' + amountCell + "</td>",
      "</tr>"
    ].join("");
  }

  function renderPaymentTiles(totals) {
    return domain.PAYMENT_METHODS.map(function (method) {
      return [
        '<div class="fc-tile fc-tile-' + method + '">',
        '  <div class="fc-tile-label">' + PAYMENT_LABELS[method] + "</div>",
        '  <div class="fc-tile-value">' + fmt(totals[method]) + "</div>",
        "</div>"
      ].join("");
    }).join("");
  }

  function render(report) {
    var rowsHtml = report.rows.length
      ? report.rows.map(renderRow).join("")
      : '<tr><td colspan="6"><p class="tiny" style="margin:10px 0">Aucun rendez-vous termine sur cette periode.</p></td></tr>';

    ui.setMain([
      '<div class="card fc-controls">',
      '  <label for="fcMonth">Periode</label>',
      '  <input id="fcMonth" class="field" type="month" value="' + month + '" max="' + utils.today().slice(0, 7) + '">',
      '  <button id="fcPrintButton" class="primary" style="width:100%" type="button">Imprimer / PDF</button>',
      "</div>",

      '<div class="card fc-sheet" id="fcSheet">',
      '  <div class="fc-head">',
      '    <div class="fc-brand">',
      ui.renderUserProfile(collabName, {
        className: "profile-user-card",
        avatarClassName: "profile-avatar-md",
        nameClassName: "profile-name-card",
        photoSrc: account && account.photo
      }),
      '      <div>',
      '        <h2 class="fc-title">Fiche de caisse</h2>',
      '        <p class="tiny">Recapitulatif des encaissements</p>',
      "      </div>",
      "    </div>",
      '    <div class="fc-meta">',
      '      <div class="fc-period">' + utils.escapeHtml(monthLabel(month)) + "</div>",
      '      <div class="tiny">Genere le ' + utils.escapeHtml(new Date().toLocaleDateString("fr-FR")) + "</div>",
      "    </div>",
      "  </div>",

      '  <div class="fc-tablewrap">',
      '    <table class="fc-table">',
      "      <thead><tr><th>Date</th><th>Cliente</th><th>Prestation</th><th>Remise</th><th>Paiement</th><th>Montant</th></tr></thead>",
      "      <tbody>" + rowsHtml + "</tbody>",
      "    </table>",
      "  </div>",

      '  <div class="fc-section-label tiny">Encaissements par moyen de paiement</div>',
      '  <div class="fc-summary">' + renderPaymentTiles(report.totals) + "</div>",

      '  <div class="fc-section-label tiny">Remises &amp; prestations offertes</div>',
      '  <div class="fc-remises">',
      '    <div class="fc-tile fc-tile-discount">',
      '      <div class="fc-tile-label">Remises accordees</div>',
      '      <div class="fc-tile-value">' + fmt(report.discountTotal) + "</div>",
      '      <div class="fc-tile-count">' + report.discountCount + " rdv avec remise</div>",
      "    </div>",
      '    <div class="fc-tile fc-tile-free">',
      '      <div class="fc-tile-label">Prestations offertes</div>',
      '      <div class="fc-tile-value">' + fmt(report.freeTotal) + "</div>",
      '      <div class="fc-tile-count">' + report.freeCount + " rdv offert" + (report.freeCount > 1 ? "s" : "") + "</div>",
      "    </div>",
      "  </div>",

      '  <div class="fc-grandtotal"><span>Total encaisse</span><span class="fc-grandtotal-value">' + fmt(report.grandTotal) + "</span></div>",
      "</div>"
    ].join(""));

    ui.byId("fcPrintButton").addEventListener("click", function () {
      window.print();
    });

    ui.byId("fcMonth").addEventListener("change", function () {
      month = ui.byId("fcMonth").value || utils.today().slice(0, 7);
      load();
    });
  }

  function showLoadError(error) {
    ui.setMain([
      '<div class="card">',
      '  <div class="alert">Impossible de charger les rendez-vous depuis Supabase. Verifiez la configuration et votre connexion.</div>',
      "</div>"
    ].join(""));
    window.console && window.console.error && window.console.error(error);
  }

  function load() {
    var dates = domain.datesForRange(month + "-01", "month");

    return supabaseData.listReservationsForDates(dates).then(function (reservations) {
      var report = domain.caisseReportFor({ reservations: reservations }, collabName, "month", month + "-01");
      render(report);
    }).catch(showLoadError);
  }

  load();
}());
