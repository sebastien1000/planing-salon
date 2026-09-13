(function () {
  // État des réglages personnels et interface associée, sans accès au planning.
  function create() {
    var data = window.SalonData;
    var settings = data.loadSettings();
    // Une entree par option configurable depuis Plus (voir js/core/data.js,
    // loadSettings/saveSettings) : ajouter une future option = ajouter une
    // entree ici (type "checkbox" ou "select"), pas de nouvelle carte a creer.
    var SETTINGS_FIELDS = [
      {
        key: "autoProposeNextRdv",
        type: "checkbox",
        label: "Proposer automatiquement le prochain RDV",
        hint: "A la fin d'un rendez-vous (bouton \"Terminer\"), ouvre une proposition de prochaine visite pour la cliente."
      },
      {
        key: "defaultPlanningView",
        type: "select",
        label: "Vue du planning par defaut",
        hint: "Vue affichee a l'ouverture du Planning (un changement de vue pendant la session reste toujours prioritaire).",
        options: [
          ["", "Automatique"],
          ["day", "Jour"],
          ["week", "Semaine"],
          ["month", "Mois"]
        ]
      }
    ];

    function settingsFieldHtml(field) {
      if (field.type === "select") {
        var optionsHtml = field.options.map(function (option) {
          var selected = settings[field.key] === option[0] ? " selected" : "";
          return '<option value="' + option[0] + '"' + selected + ">" + option[1] + "</option>";
        }).join("");

        return [
          '<div style="margin-top:10px">',
          '  <label for="setting-' + field.key + '"><b>' + field.label + "</b></label>",
          '  <div class="tiny">' + field.hint + "</div>",
          '  <select id="setting-' + field.key + '" class="field" data-setting-key="' + field.key + '" style="margin-top:6px">' +
            optionsHtml + "</select>",
          "</div>"
        ].join("");
      }

      return [
        '<label class="row" style="align-items:flex-start;gap:10px;margin-top:10px">',
        '  <input type="checkbox" data-setting-key="' + field.key + '"' + (settings[field.key] ? " checked" : "") + '>',
        '  <span class="grow"><b>' + field.label + '</b><div class="tiny">' + field.hint + '</div></span>',
        "</label>"
      ].join("");
    }

    function render() {
      return [
        '<div class="card">',
        "  <h3>Paramètres</h3>",
        SETTINGS_FIELDS.map(settingsFieldHtml).join(""),
        "</div>"
      ].join("");
    }

    function bind() {
      document.querySelectorAll("[data-setting-key]").forEach(function (field) {
        field.addEventListener("change", function () {
          settings[field.dataset.settingKey] = field.type === "checkbox" ? field.checked : field.value;
          settings = data.saveSettings(settings);
        });
      });
    }
    return { render: render, bind: bind };
  }
  window.SalonSettingsCard = { create: create };
}());
