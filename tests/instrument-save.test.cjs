const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function app({ editing = true, denied = false, refresh = true, dbError = null } = {}) {
  const fields = {};
  const messages = [], audits = [], history = [];
  let closed = false;
  const ctx = vm.createContext({
    window: {}, document: { getElementById: id => fields[id] ||= {
      value: '', dataset: {}, addEventListener() {}, focus() {}
    }, querySelectorAll: () => [] },
    allData: [{ id: 1, cert_no: 'OLD', cal_date: '2025-01-01' }],
    filteredData: [], currentPage: 1, pageSize: 100,
    setTimeout() {}, showToast: (message, type) => messages.push({ message, type }),
  });
  vm.runInContext(fs.readFileSync('js/03-instruments.js', 'utf8'), ctx);
  vm.runInContext(`editingInstrumentId = ${editing ? 1 : 'null'}`, ctx);
  fields.iIdCode = { value: 'TEST-01' };
  fields.iCertNo = { value: 'NEW' };
  ctx.checkInstrumentDuplicates = () => [];
  ctx.getInstrumentDuplicateMatchesFromDb = async () => [];
  ctx.getDiff = () => ({});
  ctx.requireInstrumentWriteSession = async () => {};
  ctx.logAudit = async (...args) => audits.push(args);
  ctx.closeInstrumentModal = () => { closed = true; };
  ctx.resetFilters = () => { ctx.filteredData = [...ctx.allData]; ctx.currentPage = 1; };
  ctx.renderTable = () => {};
  ctx.loadData = async () => {
    if (refresh) {
      ctx.allData = Array.from({ length: 201 }, (_, i) => ({ id: i + 1 }));
      ctx.filteredData = [...ctx.allData];
    }
    return refresh;
  };
  const result = () => ({ data: denied || dbError ? null : { id: editing ? 1 : 201 }, error: dbError });
  const response = () => ({ ...result(), select() { return this; }, single: async () => result() });
  ctx.sb = { from: table => ({
    update: () => ({ eq: () => response() }),
    insert: row => {
      if (table === 'calibration_history') { history.push(row); return Promise.resolve({ error: null }); }
      return response();
    }
  }) };
  return { ctx, messages, audits, history, isClosed: () => closed };
}

test('zero-row update is not reported as saved and keeps the form open', async () => {
  const a = app({ denied: true });
  await a.ctx.saveInstrument();
  assert.equal(a.messages.some(m => m.type === 'success'), false);
  assert.equal(a.audits.length, 0);
  assert.equal(a.history.length, 0);
  assert.equal(a.isClosed(), false);
  assert.equal(a.messages.some(m => m.type === 'error'), true);
});

test('newly saved instrument is visible on its actual page after reload', async () => {
  const a = app({ editing: false });
  await a.ctx.saveInstrument();
  assert.equal(a.ctx.currentPage, 3);
  assert.equal(a.ctx.filteredData.slice(200, 300).some(row => row.id === 201), true);
});

test('PostgREST zero-row error prompts login and preserves the edited form', async () => {
  const a = app({ dbError: { code: 'PGRST116', message: 'Cannot coerce the result to a single JSON object' } });
  await a.ctx.saveInstrument();
  assert.equal(a.messages.some(m => /เข้าสู่ระบบใหม่/.test(m.message)), true);
  assert.equal(a.messages.some(m => m.type === 'success'), false);
  assert.equal(a.history.length, 0);
  assert.equal(a.isClosed(), false);
});

test('expired session blocks all writes while keeping the filled form open', async () => {
  const a = app();
  let writes = 0;
  a.ctx.requireInstrumentWriteSession = async () => { throw new Error('กรุณาเข้าสู่ระบบใหม่'); };
  a.ctx.sb.from = () => { writes++; throw new Error('must not write'); };
  await a.ctx.saveInstrument();
  assert.equal(writes, 0);
  assert.equal(a.isClosed(), false);
  assert.equal(a.messages.some(m => /เข้าสู่ระบบใหม่/.test(m.message)), true);
});

test('failed reload reports that save succeeded but the list could not refresh', async () => {
  const a = app({ editing: false, refresh: false });
  await a.ctx.saveInstrument();
  assert.equal(a.messages.some(m => /บันทึกแล้ว.*โหลด/.test(m.message)), true);
});

test('registry reload returns saved cost center and prior calibration fields', async () => {
  const saved = { id: 1, cost_center: 'CC-10', prev_cert_no: 'OLD', prev_cal_date: '2025-01-01' };
  const ctx = vm.createContext({ window: { HAS_TOL_BANDS: true }, currentUser: { role: 'admin' },
    showToast: message => assert.fail(message),
    sb: { from: () => ({ select: (cols, options) => options?.head
      ? Promise.resolve({ count: 1 })
      : { order: () => ({ range: async () => ({ data: [Object.fromEntries(
        cols.split(',').filter(key => key in saved).map(key => [key, saved[key]]))] }) }) }
    }) }
  });
  vm.runInContext(fs.readFileSync('js/02-dashboard.js', 'utf8'), ctx);
  const [row] = await ctx.fetchFromSupabase();
  assert.equal(row.cost_center, saved.cost_center);
  assert.equal(row.prev_cert_no, saved.prev_cert_no);
  assert.equal(row.prev_cal_date, saved.prev_cal_date);
});
