const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function harness(day = '2026-02-14', initial = {}, reduced = false) {
  let now = new Date(day + 'T12:00:00');
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [now.getTime()])); }
  }
  const attributes = {}, listeners = {}, saves = [], timers = [];
  const nodes = new Map();
  function element() {
    return { children: [], dataset: {}, style: { setProperty() {} },
      classList: { toggle(name, value) { this[name] = value; } },
      setAttribute() {}, appendChild(node) { this.children.push(node); },
      set innerHTML(value) { this.children = []; } };
  }
  const root = element();
  root.setAttribute = (key, value) => { attributes[key] = value; };
  root.getAttribute = key => attributes[key];
  root.toggleAttribute = (key, value) => { if (value) attributes[key] = ''; else delete attributes[key]; };
  const body = element();
  body.appendChild = node => nodes.set(node.id, node);
  const document = { documentElement: root, body, hidden: false,
    createElement: element, getElementById: id => nodes.get(id),
    addEventListener: (name, fn) => { listeners[name] = fn; }, dispatchEvent() {} };
  const local = new Map([['salonCurrentUserId', 'test-user'], ['salonThemePreference:test-user', JSON.stringify({
    selectedTheme: 'galaxy', lastSeasonalActivationId: 'winter-2026', ...initial
  })]]);
  const context = vm.createContext({ Date: Clock, document, CustomEvent: function () {},
    localStorage: { getItem: key => local.get(key), setItem: (key, value) => { local.set(key, value); saves.push(JSON.parse(value)); } },
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; }, clearTimeout() {},
    addEventListener: (name, fn) => { listeners[name] = fn; },
    matchMedia: () => ({ matches: reduced, addEventListener() {} }) });
  context.window = context;
  function load(file) { vm.runInContext(fs.readFileSync('js/themes/' + file + '.js', 'utf8'), context); }
  ['theme-config', 'seasonal-theme-resolver', 'theme-preferences', 'theme-decorations'].forEach(load);
  return { context, attributes, nodes, listeners, saves, timers, load,
    date: (y, m, d) => new Clock(y, m - 1, d, 12),
    setDay: value => { now = new Date(value + 'T12:00:00'); } };
}

test('calendrier Saint-Valentin et bornes inclusives', () => {
  const h = harness(), r = h.context.SalonSeasonalTheme;
  for (const day of [12, 14, 15]) assert.equal(r.resolveTheme(h.date(2026, 2, day), 'galaxy').theme, 'saint-valentin');
  for (const day of [11, 16]) assert.equal(r.resolveTheme(h.date(2026, 2, day), 'galaxy').theme, 'galaxy');
});

test('Pâques grégorien : changement d’année, dates extrêmes et période', () => {
  const h = harness(), r = h.context.SalonSeasonalTheme;
  for (const [year, month, day] of [[2024,3,31], [2025,4,20], [2026,4,5], [2027,3,28], [2028,4,16], [2038,4,25], [1818,3,22]]) {
    const easter = r.getEasterDate(year);
    assert.equal(easter.getMonth() + 1, month); assert.equal(easter.getDate(), day); assert.equal(easter.getDay(), 0);
    for (const offset of [-2, -1, 0, 1]) {
      const date = h.date(year, month, day + offset);
      // Pâques précoce (1818) : du 20 au 23 mars, Marion reste prioritaire.
      const expected = date.getMonth() === 2 && date.getDate() >= 20 && date.getDate() <= 23 ? 'anniversaire-marion' : 'paques';
      assert.equal(r.resolveTheme(date, 'printemps').theme, expected);
    }
    for (const offset of [-3, 2]) assert.equal(r.resolveTheme(h.date(year, month, day + offset), 'printemps').theme, 'printemps');
  }
});

test('anniversaires configurés, conflits, égalité et date invalide', () => {
  const h = harness(), c = h.context.SalonThemeConfig, r = h.context.SalonSeasonalTheme;
  assert.equal(c.MARION_BIRTHDAY.day, 20);
  assert.equal(c.MARION_BIRTHDAY.month, 3); assert.equal(c.JULIIE_BIRTHDAY.month, 6);
  assert.equal(c.JULIIE_BIRTHDAY.day, 20);
  for (const year of [2026, 2027]) {
    for (const day of [20, 21, 22, 23]) assert.equal(r.resolveTheme(h.date(year,3,day), 'printemps').theme, 'anniversaire-marion');
    for (const day of [19, 24]) assert.equal(r.resolveTheme(h.date(year,3,day), 'printemps').theme, 'printemps');
    for (const day of [20, 21, 22, 23]) assert.equal(r.resolveTheme(h.date(year,6,day), 'printemps').theme, 'anniversaire-juliie');
    for (const day of [19, 24]) assert.equal(r.resolveTheme(h.date(year,6,day), 'printemps').theme, 'printemps');
  }
  Object.assign(c.MARION_BIRTHDAY, { day: 14, month: 2 });
  Object.assign(c.JULIIE_BIRTHDAY, { day: 5, month: 4 });
  assert.equal(r.resolveTheme(h.date(2026,2,14), 'halloween').theme, 'anniversaire-marion');
  assert.equal(r.resolveTheme(h.date(2026,4,5), 'printemps').theme, 'anniversaire-juliie');
  Object.assign(c.JULIIE_BIRTHDAY, { day: 14, month: 2 });
  assert.equal(r.resolveTheme(h.date(2026,2,14), 'default').theme, 'anniversaire-marion');
  Object.assign(c.MARION_BIRTHDAY, { day: 31, month: 2 });
  assert.equal(r.isSpecialActive(c.SPECIAL_THEMES[0], h.date(2026,3,3)), false);
  Object.assign(c.MARION_BIRTHDAY, { day: 31, month: 10 });
  assert.equal(r.resolveTheme(h.date(2026,10,31), 'halloween').theme, 'anniversaire-marion');
});

test('Halloween et saisons existantes conservés', () => {
  const h = harness(), r = h.context.SalonSeasonalTheme;
  for (const [month, day, expected] of [[10,19,'automne'],[10,20,'halloween'],[10,31,'halloween'],[11,1,'halloween'],[11,2,'automne'],[6,15,'printemps']]) {
    assert.equal(r.getSeasonalActivation(h.date(2026,month,day)).theme, expected);
  }
  assert.equal(r.getSeasonalActivation(h.date(2026,12,26)).activationId, r.getSeasonalActivation(h.date(2027,1,3)).activationId);
});

test('thèmes cachés absents du sélecteur et refusés manuellement', async () => {
  const h = harness(); h.load('theme-manager');
  for (const special of h.context.SalonThemeConfig.SPECIAL_THEMES) {
    assert.equal(special.hiddenFromThemeSelector, true);
    assert.equal(h.context.SalonThemeConfig.THEME_LIST.some(t => t.id === special.id), false);
    assert.equal(await h.context.SalonTheme.setTheme(special.id), false);
  }
  const stale = harness('2026-06-15', { selectedTheme: 'paques' });
  assert.equal(stale.context.SalonThemePreferences.loadLocal('test-user').selectedTheme, 'default');
});

test('manuel conservé pendant événement, restauration à sa fin et stockage sans événement', async () => {
  const h = harness(); h.load('theme-manager');
  const api = h.context.SalonTheme;
  await api.sync();
  assert.equal(h.attributes['data-theme'], 'saint-valentin');
  await api.setTheme('floral');
  assert.equal(h.attributes['data-theme'], 'saint-valentin');
  assert.equal(api.getState().selectedTheme, 'floral');
  h.setDay('2026-02-16'); await api.activateSeasonOnce();
  assert.equal(h.attributes['data-theme'], 'floral');
  assert.ok(h.saves.every(s => !h.context.SalonThemeConfig.SPECIAL_THEMES.some(t => t.id === s.selectedTheme)));
});

test('automatique : saison de fond actualisée et nouvelle saison sous anniversaire', async () => {
  const h = harness('2026-02-14', { lastSeasonalActivationId: null }); h.load('theme-manager');
  await h.context.SalonTheme.sync();
  assert.equal(h.context.SalonTheme.getState().selectedTheme, 'hiver');
  h.setDay('2026-02-16'); await h.context.SalonTheme.activateSeasonOnce();
  assert.equal(h.attributes['data-theme'], 'hiver');
  h.setDay('2026-03-20'); await h.context.SalonTheme.activateSeasonOnce();
  assert.equal(h.attributes['data-theme'], 'anniversaire-marion');
  h.setDay('2026-03-23'); await h.context.SalonTheme.activateSeasonOnce();
  assert.equal(h.attributes['data-theme'], 'anniversaire-marion');
  h.setDay('2026-03-24'); await h.context.SalonTheme.activateSeasonOnce();
  assert.equal(h.attributes['data-theme'], 'printemps');
  h.setDay('2026-06-22'); await h.context.SalonTheme.activateSeasonOnce();
  assert.equal(h.attributes['data-theme'], 'anniversaire-juliie');
  h.setDay('2026-06-24'); await h.context.SalonTheme.activateSeasonOnce();
  assert.equal(h.attributes['data-theme'], 'plage');
});

test('animations ON/OFF et réduction des mouvements : décors conservés', async () => {
  for (const reduced of [false, true]) {
    const h = harness('2026-02-14', {}, reduced); h.load('theme-manager');
    assert.equal(h.attributes['data-animations'], reduced ? 'off' : 'on');
    const overlay = h.nodes.get('theme-decorations');
    assert.equal(overlay.children.length, 27);
    await h.context.SalonTheme.setAnimationsEnabled(false);
    assert.equal(h.attributes['data-animations'], 'off'); assert.equal(overlay.children.length, 27);
    assert.equal(overlay.classList['is-static'], true);
    await h.context.SalonTheme.setAnimationsEnabled(true);
    assert.equal(h.attributes['data-animations'], reduced ? 'off' : 'on');
  }
});

test('reprise PWA et minuterie de minuit recalculent le thème', async () => {
  const h = harness(); h.load('theme-manager'); await h.context.SalonTheme.sync();
  await Promise.resolve();
  h.setDay('2026-02-16'); h.listeners.pageshow();
  assert.equal(h.attributes['data-theme'], 'galaxy');
  h.setDay('2027-02-14'); h.listeners.visibilitychange();
  assert.equal(h.attributes['data-theme'], 'saint-valentin');
  assert.ok(h.timers.some(t => t.delay > 0 && t.delay <= 86400100));
});

test('aperçus refusés aux collaboratrices et aux comptes différents', () => {
  const h = harness(); h.load('theme-manager');
  const api = h.context.SalonTheme;
  assert.equal(api.previewSpecialTheme('paques'), false);
  for (const user of [{ id: 'test-user', role: 'collab' }, { id: 'another-user', role: 'admin' }, { id: 'test-user', role: 'admin', active: false }]) {
    h.context.SalonAuth = { getCurrentUser: () => user, isAdmin: user => user.role === 'admin' };
    assert.equal(api.previewSpecialTheme('paques'), false);
    assert.equal(api.getState().previewTheme, null);
  }
});

test('administrateur : quatre aperçus temporaires, animations et retour au thème normal', async () => {
  const h = harness();
  h.context.SalonAuth = { getCurrentUser: () => ({ id: 'test-user', role: 'admin' }), isAdmin: user => user.role === 'admin' };
  h.load('theme-manager');
  const api = h.context.SalonTheme;
  await api.sync();
  const selected = api.getState().selectedTheme;
  for (const special of h.context.SalonThemeConfig.SPECIAL_THEMES) {
    assert.equal(api.previewSpecialTheme(special.id), true);
    assert.equal(h.attributes['data-theme'], special.id);
    assert.equal(api.getState().previewTheme, special.id);
    assert.equal(api.getState().selectedTheme, selected);
    assert.equal(await api.setTheme(special.id), false);
  }
  await api.setAnimationsEnabled(false);
  assert.equal(h.attributes['data-animations'], 'off');
  assert.equal(api.getState().previewTheme, 'paques');
  api.stopSpecialThemePreview();
  assert.equal(h.attributes['data-theme'], 'saint-valentin');
  assert.equal(api.getState().previewTheme, null);
  api.previewSpecialTheme('paques');
  await api.setTheme('floral');
  assert.equal(api.getState().previewTheme, null);
  h.setDay('2026-02-16'); await api.activateSeasonOnce();
  assert.equal(h.attributes['data-theme'], 'floral');
  assert.ok(h.saves.every(s => !s.previewTheme && h.context.SalonThemeConfig.isSelectableThemeId(s.selectedTheme)));
  api.previewSpecialTheme('paques');
  h.load('theme-manager');
  assert.equal(api.getState().selectedTheme, h.context.SalonTheme.getState().selectedTheme);
  assert.equal(h.context.SalonTheme.getState().previewTheme, null);
});

test('Apparence : quatre boutons uniquement pour administrateur, aucun choix manuel caché', () => {
  const h = harness(); h.load('theme-manager');
  h.context.SalonUtils = { escapeHtml: text => text };
  h.context.SalonAuth = { isAdmin: user => user.role === 'admin' };
  vm.runInContext(fs.readFileSync('js/ui/appearance-card.js', 'utf8'), h.context);
  for (const role of ['admin', 'collab']) {
    h.context.user = { role };
    const output = h.context.SalonAppearanceCard.render(h.context.user);
    assert.equal((output.match(/data-special-theme-preview=/g) || []).length, role === 'admin' ? 4 : 0);
    for (const special of h.context.SalonThemeConfig.SPECIAL_THEMES) {
      assert.equal(output.includes('name="appearanceTheme" value="' + special.id + '"'), false);
      if (role === 'collab') assert.equal(output.includes(special.id), false);
    }
  }
});

test('anniversaire sur quatre jours civils : minuit, fin de mois et changement d’année', () => {
  const h = harness(), c = h.context.SalonThemeConfig, r = h.context.SalonSeasonalTheme;
  const theme = c.specialThemeById('anniversaire-marion');
  for (const [month, day] of [[3,20], [1,30], [12,30], [3,28]]) {
    Object.assign(c.MARION_BIRTHDAY, { month, day });
    const start = h.date(2026, month, day); start.setHours(0,0,0,0);
    const end = h.date(2026, month, day + 4); end.setHours(0,0,0,0);
    assert.equal(r.isSpecialActive(theme, new Date(start.getTime() - 1)), false);
    assert.equal(r.isSpecialActive(theme, start), true);
    assert.equal(r.isSpecialActive(theme, new Date(end.getTime() - 1)), true);
    assert.equal(r.isSpecialActive(theme, end), false);
  }
  Object.assign(c.MARION_BIRTHDAY, { month: 2, day: 29 });
  assert.equal(r.isSpecialActive(theme, h.date(2027,3,1)), false);
  assert.equal(r.isSpecialActive(theme, h.date(2028,3,3)), true);
  assert.equal(r.isSpecialActive(theme, h.date(2028,3,4)), false);
});
