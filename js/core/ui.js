(function () {
  var utils = window.SalonUtils;
  var auth = window.SalonAuth;

  var NAV_ITEMS = [
    { href: "planning.html", key: "planning", label: "Planning" },
    { href: "clients.html", key: "clients", label: "Clients" },
    { href: "recherche.html", key: "recherche", label: "Recherche" },
    { href: "comptes.html", key: "comptes", label: "Comptes" },
    { href: "plus.html", key: "plus", label: "Plus" }
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function html(tag, className, content) {
    return '<' + tag + (className ? ' class="' + className + '"' : "") + ">" +
      (content || "") +
      "</" + tag + ">";
  }

  function buildShell(options) {
    var container = byId("app");
    var user = options.user;
    var pageTitle = utils.escapeHtml(options.pageTitle);

    container.innerHTML = [
      '<div class="phone">',
      '  <header class="top app-header">',
      '    <div class="header-left app-header-left">',
      '      <button id="goPlanning" class="home" type="button">⌂</button>',
      '    </div>',
      '    <div class="header-center app-header-center header-brand">',
      '      <img class="header-logo app-logo" src="logo.png" alt="Planning Salon">',
      '      <div class="title-copy">',
      '          <div class="title">' + pageTitle + "</div>",
      '          <div class="tiny">' + utils.escapeHtml(user.name) + "</div>",
      "      </div>",
      "    </div>",
      '    <div class="header-right app-header-right">',
      '      <button id="logoutButton" class="pill" type="button">Sortir</button>',
      "    </div>",
      "  </header>",
      '  <main id="pageMain"></main>',
      renderActions(options.actions || {}),
      renderTabs(options.activePage),
      '  <div id="modal" class="modal hidden"><div id="modalBox" class="modal-box"></div></div>',
      '  <div id="sheet" class="sheet hidden"><div id="sheetBox" class="modal-box"></div></div>',
      '  <input id="photoInput" class="hidden" type="file" accept="image/*" capture="environment">',
      "</div>"
    ].join("");

    byId("goPlanning").addEventListener("click", function () {
      window.location.href = "planning.html";
    });

    byId("logoutButton").addEventListener("click", auth.logout);
  }

  function renderActions(actions) {
    var parts = ['<div class="app-actions">'];

    if (actions.photo) {
      parts.push('<button id="photoButton" class="photo-btn" type="button">Photo</button>');
    }

    if (actions.fab) {
      parts.push('<button id="fabButton" class="fab" type="button">+</button>');
    }

    parts.push("</div>");
    return parts.join("");
  }

  function renderTabs(activePage) {
    return [
      '<nav class="tabs">',
      NAV_ITEMS.map(function (item) {
        var className = item.key === activePage ? "tab active" : "tab";
        return '<button class="' + className + '" type="button" data-href="' +
          item.href + '">' + item.label + "</button>";
      }).join(""),
      "</nav>"
    ].join("");
  }

  function bindTabs() {
    document.querySelectorAll(".tabs button").forEach(function (button) {
      button.addEventListener("click", function () {
        window.location.href = button.dataset.href;
      });
    });
  }

  function showModal(content) {
    byId("modalBox").innerHTML = content;
    byId("modal").classList.remove("hidden");
  }

  function closeModal() {
    byId("modal").classList.add("hidden");
  }

  function showSheet(content, boxClassName) {
    var sheetBox = byId("sheetBox");
    sheetBox.className = boxClassName ? "modal-box " + boxClassName : "modal-box";
    sheetBox.innerHTML = content;
    byId("sheet").classList.remove("hidden");
  }

  function closeSheet() {
    byId("sheetBox").className = "modal-box";
    byId("sheet").classList.add("hidden");
  }

  function setMain(content) {
    byId("pageMain").innerHTML = content;
  }

  function bindActionButton(id, handler) {
    var element = byId(id);
    if (element) {
      element.addEventListener("click", handler);
    }
  }

  function initAppPage(options) {
    var user = auth.requireAuth();
    if (!user) {
      return null;
    }

    buildShell({
      actions: options.actions,
      activePage: options.activePage,
      pageTitle: options.pageTitle,
      user: user
    });

    bindTabs();
    registerServiceWorker();

    return user;
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  window.SalonUI = {
    bindActionButton: bindActionButton,
    byId: byId,
    closeModal: closeModal,
    closeSheet: closeSheet,
    html: html,
    initAppPage: initAppPage,
    registerServiceWorker: registerServiceWorker,
    setMain: setMain,
    showModal: showModal,
    showSheet: showSheet
  };
}());
