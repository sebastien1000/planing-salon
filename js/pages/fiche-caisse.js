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

  // Couleurs dupliquees de css/fiche-caisse.css : jsPDF dessine directement
  // sur un canvas PDF, il ne peut pas lire les variables CSS de la page.
  var PDF_COLORS = {
    ink: [65, 40, 50],
    muted: [139, 101, 112],
    line: [240, 213, 220],
    pinkTint: [251, 234, 238],
    pink2: [247, 219, 226],
    cash: [63, 143, 92],
    card: [58, 114, 196],
    transfer: [122, 92, 192],
    check: [184, 128, 47],
    discount: [193, 80, 47],
    free: [47, 143, 130]
  };

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

  // Construit un vrai fichier PDF (pas une impression navigateur) : sur
  // telephone/tablette (dont l'appli Android), il n'y a pas toujours
  // d'imprimante ni de boite d'impression native, alors qu'un fichier .pdf
  // telecharge peut etre ouvert/partage/imprime plus tard depuis n'importe
  // quelle appli. On dessine chaque ligne nous-memes (hauteur fixe calculee
  // a l'avance) plutot que de laisser un navigateur paginer un tableau HTML :
  // c'est justement une pagination automatique qui provoquait l'artefact de
  // rectangle blanc rencontre avec window.print().
  function buildFichePdf(report, collabNameForPdf, monthForPdf) {
    var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
    var pageWidth = doc.internal.pageSize.getWidth();
    var pageHeight = doc.internal.pageSize.getHeight();
    var margin = 14;
    var usableWidth = pageWidth - margin * 2;
    var y = margin;

    var columns = [
      { key: "date", label: "Date", width: 22 },
      { key: "client", label: "Cliente", width: 36 },
      { key: "prestation", label: "Prestation", width: 42 },
      { key: "remise", label: "Remise", width: 24 },
      { key: "paiement", label: "Paiement", width: 24 },
      { key: "montant", label: "Montant", width: usableWidth - (22 + 36 + 42 + 24 + 24) }
    ];

    function setColor(method, target) {
      var color = PDF_COLORS[target] || PDF_COLORS.ink;
      if (method === "fill") {
        doc.setFillColor(color[0], color[1], color[2]);
      } else if (method === "draw") {
        doc.setDrawColor(color[0], color[1], color[2]);
      } else {
        doc.setTextColor(color[0], color[1], color[2]);
      }
    }

    function ensureSpace(neededHeight) {
      if (y + neededHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
        return true;
      }
      return false;
    }

    function fitText(text, maxWidth) {
      var value = String(text || "");
      if (doc.getTextWidth(value) <= maxWidth) {
        return value;
      }
      while (value.length > 1 && doc.getTextWidth(value + "...") > maxWidth) {
        value = value.slice(0, -1);
      }
      return value + "...";
    }

    function drawHeader() {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      setColor("text", "ink");
      doc.text("Fiche de caisse", margin, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(collabNameForPdf, margin, y + 13);

      doc.setFontSize(9);
      setColor("text", "muted");
      doc.text(monthLabel(monthForPdf), pageWidth - margin, y + 6, { align: "right" });
      doc.text("Genere le " + new Date().toLocaleDateString("fr-FR"), pageWidth - margin, y + 11, { align: "right" });

      y += 19;
      setColor("draw", "line");
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    }

    function drawTableHead() {
      setColor("fill", "pinkTint");
      doc.rect(margin, y, usableWidth, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      setColor("text", "ink");

      var x = margin;
      columns.forEach(function (col) {
        var align = col.key === "montant" ? "right" : "left";
        var textX = align === "right" ? x + col.width - 2 : x + 2;
        doc.text(col.label.toUpperCase(), textX, y + 4.7, { align: align });
        x += col.width;
      });

      y += 7;
    }

    function drawAmountCell(x, width, row) {
      var rightX = x + width - 2;

      if (row.free || row.discount > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        setColor("text", "muted");
        var origText = fmt(row.listPrice);
        var origWidth = doc.getTextWidth(origText);
        doc.text(origText, rightX, y + 3.3, { align: "right" });
        setColor("draw", "muted");
        doc.line(rightX - origWidth, y + 2.1, rightX, y + 2.1);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        setColor("text", "ink");
        doc.text(fmt(row.free ? 0 : row.amount), rightX, y + 7.6, { align: "right" });
      } else {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        setColor("text", "ink");
        doc.text(fmt(row.amount), rightX, y + 5.5, { align: "right" });
      }
    }

    function drawRow(row) {
      var rowHeight = row.free || row.discount > 0 ? 11 : 8;

      if (ensureSpace(rowHeight)) {
        drawTableHead();
      }

      var x = margin;
      var textY = y + (rowHeight === 11 ? 4.3 : 5.5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setColor("text", "ink");
      doc.text(shortDate(row.date) + " " + (row.time || ""), x + 2, textY);
      x += columns[0].width;

      doc.setFont("helvetica", "bold");
      doc.text(fitText(row.client || "Client", columns[1].width - 4), x + 2, textY);
      x += columns[1].width;

      doc.setFont("helvetica", "normal");
      setColor("text", "muted");
      doc.text(fitText(row.prestation || "", columns[2].width - 4), x + 2, textY);
      x += columns[2].width;

      if (row.free) {
        setColor("text", "free");
        doc.setFont("helvetica", "bold");
        doc.text("Offert", x + 2, textY);
      } else if (row.discount > 0) {
        setColor("text", "discount");
        doc.setFont("helvetica", "bold");
        doc.text("-" + fmt(row.discount), x + 2, textY);
      } else {
        setColor("text", "muted");
        doc.setFont("helvetica", "normal");
        doc.text("-", x + 2, textY);
      }
      x += columns[3].width;

      if (row.free) {
        setColor("text", "free");
        doc.setFont("helvetica", "bold");
        doc.text("Offert", x + 2, textY);
      } else if (row.paymentMethod) {
        setColor("text", row.paymentMethod);
        doc.setFont("helvetica", "bold");
        doc.text(PAYMENT_LABELS[row.paymentMethod] || row.paymentMethod, x + 2, textY);
      } else {
        setColor("text", "muted");
        doc.setFont("helvetica", "normal");
        doc.text("-", x + 2, textY);
      }
      x += columns[4].width;

      drawAmountCell(x, columns[5].width, row);

      y += rowHeight;
      setColor("draw", "line");
      doc.line(margin, y, margin + usableWidth, y);
    }

    function drawSectionLabel(text) {
      ensureSpace(10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setColor("text", "muted");
      doc.text(text.toUpperCase(), margin, y + 4);
      y += 8;
    }

    function drawTiles(tiles) {
      var gap = 4;
      var tileWidth = (usableWidth - gap * (tiles.length - 1)) / tiles.length;
      var tileHeight = 18;

      ensureSpace(tileHeight + 4);

      tiles.forEach(function (tile, index) {
        var x = margin + index * (tileWidth + gap);
        setColor("draw", "line");
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, tileWidth, tileHeight, 2, 2, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.3);
        setColor("text", tile.color);
        doc.text(tile.label.toUpperCase(), x + 3, y + 5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        setColor("text", "ink");
        doc.text(tile.value, x + 3, y + 11.5);

        if (tile.sub) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.3);
          setColor("text", "muted");
          doc.text(tile.sub, x + 3, y + 15.5);
        }
      });

      y += tileHeight + 6;
    }

    function drawGrandTotal(total) {
      ensureSpace(16);
      setColor("fill", "pink2");
      doc.roundedRect(margin, y, usableWidth, 14, 3, 3, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setColor("text", "ink");
      doc.text("Total encaisse", margin + 4, y + 9);

      doc.setFontSize(13);
      doc.text(fmt(total), margin + usableWidth - 4, y + 9, { align: "right" });

      y += 14;
    }

    drawHeader();
    drawTableHead();

    if (!report.rows.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      setColor("text", "muted");
      doc.text("Aucun rendez-vous termine sur cette periode.", margin + 2, y + 6);
      y += 12;
    } else {
      report.rows.forEach(drawRow);
      y += 6;
    }

    drawSectionLabel("Encaissements par moyen de paiement");
    drawTiles(domain.PAYMENT_METHODS.map(function (method) {
      return { label: PAYMENT_LABELS[method], value: fmt(report.totals[method]), color: method };
    }));

    drawSectionLabel("Remises & prestations offertes");
    drawTiles([
      {
        label: "Remises accordees",
        value: fmt(report.discountTotal),
        sub: report.discountCount + " rdv avec remise",
        color: "discount"
      },
      {
        label: "Prestations offertes",
        value: fmt(report.freeTotal),
        sub: report.freeCount + " rdv offert" + (report.freeCount > 1 ? "s" : ""),
        color: "free"
      }
    ]);

    drawGrandTotal(report.grandTotal);

    return doc;
  }

  var currentReport = null;

  function render(report) {
    currentReport = report;
    var rowsHtml = report.rows.length
      ? report.rows.map(renderRow).join("")
      : '<tr><td colspan="6"><p class="tiny" style="margin:10px 0">Aucun rendez-vous termine sur cette periode.</p></td></tr>';

    ui.setMain([
      '<div class="card fc-controls">',
      '  <label for="fcMonth">Periode</label>',
      '  <input id="fcMonth" class="field" type="month" value="' + month + '" max="' + utils.today().slice(0, 7) + '">',
      '  <div class="row">',
      '    <button id="fcDownloadButton" class="primary grow" type="button">Telecharger le PDF</button>',
      '    <button id="fcPrintButton" class="secondary grow" type="button">Imprimer</button>',
      "  </div>",
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

    ui.byId("fcDownloadButton").addEventListener("click", function () {
      var pdf = buildFichePdf(currentReport, collabName, month);
      pdf.save("fiche-caisse-" + collabName.toLowerCase() + "-" + month + ".pdf");
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
