"use strict";

// Copie uniquement les fichiers necessaires a l'application dans www/,
// le dossier lu par Capacitor (voir capacitor.config.json -> webDir).
// N'inclut jamais .git, .claude, node_modules, android/, supabase/, docs/,
// les fichiers markdown ou d'anciens fichiers de test.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WWW = path.join(ROOT, "www");

const HTML_FILES = [
  "index.html",
  "planning.html",
  "clients.html",
  "recherche.html",
  "comptes.html",
  "plus.html",
  "reset-password.html"
];

const DIRECTORIES = ["css", "js", "assets"];

const EXTRA_FILES = ["manifest.json"];

function resetWww() {
  fs.rmSync(WWW, { recursive: true, force: true });
  fs.mkdirSync(WWW, { recursive: true });
}

function copyFileIfExists(relativePath) {
  var source = path.join(ROOT, relativePath);
  if (!fs.existsSync(source)) {
    console.warn("Ignore (introuvable) : " + relativePath);
    return;
  }
  fs.copyFileSync(source, path.join(WWW, relativePath));
}

function copyDirIfExists(relativePath) {
  var source = path.join(ROOT, relativePath);
  if (!fs.existsSync(source)) {
    console.warn("Ignore (introuvable) : " + relativePath + "/");
    return;
  }
  fs.cpSync(source, path.join(WWW, relativePath), { recursive: true });
}

resetWww();
HTML_FILES.forEach(copyFileIfExists);
DIRECTORIES.forEach(copyDirIfExists);
EXTRA_FILES.forEach(copyFileIfExists);

// sw.js n'est PAS copie dans www/ : dans une app Android empaquetee, les
// fichiers sont deja embarques localement dans l'APK (pas besoin d'un
// cache hors-ligne navigateur), et un service worker cache-first risquerait
// au contraire de continuer a servir une ancienne version du code apres
// une mise a jour de l'app, le cache n'etant jamais invalide automatiquement
// entre deux versions installees. La version web (sw.js a la racine du
// projet, servie hors Capacitor) n'est pas touchee par ce script.

console.log("www/ prete pour Capacitor (" + WWW + ").");
console.log("sw.js volontairement exclu de www/ (voir commentaire dans ce script).");
