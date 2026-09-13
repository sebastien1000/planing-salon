const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load() {
  const context = { window: { SalonUtils: {}, SalonData: {} } };
  vm.createContext(context);
  for (const file of ['domain', 'form-holidays']) {
    vm.runInContext(fs.readFileSync(`js/core/${file}.js`, 'utf8'), context);
  }
  return context.window;
}

test('listes : fin inclusive, date locale et transitions de calendrier', () => {
  const { isCurrentOrUpcomingPeriod: visible } = load().SalonDomain;
  for (const [lastDay, nextDay] of [
    ['2026-09-13', '2026-09-14'],
    ['2026-12-31', '2027-01-01'],
    ['2028-02-29', '2028-03-01'],
    ['2026-03-29', '2026-03-30']
  ]) {
    const period = { startDate: lastDay, endDate: lastDay };
    assert.equal(visible(period, new Date(lastDay + 'T23:59:59')), true);
    assert.equal(visible(period, new Date(nextDay + 'T00:00:00')), false);
    assert.equal(visible({ startDate: nextDay }, new Date(lastDay + 'T12:00:00')), true);
  }
});

test('congés : filtrer par collaboratrice sans supprimer ni modifier l’historique', () => {
  const app = load();
  const periods = [
    { collab: 'Marion', startDate: '2000-01-01', endDate: '2000-01-03' },
    { collab: 'Marion', startDate: '2099-01-01', endDate: '2099-01-03' },
    { collab: 'Julie', startDate: '2099-02-01', endDate: '2099-02-03' }
  ];
  const before = JSON.stringify(periods);
  const visible = app.SalonHolidayForms.holidaysForCollab(periods, 'Marion');
  assert.equal(visible.length, 1);
  assert.equal(visible[0], periods[1]);
  assert.equal(JSON.stringify(periods), before);
  assert.equal(app.SalonDomain.periodCoversDate(periods[0], '2000-01-02'), true);
});
