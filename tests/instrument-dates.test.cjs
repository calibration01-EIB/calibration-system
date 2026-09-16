const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function app() {
  const fields = Object.fromEntries(['iDueDate', 'iCalDate', 'iCertNo', 'iPrevCertNo', 'iPrevCalDate']
    .map(id => [id, { value: '' }]));
  const ctx = vm.createContext({ document: { getElementById: id => fields[id] || { addEventListener() {} } },
    editingInstrumentId: 1, allData: [{ id: 1, cert_no: 'OLD', cal_date: '2025-09-01', prev_cert_no: 'PREV', prev_cal_date: '2024-09-01' }] });
  for (const file of ['js/05-audit.js', 'js/03-instruments.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
  vm.runInContext('editingInstrumentId = 1', ctx);
  return { ctx, fields };
}

test('changing the calibration date updates the due date', () => {
  const { ctx, fields } = app();
  fields.iDueDate.value = '2026-09-01';
  ctx.calcDueDate('16/09/2026', '1ครั้ง/ปี');
  assert.equal(fields.iDueDate.value, '16/09/2027');
});

for (const [date, frequency] of [['16/09/2026', ''], ['', '1ครั้ง/ปี'], ['16/09/2026', 'unknown']]) {
  test(`does not retain an old due date when calculation is unavailable: ${date}/${frequency}`, () => {
    const { ctx, fields } = app();
    fields.iDueDate.value = '2026-09-01';
    ctx.calcDueDate(date, frequency);
    assert.equal(fields.iDueDate.value, '');
  });
}

test('date change handler previews the prior calibration and restores it when reverted', () => {
  const { ctx, fields } = app();
  fields.iCertNo.value = 'OLD';
  fields.iCalDate.value = '16/09/2026';
  ctx.autoFillPrevCert();
  assert.equal(fields.iPrevCalDate.value, '01/09/2025');
  assert.equal(fields.iPrevCertNo.value, 'OLD');
  fields.iCalDate.value = '01/09/2025';
  ctx.autoFillPrevCert();
  assert.equal(fields.iPrevCalDate.value, '01/09/2024');
  assert.equal(fields.iPrevCertNo.value, 'PREV');
});

test('dates round-trip between ISO storage and fixed day/month/year', () => {
  const { ctx } = app();
  for (const iso of ['2026-09-16', '2026-01-02', '2024-02-29']) {
    assert.equal(ctx.parseInstrumentDate(ctx.formatInstrumentDate(iso)), iso);
  }
  assert.equal(ctx.formatInstrumentDate('2026-01-02'), '02/01/2026');
  assert.equal(ctx.parseInstrumentDate('02/01/2026'), '2026-01-02');
  assert.equal(ctx.formatInstrumentDate(null), '');
  assert.equal(ctx.parseInstrumentDate(''), null);
});

test('rejects impossible dates, incomplete entries, and other formats', () => {
  const { ctx } = app();
  for (const value of ['31/02/2026', '29/02/2025', '31/04/2026', '00/01/2026',
    '01/13/2026', '16/09/26', '1/2/2026', '2026-09-16', '09/16/2026', '01/01/0000']) {
    assert.equal(ctx.parseInstrumentDate(value), null, value);
  }
});

test('two digits advance from day to month and from month to year', () => {
  const { ctx, fields } = app();
  let focused = '';
  for (const [id, value] of [['iCalDay', '16'], ['iCalMonth', '09'], ['iCalYear', '2026'], ['iCalFrequency', '1ครั้ง/ปี']]) {
    fields[id] = { id, value, focus() { focused = id; }, select() {} };
  }
  ctx.instrumentDatePartInput(fields.iCalDay);
  assert.equal(focused, 'iCalMonth');
  ctx.instrumentDatePartInput(fields.iCalMonth);
  assert.equal(focused, 'iCalYear');
  assert.equal(fields.iCalDate.value, '16/09/2026');
  assert.equal(fields.iDueDate.value, '16/09/2027');
});

test('leaving an unchanged date preserves the stored due date', () => {
  const { ctx, fields } = app();
  for (const [id, value] of [['iCalDay', '16'], ['iCalMonth', '09'], ['iCalYear', '2026'], ['iCalFrequency', '']]) {
    fields[id] = { id, value };
  }
  fields.iCalDate.value = '16/09/2026';
  fields.iDueDate.value = '30/09/2027';
  ctx.finishInstrumentDatePart(fields.iCalDay);
  assert.equal(fields.iDueDate.value, '30/09/2027');
});

test('opening an existing record formats all dates and a new record clears them', () => {
  const { ctx, fields } = app();
  ctx.document.getElementById = id => fields[id] ||= {
    value: '', dataset: {}, classList: { add() {} }
  };
  for (const name of ['initInstrumentModalTabs', 'setInstrumentModalTab',
    'clearInstrumentDuplicateWarning', 'setRangeField', 'setCapacityField',
    'setToleranceFields', 'setBandFields', 'initInstrumentDuplicateCheck',
    'checkInstrumentDuplicates']) ctx[name] = () => {};
  ctx.allData[0].due_date = '2026-09-01';
  ctx.openInstrumentModal(1);
  assert.equal(fields.iCalDate.value, '01/09/2025');
  assert.equal(fields.iCalDay.value, '01');
  assert.equal(fields.iCalMonth.value, '09');
  assert.equal(fields.iCalYear.value, '2025');
  assert.equal(fields.iDueDate.value, '01/09/2026');
  assert.equal(fields.iPrevCalDate.value, '01/09/2024');
  ctx.openInstrumentModal();
  assert.equal(fields.iCalDate.value, '');
  assert.equal(fields.iDueDate.value, '');
  assert.equal(fields.iPrevCalDate.value, '');
  assert.equal(fields.iCalDay.value, '');
  assert.equal(fields.iCalMonth.value, '');
  assert.equal(fields.iCalYear.value, '');
});

test('save rejects an invalid date before contacting the database', async () => {
  const { ctx, fields } = app();
  const messages = [];
  fields.iCalDate.value = '31/02/2026';
  ctx.document.getElementById = id => fields[id] || { value: '', dataset: {} };
  let focused = false;
  fields.iCalDay = { focus: () => { focused = true; } };
  ctx.setInstrumentModalTab = tab => assert.equal(tab, 'calibration');
  ctx.showToast = message => messages.push(message);
  await ctx.saveInstrument();
  assert.equal(focused, true);
  assert.match(messages[0], /DD\/MM\/YYYY/);
});

test('editing sends ISO dates to storage and preserves prior ISO history', async () => {
  const { ctx, fields } = app();
  const fallback = { value: '', addEventListener() {}, dataset: {} };
  ctx.document.getElementById = id => fields[id] || fallback;
  fields.iCalDate.value = '16/09/2026';
  fields.iDueDate.value = '16/09/2027';
  fields.iCertNo.value = 'OLD';
  fields.iIdCode = { value: 'TEST-01' };
  ctx.checkInstrumentDuplicates = () => [];
  ctx.getInstrumentDuplicateMatchesFromDb = async () => [];
  ctx.getDiff = () => null;
  ctx.logAudit = async () => {};
  ctx.closeInstrumentModal = () => {};
  ctx.loadData = async () => {};
  ctx.setTimeout = () => {};
  ctx.showToast = (message, type) => { assert.notEqual(type, 'error', message); };
  let saved, history;
  ctx.sb = { from(table) { return {
    insert: async row => { assert.equal(table, 'calibration_history'); history = row; return {}; },
    update: row => ({ eq: async () => { saved = row; return {}; } })
  }; } };
  await ctx.saveInstrument();
  assert.equal(saved.cal_date, '2026-09-16');
  assert.equal(saved.due_date, '2027-09-16');
  assert.equal(saved.prev_cal_date, '2025-09-01');
  assert.equal(history.cal_date, '2025-09-01');
});
