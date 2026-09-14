const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function app(extra = {}) {
  const ctx = vm.createContext({ console, Date, ...extra });
  const path = 'js/30-reference-library.js';
  if (fs.existsSync(path)) vm.runInContext(fs.readFileSync(path, 'utf8'), ctx);
  return ctx;
}
const NOW = new Date('2026-09-11T12:00:00');
const weights = [
  { id: 1, set_code: 'SET-A', class_grade: 'E2', nominal_value: 1, unit: 'g', cert_no: 'W-01', due_date: '2027-01-01', status: 'approved' },
  { id: 2, set_code: 'SET-A', class_grade: 'F1', nominal_value: 1, unit: 'kg', cert_no: 'W-02', due_date: '2026-08-01', status: 'draft' }
];
const certs = [
  { id: 11, category: 'เครื่องชั่ง', set_code: 'BAL-A', cert_no: 'B-01', due_date: '2027-01-01', values: [] },
  { id: 12, category: 'อุณหภูมิ', item: 'Thermometer', set_code: 'TEMP-A', cert_no: 'T-01', due_date: '2026-10-01', values: [{ nominal_value: 20 }] },
  { id: 13, category: 'ชนิดใหม่', set_code: 'OTHER-A', cert_no: 'X-01', values: [] }
];
test('library includes every source, groups weight sets and classifies all types', () => {
  const ctx = app();
  assert.equal(typeof ctx.refBuildEntries, 'function', 'combined reference library is available');
  const rows = ctx.refBuildEntries(weights, certs, NOW);
  assert.equal(rows.length, 4);
  const mass = rows.find(r => r.source === 'weights');
  assert.equal(mass.category, 'mass');
  assert.equal(mass.count, 2);
  assert.equal(mass.state, 'expired');
  assert.equal(mass.pending, 1);
  assert.ok(mass.certNo.includes('W-01') && mass.certNo.includes('W-02'));
  assert.ok(mass.grade.includes('E2') && mass.grade.includes('F1'));
  assert.equal(rows.find(r => r.id === 12).category, 'temperature');
  assert.equal(rows.find(r => r.id === 13).category, 'other');
  assert.equal(rows.find(r => r.id === 13).state, 'nodue');
});
test('category, type, class, status and query compose without mixing sources', () => {
  const ctx = app();
  assert.equal(typeof ctx.refFilterEntries, 'function');
  const rows = ctx.refBuildEntries(weights, certs, NOW);
  const filtered = ctx.refFilterEntries(rows, { category: 'mass', type: 'weights', grade: 'F1', status: 'pending', query: 'W-02' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].source, 'weights');
  assert.equal(ctx.refFilterEntries(rows, { category: 'temperature', query: 'W-02' }).length, 0);
});
test('a newer cert supersedes only the same instrument type and identity', () => {
  const ctx = app();
  assert.equal(typeof ctx.refBuildEntries, 'function');
  const rows = ctx.refBuildEntries([], [
    { id: 1, category: 'อุณหภูมิ', set_code: 'A', serial_no: 'S', measurement_date: '2025-01-01' },
    { id: 2, category: 'อุณหภูมิ', set_code: 'A', serial_no: 'S', measurement_date: '2026-01-01' },
    { id: 3, category: 'ความดัน', set_code: 'A', serial_no: 'S', measurement_date: '2024-01-01' }
  ], NOW);
  assert.equal(rows[0].state, 'superseded');
  assert.equal(rows[2].state, 'nodue');
});
