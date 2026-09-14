// Run with NODE_PATH pointing to a runtime containing Playwright.
// Uses local source files and synthetic records only; no application network calls.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const root = process.cwd();
    const html = fs.readFileSync('index.html', 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://reference.test') return route.abort();
      if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html });
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ path: file });
    });
    await page.goto('http://reference.test/');
    await page.addScriptTag({ content: `
      var currentUser = { role: 'admin', name: 'Tester' };
      var escapeHtmlText = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      var escapeHtmlAttr = v => escapeHtmlText(v).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
      var escapeJsSingle = v => String(v ?? '');
      var showToast = console.log, showLoading = () => {}, hideLoading = () => {}, logAudit = async () => {};
      var loadCmcSets = () => {}, loadCalPresets = () => {};
      var mockWeights = [
        { id:1,set_code:'STD-E2-01',class_grade:'E2',nominal_value:1,unit:'g',id_code:'W-001',serial_no:'SN100',cert_no:'MASS-2026-001',due_date:'2027-06-01',correction:0.00001,prev_correction:0.00002,uncertainty:0.02,status:'approved',cert_file_path:'set/current.pdf',prev_cert_file_path:'set/prev.pdf',prev_cert_no:'MASS-2024-001' },
        { id:2,set_code:'STD-E2-01',class_grade:'E2',nominal_value:1,unit:'kg',id_code:'W-002',serial_no:'SN101',cert_no:'MASS-2026-001',due_date:'2027-06-01',correction:0.00002,prev_correction:0.00001,uncertainty:0.03,status:'draft' },
        { id:3,set_code:'STD-F1-02',class_grade:'F1',nominal_value:100,unit:'g',id_code:'W-003',cert_no:'MASS-2025-008',due_date:'2025-01-01',correction:0,uncertainty:0.5,status:'approved' }
      ];
      var mockCerts = [
        {id:11,category:'เครื่องชั่ง',item:'Electronic Balance',set_code:'BAL-01',cert_no:'BAL-2026-017',serial_no:'B100',measurement_date:'2026-01-01',due_date:'2027-01-01'},
        {id:12,category:'อุณหภูมิ',item:'Digital Thermometer',set_code:'TEMP-01',cert_no:'TEMP-2026-042',serial_no:'T100',measurement_date:'2026-01-01',due_date:'2026-10-01'},
        {id:13,category:'ความดัน',item:'Digital Pressure Gauge',set_code:'PRESS-01',cert_no:'P-2026-006',serial_no:'P100',measurement_date:'2026-01-01',due_date:'2027-01-01'},
        {id:14,category:'ความยาว/มิติ',item:'Digital Caliper',set_code:'DIM-01',cert_no:'DIM-2026-014',serial_no:'D100',measurement_date:'2026-01-01',due_date:'2027-01-01'},
        {id:15,category:'ไฟฟ้า',item:'Digital Multimeter',set_code:'ELEC-01',cert_no:'E-2026-021',serial_no:'E100',measurement_date:'2026-01-01',due_date:'2027-01-01'}
      ];
      var mockFailCerts = false;
      var sb = {
        from(table) {
          const result = () => table === 'standard_weights' ? {data:mockWeights} : table === 'standard_certs'
            ? (mockFailCerts ? {error:{message:'offline'}} : {data:mockCerts}) : {data:[]};
          const q = { select(){return q}, order(){return q}, then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)},
            update(patch) { return { eq:async(key,id)=>{mockWeights.filter(w=>w[key]===id).forEach(w=>Object.assign(w,patch));return {};},
              in:async(key,ids)=>{mockWeights.filter(w=>ids.includes(w[key])).forEach(w=>Object.assign(w,patch));return {};} }; }
          };
          return q;
        },
        storage: { from: () => ({ list:async()=>({data:[]}) }) }
      };
    ` });
    for (const file of ['js/08-weights.js', 'js/12-standard-certs.js', 'js/30-reference-library.js']) await page.addScriptTag({ path: file });
    await page.evaluate(async () => {
      document.getElementById('loginPage').style.setProperty('display','none','important');
      document.getElementById('splashScreen').style.setProperty('display','none','important');
      document.getElementById('app').style.display = 'block';
      document.querySelectorAll('.page-content').forEach(e => e.style.display = 'none');
      document.getElementById('pageWeights').style.display = 'block';
      await loadReferencePage();
    });
    assert.equal(await page.locator('#refResults .ref-row').count(), 7);
    assert.equal(await page.locator('#refLoadNote').isVisible(), false);
    fs.mkdirSync('.codex-screens', { recursive: true });
    await page.screenshot({ path: '.codex-screens/reference-library-desktop.png', fullPage: true });

    await page.getByRole('button', { name: 'มวลและน้ำหนัก', exact: false }).click();
    assert.equal(await page.locator('#refResults .ref-row').count(), 3);
    await page.locator('#refType').selectOption('weights');
    await page.locator('#refGrade').selectOption('E2');
    assert.equal(await page.locator('#refResults .ref-row').count(), 1);
    await page.locator('#refResults').getByRole('button', { name: 'STD-E2-01', exact: true }).click();
    assert.equal(await page.locator('#refWeightBody tbody tr').count(), 2);
    assert.ok((await page.locator('#refWeightBody').textContent()).includes('kg'));
    await page.getByRole('button', { name: 'เปรียบเทียบครั้งก่อน', exact: true }).click();
    assert.ok((await page.locator('#refWeightBody').textContent()).includes('Drift (mg)'));
    await page.screenshot({ path: '.codex-screens/reference-library-detail.png', fullPage: false });
    await page.getByRole('button', { name: 'ไฟล์ใบ Cert', exact: true }).click();
    assert.equal(await page.locator('#refWeightBody .ref-file').count(), 2);
    assert.ok((await page.locator('#refWeightBody').textContent()).includes('01/06/2027'));
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'อนุมัติทั้งชุด', exact: true }).click();
    await page.waitForFunction(() => refWeightRows().every(w => w.status === 'approved'));
    assert.equal(await page.locator('#refPending').textContent(), '0');
    await page.locator('#refWeightClose').click();
    await page.locator('#refSearch').fill('nonexistent');
    assert.equal(await page.locator('#refResults .ref-row').count(), 0);
    await page.locator('.ref-reset').click();

    await page.locator('#refAddMenu summary').click();
    await page.locator('#refAddMenu').getByRole('button', { name: 'อุณหภูมิ', exact: true }).click();
    assert.equal(await page.locator('#scCategory').inputValue(), 'อุณหภูมิ');
    assert.equal(await page.locator('#scEditModal').isVisible(), true);
    await page.evaluate(() => closeSCEdit());
    await page.getByRole('button', { name: 'Digital Thermometer', exact: true }).click();
    assert.equal(await page.locator('#scDetailModal').isVisible(), true);
    await page.evaluate(() => closeSCDetail());
    await page.locator('#swTabCmc').click();
    assert.equal(await page.locator('#cmcSection').isVisible(), true);
    assert.equal(await page.locator('#refSection').isVisible(), false);
    await page.locator('#swTabCerts').click();
    await page.waitForFunction(() => refSources.weights === 'ready' && refSources.certs === 'ready');

    await page.evaluate(() => { currentUser.role = 'viewer'; renderReferenceLibrary(); });
    assert.equal(await page.locator('#refAddMenu').isVisible(), false);
    await page.getByRole('button', { name: 'STD-E2-01', exact: true }).click();
    assert.equal(await page.locator('#refWeightBody').getByRole('button', { name: 'แก้ไขชุด', exact: true }).count(), 0);
    assert.equal(await page.locator('#refWeightBody').getByRole('button', { name: 'อนุมัติทั้งชุด', exact: true }).count(), 0);
    await page.locator('#refWeightClose').click();
    await page.evaluate(async () => { mockFailCerts = true; await loadReferencePage(); });
    assert.equal(await page.locator('#refLoadNote').isVisible(), true);
    assert.ok((await page.locator('#refLoadNote').textContent()).includes('ไม่สำเร็จ'));
    await page.evaluate(async () => { mockFailCerts = false; currentUser.role = 'admin'; await loadReferencePage(); });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '.codex-screens/reference-library-mobile.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'mobile page must not overflow horizontally');
    for (const selector of ['.ref-main', '.ref-filters', '.ref-list', '#refAddMenu', '.ref-row .ref-due', '.ref-row .ref-open']) {
      const boxes = await page.locator(selector).evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return {left:r.left,right:r.right}; }));
      assert.ok(boxes.every(b => b.left >= 0 && b.right <= 391), selector + ' must fit inside mobile viewport');
    }
    assert.deepEqual(errors, []);
    console.log('PASS: desktop/mobile layout, category/type/Class/search filters, detail tabs, add routing, CMC navigation, viewer controls and partial load errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
