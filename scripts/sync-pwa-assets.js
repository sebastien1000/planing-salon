"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { ROOT, appFiles } = require("./app-files");

function expectedServiceWorker() {
  const files = appFiles();
  const filename = path.join(ROOT, "sw.js");
  const current = fs.readFileSync(filename, "utf8");
  const start = current.indexOf('self.addEventListener("install"');
  if (start === -1) throw new Error("Point d’entrée du service worker introuvable");
  const runtime = current.slice(start);
  const hash = crypto.createHash("sha256").update(runtime);
  for (const file of files) hash.update(file).update(fs.readFileSync(path.join(ROOT, file)));
  const version = hash.digest("hex").slice(0, 16);
  return '// Liste et version générées par npm run sync:pwa.\n' +
    'const CACHE_NAME = "salon-mvp-' + version + '";\n\n' +
    'const APP_ASSETS = ' + JSON.stringify(["./", ...files.map(file => "./" + file)], null, 2) + ';\n\n' + runtime;
}

if (require.main === module) {
  const filename = path.join(ROOT, "sw.js");
  const expected = expectedServiceWorker();
  if (process.argv.includes("--check")) {
    if (fs.readFileSync(filename, "utf8") !== expected) {
      console.error("Précache obsolète : lancer npm run sync:pwa.");
      process.exitCode = 1;
    }
  } else {
    fs.writeFileSync(filename, expected);
    console.log("Précache PWA synchronisé avec les fichiers de l’application.");
  }
}

module.exports = { expectedServiceWorker };
