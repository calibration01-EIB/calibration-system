const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx = vm.createContext({ document: { getElementById: () => ({ addEventListener() {} }) } });
vm.runInContext(fs.readFileSync('js/03-instruments.js', 'utf8'), ctx);

test('tolerance display adds plus-minus once for each numeric band', () => {
  for (const [input, expected] of [
    ['0.1 g', '± 0.1 g'], ['+/-0.05 mm / 0.1 mm', '± 0.05 mm / ± 0.1 mm'],
    ['± 2 oC', '± 2 °C'], ['0.5 mg/L', '± 0.5 mg/L'],
    ['0', '± 0'], ['20 -40 ± 3', '20 -40 ± 3'], ['≤ 2 oC', '≤ 2 °C'],
    ['+2/-1 °C', '+2/-1 °C'], ['N/A', 'N/A'], [null, ''],
    ['0.1g/0.2g', '± 0.1g / ± 0.2g'], ['0 to 100', '0 to 100']
  ]) assert.equal(ctx.formatInstrumentTolerance(input), expected, input);
});

test('Celsius display normalizes unit variants without changing other words', () => {
  for (const [input, expected] of [
    ['0-100oC', '0-100°C'], ['0.1 oC/min', '0.1 °C/min'],
    ['25 ºC', '25 °C'], ['25 ℃', '25 °C'], ['10 °C', '10 °C'],
    ['oC', '°C'], ['ThermoController', 'ThermoController'], ['mg/L', 'mg/L']
  ]) assert.equal(ctx.normalizeInstrumentUnitText(input), expected);
});

test('register table renders corrected units and tolerance without mutating data', () => {
  const table = { innerHTML: '' };
  const runtime = vm.createContext({ window: {}, localStorage: { getItem: () => null },
    document: { getElementById: id => id === 'dataTableFull' ? table : { addEventListener() {} }, addEventListener() {} }
  });
  for (const file of ['js/02-dashboard.js', 'js/03-instruments.js', 'js/26-list-ui.js']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), runtime);
  }
  runtime.regTypeMeta = () => ['T', '', '#000'];
  runtime.cwRegistryShortcutHtml = () => '';
  const row = { id: 1, tolerance: '2 oC', resolution_text: '0.1 oC', range_val: '0-100oC', days_left: null };
  runtime.renderListFull([row], 0);
  assert.match(table.innerHTML, /± 2 °C/);
  assert.match(table.innerHTML, /0\.1 °C/);
  assert.match(table.innerHTML, /0-100°C/);
  assert.equal(row.tolerance, '2 oC');
});
