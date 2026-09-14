const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const JSZip = require('jszip');

function app(extra = {}) {
  const context = vm.createContext({ JSZip, Blob, Date, console, ...extra });
  vm.runInContext(fs.readFileSync('js/18-asset-out.js', 'utf8'), context);
  return context;
}

test('export fills the attached form at its merged anchors and preserves labels', async () => {
  const ctx = app();
  const data = {
    instrument_name: 'Balance & <test>', asset_no: 'ILC-123', id_code: 'B-001',
    is_component_of: 'Line 1', job_order_no: 'JOB-42', detail: 'Calibration',
    pr_no: 'PR-01', po_no: 'PO-02', purpose: 'External calibration',
    vendor_name: 'Vendor', vendor_address: 'Address', vendor_phone: '0123456',
    vendor_fax: '09999', vendor_email: 'mail@example.com', vendor_contact: 'Contact',
    cost_center: '44200', dept_name: 'QIP', permit_date: '2026-09-11', due_date: '2026-09-30'
  };
  const blob = await ctx.assetOutRenderTemplate(fs.readFileSync('assets/frm-asset-out-template.xlsx'), data, null);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  const cell = addr => sheet.match(new RegExp('<c r="' + addr + '"[^>]*>[\\s\\S]*?</c>'))?.[0] || '';
  for (const [addr, expected] of Object.entries({ C6: 'Balance &amp; &lt;test&gt;', H6: 'ILC-123', H8: 'B-001',
    D8: 'Line 1', C10: 'JOB-42', E12: 'Calibration', B14: 'PR-01', H14: 'PO-02',
    G16: 'External calibration', C22: '0123456', G22: '09999', J22: 'mail@example.com',
    C24: 'Contact', I28: 'QIP', I40: 'QIP', L28: '44200', L40: '44200' })) {
    assert.ok(cell(addr).includes(expected), addr + ' must contain ' + expected);
  }
  assert.ok(cell('H4').includes('<v>46276</v>'));
  assert.ok(cell('H24').includes('<v>46295</v>'));
  const styles = await zip.file('xl/styles.xml').async('string');
  const xfs = styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)[1].match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g);
  for (const addr of ['H4', 'H24']) {
    const styleId = Number(cell(addr).match(/ s="(\d+)"/)[1]);
    assert.match(xfs[styleId], /numFmtId="14"/, addr + ' must display as a date');
  }
  assert.ok(sheet.includes('ref="C6:F6"'));
  assert.ok(sheet.includes('ref="G16:L16"'));
  assert.ok(!cell('A6').includes(data.instrument_name));
});

test('page has an accessible add action and existing permits expose Excel export', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(/id="gateAddBtn"[^>]*onclick="openAssetOutPicker\(\)"/.test(html), 'offsite page must provide an add button');
  assert.match(fs.readFileSync('js/27-asset-out-page.js', 'utf8'), /Export Excel/);
});

test('viewers cannot open a creation form or submit one', async () => {
  let requests = 0;
  const ctx = app({ currentUser: { role: 'viewer' }, showToast() {}, sb: { from() { requests++; throw new Error('unexpected request'); } } });
  await ctx.openAssetOutModal(1);
  await ctx.assetOutSubmit();
  assert.equal(requests, 0);
});

test('picker searches the register and escapes instrument text', () => {
  const elements = { ao_instrument_search: { value: 'asset-2' }, ao_instrument_results: {} };
  const ctx = app({ document: { getElementById: id => elements[id] }, allData: [
    { id: 1, id_code: 'A1', asset_no: 'asset-1', instrument_name: 'Other' },
    { id: 2, id_code: 'B2', asset_no: 'asset-2', instrument_name: '<script>bad</script>' }
  ] });
  ctx.renderAssetOutPicker();
  assert.match(elements.ao_instrument_results.innerHTML, /openAssetOutModal\(2\)/);
  assert.ok(!elements.ao_instrument_results.innerHTML.includes('openAssetOutModal(1)'));
  assert.ok(!elements.ao_instrument_results.innerHTML.includes('<script>'));
});

test('a saved permit refreshes and closes even when export fails, without duplicate inserts', async () => {
  let inserts = 0, refreshes = 0, closed = 0;
  const notices = [];
  const elements = { assetOutModal: { classList: { remove() { closed++; } } }, ao_submit: {} };
  const ctx = app({ currentUser: { role: 'admin', name: 'Tester' },
    document: { getElementById: id => elements[id] || { value: '' } },
    showToast: text => notices.push(text), loadAssetOutPage: async () => { refreshes++; },
    sb: { from() { return { insert() { inserts++; return { select() { return { single: async () => ({ data: { id: 42 } }) }; } }; } }; } }
  });
  vm.runInContext("aoState.inst = { id: 7, instrument_name: 'Balance' }; assetOutExport = async () => { throw new Error('offline'); };", ctx);
  await Promise.all([ctx.assetOutSubmit(), ctx.assetOutSubmit()]);
  assert.equal(inserts, 1);
  assert.equal(refreshes, 1);
  assert.equal(closed, 1);
  assert.equal(elements.ao_submit.disabled, false);
  assert.ok(notices.some(n => n.includes('บันทึกใบแล้ว')));
});

test('database failures keep the form available for retry and do not report success', async () => {
  let closed = false;
  const notices = [];
  const ctx = app({ currentUser: { role: 'editor' },
    document: { getElementById: () => ({ value: '', classList: { remove() { closed = true; } } }) },
    showToast: text => notices.push(text),
    sb: { from() { return { insert() { return { select() { return { single: async () => ({ error: { message: 'offline' } }) }; } }; } }; } }
  });
  vm.runInContext("aoState.inst = { id: 7 };", ctx);
  await ctx.assetOutSubmit();
  assert.equal(closed, false);
  assert.equal(vm.runInContext('aoSubmitting', ctx), false);
  assert.ok(notices.every(n => n.includes('บันทึกไม่สำเร็จ')));
});

test('photo export replaces only the photo placeholder and leaves the logo unchanged', async () => {
  const template = fs.readFileSync('assets/frm-asset-out-template.xlsx');
  const before = await JSZip.loadAsync(template);
  const photo = Buffer.from('test photo bytes');
  const blob = await app().assetOutRenderTemplate(template, {}, photo);
  const after = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.deepEqual(await after.file('xl/media/image3.jpeg').async('nodebuffer'), photo);
  assert.deepEqual(await after.file('xl/media/image1.png').async('nodebuffer'), await before.file('xl/media/image1.png').async('nodebuffer'));
  assert.equal(after.file('xl/media/image2.png'), null);
});
