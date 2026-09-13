"use strict";

// Source commune au build Android et au précache PWA.
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const HTML_FILES = [
  "index.html", "planning.html", "clients.html", "recherche.html",
  "comptes.html", "plus.html", "reset-password.html", "fiche-caisse.html"
];
const DIRECTORIES = ["css", "js", "assets"];
const EXTRA_FILES = ["manifest.json"];

function listDirectory(relativePath) {
  return fs.readdirSync(path.join(ROOT, relativePath), { withFileTypes: true })
    .filter(entry => !entry.name.startsWith("."))
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(entry => {
      const file = relativePath + "/" + entry.name;
      return entry.isDirectory() ? listDirectory(file) : [file];
    });
}

function appFiles() {
  return [...HTML_FILES, ...EXTRA_FILES, ...DIRECTORIES.flatMap(listDirectory)];
}

module.exports = { ROOT, HTML_FILES, DIRECTORIES, EXTRA_FILES, appFiles };
