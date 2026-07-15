// ====================================================
// FRM-EIB04 PLAN EXPORT (.xlsx) — สร้างจาก template + JSZip
// template: assets/frm-eib04-template.xlsx (สร้างโดย tools/build-frm-eib04-template.ps1)
// style id / โครง XML อ้างอิงจาก ตัวอย่าง/WRM1.xlsx — ห้ามแก้โดยไม่เทียบไฟล์จริง
// ====================================================

const FRM_STYLE = {
  topA: 80, topB: 78, botB: 81, colC: 82, colD: 79, colE: 89,
  day1: 13, day: 14, day31: 15, day1Blue: 94, dayBlue: 93, day31Blue: 96,
  botNum1: 94, botNum: 95, botNum31: 96,
  eib: [13, 16, 14, 15, 15, 14, 17], // AK..AQ
  sig1: { a: 24, mid: 25, aj: 26, ak: 97, mid2: 98, aq: 99 },
  sig2: { a: 27, mid: 28, label: 29, aj: 30, ak: 100, mid2: 101, aq: 102 }
};
const FRM_SIG_TEXT = {
  prepared: 'Prepared by :___________(EIB)  Date _____________   Approved by :____________(EIB)  Date ________________ Acknowledge by _____________(Owner) Date _____________',
  owner: 'The owner accepts the work by ___________ Date _____________',
  section: '  ระดับแผนกขึ้นไป ( Section manager level and above)',
  unit: 'ระดับหน่วยขึ้นไป ( Supervisor level and above)'
};
const FRM_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FRM_ITEMS_PER_BLOCK = 10;
const FRM_OTHER_BLANK = '____________________________';

function frmColLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
function frmEscapeXml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function frmMonthName(m) { return FRM_MONTHS[m - 1] || ''; }
function frmDateSerial(iso) {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000);
}
function frmCellEmpty(col, row, s) { return '<c r="' + col + row + '" s="' + s + '"/>'; }
function frmCellNum(col, row, s, v) { return '<c r="' + col + row + '" s="' + s + '"><v>' + v + '</v></c>'; }
function frmCellText(col, row, s, text) {
  return '<c r="' + col + row + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + frmEscapeXml(text) + '</t></is></c>';
}

// เครื่องละ 2 แถว: แถวบนแถบฟ้า due..31, แถวล่างเลขเดือน+ฟ้า 1..due
function frmBuildItemRows(item, itemNo, rowNum, monthNum) {
  const S = FRM_STYLE;
  const due = frmDateSerial(item.due_date);
  const dueDay = due ? parseInt(String(item.due_date).slice(8, 10), 10) : 0;
  const r1 = rowNum, r2 = rowNum + 1;
  let x = '<row r="' + r1 + '" spans="1:44" ht="21.75" customHeight="1">';
  x += frmCellNum('A', r1, S.topA, itemNo);
  x += frmCellText('B', r1, S.topB, item.instrument_name || '');
  x += frmCellText('C', r1, S.colC, item.id_code || '');
  x += frmCellText('D', r1, S.colD, item.location || '');
  x += due ? frmCellNum('E', r1, S.colE, due) : frmCellEmpty('E', r1, S.colE);
  for (let d = 1; d <= 31; d++) {
    const col = frmColLetter(5 + d);
    const blue = dueDay > 0 && d >= dueDay;
    const s = d === 1 ? (blue ? S.day1Blue : S.day1) : d === 31 ? (blue ? S.day31Blue : S.day31) : (blue ? S.dayBlue : S.day);
    x += frmCellEmpty(col, r1, s);
  }
  for (let i = 0; i < 7; i++) x += frmCellEmpty(frmColLetter(37 + i), r1, S.eib[i]);
  x += '</row>';
  x += '<row r="' + r2 + '" spans="1:44" ht="21.75" customHeight="1">';
  x += frmCellEmpty('A', r2, S.topA) + frmCellEmpty('B', r2, S.botB) + frmCellEmpty('C', r2, S.colC) + frmCellEmpty('D', r2, S.colD) + frmCellEmpty('E', r2, S.colE);
  for (let d = 1; d <= 31; d++) {
    const col = frmColLetter(5 + d);
    const num = dueDay > 0 && d <= dueDay;
    const s = d === 1 ? (num ? S.botNum1 : S.day1) : d === 31 ? (num ? S.botNum31 : S.day31) : (num ? S.botNum : S.day);
    x += num ? frmCellNum(col, r2, s, monthNum) : frmCellEmpty(col, r2, s);
  }
  for (let i = 0; i < 7; i++) x += frmCellEmpty(frmColLetter(37 + i), r2, S.eib[i]);
  x += '</row>';
  return x;
}

function frmBuildSignatureRows(rowNum) {
  const S1 = FRM_STYLE.sig1, S2 = FRM_STYLE.sig2, T = FRM_SIG_TEXT;
  const r1 = rowNum, r2 = rowNum + 1;
  let x = '<row r="' + r1 + '" spans="1:43" ht="33" customHeight="1">';
  x += frmCellText('A', r1, S1.a, T.prepared);
  for (let c = 2; c <= 35; c++) x += frmCellEmpty(frmColLetter(c), r1, S1.mid);   // B..AI
  x += frmCellEmpty('AJ', r1, S1.aj);
  x += frmCellText('AK', r1, S1.ak, T.owner);
  for (let c = 38; c <= 42; c++) x += frmCellEmpty(frmColLetter(c), r1, S1.mid2); // AL..AP
  x += frmCellEmpty('AQ', r1, S1.aq) + '</row>';
  x += '<row r="' + r2 + '" spans="1:43" ht="19.5" customHeight="1" thickBot="1">';
  x += frmCellEmpty('A', r2, S2.a);
  for (let c = 2; c <= 4; c++) x += frmCellEmpty(frmColLetter(c), r2, S2.mid);    // B..D
  x += frmCellText('E', r2, S2.label, T.section);
  for (let c = 6; c <= 20; c++) x += frmCellEmpty(frmColLetter(c), r2, S2.mid);   // F..T
  x += frmCellText('U', r2, S2.label, T.unit);
  for (let c = 22; c <= 35; c++) x += frmCellEmpty(frmColLetter(c), r2, S2.mid);  // V..AI
  x += frmCellEmpty('AJ', r2, S2.aj);
  x += frmCellText('AK', r2, S2.ak, T.unit);
  for (let c = 38; c <= 42; c++) x += frmCellEmpty(frmColLetter(c), r2, S2.mid2); // AL..AP
  x += frmCellEmpty('AQ', r2, S2.aq) + '</row>';
  return x;
}

function frmBuildSheetRows(items, monthNum) {
  let xml = '', r = 10;
  const merges = [];
  const addSig = () => {
    xml += frmBuildSignatureRows(r);
    merges.push('AK' + r + ':AQ' + r, 'AK' + (r + 1) + ':AQ' + (r + 1));
    r += 2;
  };
  items.forEach((it, i) => {
    xml += frmBuildItemRows(it, i + 1, r, monthNum);
    r += 2;
    if ((i + 1) % FRM_ITEMS_PER_BLOCK === 0) addSig();
  });
  if (items.length % FRM_ITEMS_PER_BLOCK !== 0 || items.length === 0) addSig();
  return { xml: xml, merges: merges, lastRow: r - 1 };
}

function frmGroupByDept(items) {
  const g = {};
  (items || []).forEach(it => {
    const k = (it.department || '').trim() || 'ไม่ระบุ';
    (g[k] = g[k] || []).push(it);
  });
  return g;
}

function frmMode(arr) { // ค่าที่พบบ่อยสุด (ข้าม falsy)
  const c = {};
  let best = '', n = 0;
  arr.forEach(v => { if (!v) return; c[v] = (c[v] || 0) + 1; if (c[v] > n) { n = c[v]; best = v; } });
  return best;
}

// เปิด template → เติม token หัวกระดาษ + แถวข้อมูล + merge → Blob .xlsx
function frmRenderTemplate(templateBuf, header, items) {
  const chk = v => (v ? '☑' : '☐');
  return JSZip.loadAsync(templateBuf).then(zip =>
    Promise.all([zip.file('xl/worksheets/sheet1.xml').async('string'),
                 zip.file('xl/drawings/drawing1.xml').async('string')])
      .then(([sheet, drawing]) => {
        const built = frmBuildSheetRows(items, header.monthNum);
        sheet = sheet.replace('</sheetData>', built.xml + '</sheetData>');
        sheet = sheet.replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="A1:AR' + built.lastRow + '"/>');
        sheet = sheet.replace(/<mergeCells count="(\d+)">/, (m, n) => '<mergeCells count="' + (Number(n) + built.merges.length) + '">');
        sheet = sheet.replace('</mergeCells>', built.merges.map(r => '<mergeCell ref="' + r + '"/>').join('') + '</mergeCells>');
        sheet = sheet.replace('{{CHK_DRUG}}', chk(header.drug))
                     .replace('{{CHK_COS}}', chk(header.cosmetic))
                     .replace('{{CHK_OTHER}}', chk(!!(header.otherText || '').trim()))
                     .replace('{{OTHER_TEXT}}', (header.otherText || '').trim() ? frmEscapeXml(header.otherText.trim()) : FRM_OTHER_BLANK);
        drawing = drawing.replace('{{MONTH}}', frmEscapeXml(frmMonthName(header.monthNum)))
                         .replace('{{YEAR}}', frmEscapeXml(header.year))
                         .replace('{{GROUP}}', frmEscapeXml(header.group))
                         .replace('{{UNIT}}', frmEscapeXml(header.unit))
                         .replace('{{SECTION}}', frmEscapeXml(header.section))
                         .replace('{{CHK_INT}}', chk(header.internal))
                         .replace('{{CHK_EXT}}', chk(header.external));
        zip.file('xl/worksheets/sheet1.xml', sheet);
        zip.file('xl/drawings/drawing1.xml', drawing);
        return zip.generateAsync({ type: 'blob', compression: 'DEFLATE',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      }));
}

function frmDefaultHeader(items) {
  const dues = items.map(it => String(it.due_date || '').slice(0, 7)).filter(Boolean);
  const ym = frmMode(dues) || new Date().toISOString().slice(0, 7);
  const type = frmMode(items.map(it => it.instrument_type));
  let group = type || '';
  if (/เครื่องชั่ง|balance/i.test(group)) group = 'BALANCE';
  group = group.replace(/\s*\(.*\)\s*/g, '').trim();
  const external = frmMode(items.map(it => it.cal_type)) === 'ภายนอก';
  return {
    monthNum: parseInt(ym.slice(5, 7), 10), year: parseInt(ym.slice(0, 4), 10),
    group: group, unit: frmMode(items.map(it => it.department)) || '',
    section: frmMode(items.map(it => it.division)) || '',
    internal: !external, external: external, drug: false, cosmetic: false, otherText: ''
  };
}

// ---------------- UI ----------------
let frmExportGroups = [];
let frmTemplateBufPromise = null;

function frmGetTemplate() {
  if (!frmTemplateBufPromise) {
    frmTemplateBufPromise = fetch('assets/frm-eib04-template.xlsx')
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .catch(e => { frmTemplateBufPromise = null; throw e; });
  }
  return frmTemplateBufPromise;
}

function openPlanExportModal() {
  if (typeof JSZip === 'undefined') { showToast('โหลดไลบรารี JSZip ไม่สำเร็จ (ต้องออนไลน์ครั้งแรก)', 'error'); return; }
  if (!planSelectedItems.length) { showToast('กรุณาเลือกเครื่องมืออย่างน้อย 1 รายการ', 'error'); return; }
  const groups = frmGroupByDept(planSelectedItems);
  frmExportGroups = Object.keys(groups).sort().map(dept => ({
    dept: dept,
    items: groups[dept].slice().sort((a, b) => String(a.id_code || '').localeCompare(String(b.id_code || ''))),
    header: frmDefaultHeader(groups[dept])
  }));
  renderFrmExportBody();
  document.getElementById('frmExportModal').style.display = 'flex';
}

function closeFrmExportModal() { document.getElementById('frmExportModal').style.display = 'none'; }

function frmSetHeader(i, key, value) { frmExportGroups[i].header[key] = value; }

function renderFrmExportBody() {
  const inp = 'style="width:100%;padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:13px;outline:none"';
  const lbl = 'style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px;display:block"';
  document.getElementById('frmExportBody').innerHTML = frmExportGroups.map((g, i) => {
    const h = g.header;
    const monthOpts = FRM_MONTHS.map((m, mi) =>
      '<option value="' + (mi + 1) + '"' + (h.monthNum === mi + 1 ? ' selected' : '') + '>' + (mi + 1) + ' - ' + m + '</option>').join('');
    const noDue = g.items.filter(it => !it.due_date).length;
    return '<fieldset style="border:1.5px solid var(--border);border-radius:10px;padding:12px;margin-bottom:14px">' +
      '<legend style="font-size:13px;font-weight:700;padding:0 6px">' + escapeHtmlAttr(g.dept) + ' (' + g.items.length + ' รายการ)</legend>' +
      (g.dept === 'ไม่ระบุ' ? '<div style="font-size:12px;color:var(--red);margin-bottom:8px">⚠️ เครื่องกลุ่มนี้ไม่มีหน่วยงานในทะเบียน — แก้หน่วยงานในช่องด้านล่างก่อนพิมพ์</div>' : '') +
      (noDue ? '<div style="font-size:12px;color:var(--red);margin-bottom:8px">⚠️ ' + noDue + ' เครื่องไม่มีวันครบกำหนด — จะลงตารางโดยไม่มีแถบสี</div>' : '') +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:10px">' +
      '<div><label ' + lbl + '>เดือนที่สอบ</label><select ' + inp + ' onchange="frmSetHeader(' + i + ',\'monthNum\',+this.value)">' + monthOpts + '</select></div>' +
      '<div><label ' + lbl + '>ปี (ค.ศ.)</label><input type="number" ' + inp + ' value="' + h.year + '" onchange="frmSetHeader(' + i + ',\'year\',+this.value)"></div>' +
      '<div><label ' + lbl + '>กลุ่มเครื่องมือ</label><input type="text" ' + inp + ' value="' + escapeHtmlAttr(h.group) + '" oninput="frmSetHeader(' + i + ',\'group\',this.value)"></div>' +
      '<div><label ' + lbl + '>หน่วยงาน (Unit)</label><input type="text" ' + inp + ' value="' + escapeHtmlAttr(h.unit) + '" oninput="frmSetHeader(' + i + ',\'unit\',this.value)"></div>' +
      '<div><label ' + lbl + '>แผนก (Section)</label><input type="text" ' + inp + ' value="' + escapeHtmlAttr(h.section) + '" oninput="frmSetHeader(' + i + ',\'section\',this.value)"></div>' +
      '</div>' +
      '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;align-items:center">' +
      '<label><input type="checkbox"' + (h.internal ? ' checked' : '') + ' onchange="frmSetHeader(' + i + ',\'internal\',this.checked)"> สอบเทียบภายใน</label>' +
      '<label><input type="checkbox"' + (h.external ? ' checked' : '') + ' onchange="frmSetHeader(' + i + ',\'external\',this.checked)"> สอบเทียบภายนอก</label>' +
      '<label><input type="checkbox"' + (h.drug ? ' checked' : '') + ' onchange="frmSetHeader(' + i + ',\'drug\',this.checked)"> Drug product</label>' +
      '<label><input type="checkbox"' + (h.cosmetic ? ' checked' : '') + ' onchange="frmSetHeader(' + i + ',\'cosmetic\',this.checked)"> Cosmetic product</label>' +
      '<label>Other: <input type="text" style="padding:4px 8px;border:1.5px solid var(--border);border-radius:6px;font-family:var(--font);font-size:12px;width:140px" value="' + escapeHtmlAttr(h.otherText) + '" oninput="frmSetHeader(' + i + ',\'otherText\',this.value)"></label>' +
      '<button type="button" class="btn-primary" style="margin-left:auto" onclick="exportPlanFrmUnit(' + i + ')">⬇️ ดาวน์โหลด</button>' +
      '</div></fieldset>';
  }).join('');
}

function frmFileName(g) {
  const dept = String(g.dept).replace(/[\\\/:*?"<>|]/g, '-');
  return 'FRM-EIB04_' + dept + '_' + g.header.year + '-' + String(g.header.monthNum).padStart(2, '0') + '.xlsx';
}

async function exportPlanFrmUnit(i) {
  const g = frmExportGroups[i];
  try {
    showLoading('กำลังสร้างไฟล์ ' + g.dept + '...');
    const buf = await frmGetTemplate();
    const blob = await frmRenderTemplate(buf, g.header, g.items);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = frmFileName(g);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    hideLoading();
    showToast('✅ สร้างไฟล์ ' + frmFileName(g) + ' แล้ว', 'success');
  } catch (e) {
    hideLoading();
    showToast('สร้างไฟล์ไม่สำเร็จ: ' + e.message, 'error');
  }
}

async function exportAllPlanFrm() {
  for (let i = 0; i < frmExportGroups.length; i++) await exportPlanFrmUnit(i);
}
