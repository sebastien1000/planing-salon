const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT, HTML_FILES, appFiles } = require('../scripts/app-files');

test('pages : ressources locales présentes et chargées une seule fois', () => {
  for (const file of HTML_FILES) {
    const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const refs = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)]
      .map(match => match[1]).filter(ref => !/^(https?:|data:)/.test(ref));
    assert.equal(new Set(refs).size, refs.length, file + ' : doublon');
    for (const ref of refs) assert.ok(fs.existsSync(path.join(ROOT, ref)), file + ' → ' + ref);
    assert.ok(refs.includes('css/pages/' + file.replace('.html', '.css')), file);
  }
});

test('CSS : imports sans cycle, fichiers et images présents', () => {
  function visit(file, stack = []) {
    assert.ok(!stack.includes(file), 'Cycle CSS : ' + [...stack, file].join(' → '));
    const css = fs.readFileSync(file, 'utf8');
    for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      const ref = match[1];
      if (/^(data:|https?:|#)/.test(ref)) continue;
      const target = path.resolve(path.dirname(file), ref);
      assert.ok(fs.existsSync(target), file + ' → ' + ref);
      if (target.endsWith('.css')) visit(target, [...stack, file]);
    }
  }
  appFiles().filter(file => file.endsWith('.css')).forEach(file => visit(path.join(ROOT, file)));
});

test('chaque thème possède son CSS et figure dans le catalogue', () => {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/themes/theme-config.js', 'utf8'), context);
  const config = context.window.SalonThemeConfig;
  const catalog = fs.readFileSync('css/themes/catalog.css', 'utf8');
  for (const theme of [...config.THEME_LIST, ...config.SPECIAL_THEMES]) {
    if (theme.id === 'default') continue;
    assert.ok(catalog.includes('./' + theme.id + '.css'), theme.id);
  }
});

test('syntaxe de tous les modules JavaScript applicatifs', () => {
  for (const file of appFiles().filter(file => file.endsWith('.js') && !file.includes('/vendor/'))) {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file }));
  }
});

test('carte Paramètres : rendu et sauvegarde des valeurs booléennes et du choix de vue', () => {
  const values = { autoProposeNextRdv: true, defaultPlanningView: 'week' };
  const saved = [];
  const fields = [
    { dataset: { settingKey: 'autoProposeNextRdv' }, type: 'checkbox', checked: false },
    { dataset: { settingKey: 'defaultPlanningView' }, type: 'select-one', value: 'month' }
  ];
  fields.forEach(field => { field.addEventListener = (_, callback) => { field.change = callback; }; });
  const context = {
    window: { SalonData: { loadSettings: () => ({ ...values }), saveSettings: next => { saved.push({ ...next }); return next; } } },
    document: { querySelectorAll: () => fields }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/ui/settings-card.js', 'utf8'), context);
  const card = context.window.SalonSettingsCard.create();
  assert.match(card.render(), /value="week" selected/);
  card.bind();
  fields.forEach(field => field.change());
  assert.equal(saved[0].autoProposeNextRdv, false);
  assert.equal(saved[1].defaultPlanningView, 'month');
});
