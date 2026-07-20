// ====================================================
// FRM-EIB04 PLAN EXPORT (.xlsx) — สร้างจาก template + JSZip
// template: assets/frm-eib04-template.xlsx (สร้างโดย tools/build-frm-eib04-template.ps1)
// style id อ้างอิงจาก ตัวอย่าง/FRM-EIB04 (TP) เเผนสอบเทียบเครื่องมือ.xlsx (แถว 10/12/30/31/32 — rev 2026-07-20 มี 10 แถวตัวอย่าง)
// + 178-180 = แถบฟ้าที่ build script ต่อท้าย styles.xml — ห้ามแก้โดยไม่เทียบไฟล์จริง
// ====================================================

const FRM_STYLE = {
  // ชุด style ต่อคอลัมน์: first = แถวแรกของหน้า (ใต้หัวตาราง), item = แถวรายการทั่วไป, close = แถวปิดตาราง (เส้นล่างหนา)
  first: { a: 72, b: 21, c: 22, d: 73, e: 74, day1: 75, day: 76, day31: 77, eib: [75, 78, 76, 77, 77, 76, 79] },
  item:  { a: 80, b: 21, c: 22, d: 73, e: 81, day1: 82, day: 83, day31: 84, eib: [82, 85, 83, 84, 84, 83, 86] },
  close: { a: 95, day1: 96, day: 97, day31: 98, eib: [96, 99, 97, 98, 98, 97, 100] },
  day1Blue: 178, dayBlue: 179, day31Blue: 180,
  botNum1: 178, botNum: 179, botNum31: 180,
  sig1: { a: 8,  mid: 9,  aj: 10, ak: 117, mid2: 118, aq: 119 },
  sig2: { a: 11, mid: 12, label: 13, aj: 14, ak: 120, mid2: 121, aq: 122 }
};
const FRM_SIG_TEXT = {
  prepared: 'Prepared by :___________(EIB)  Date _____________   Approved by :____________(EIB)  Date ________________ Acknowledge by _____________(Owner) Date _____________',
  owner: 'The owner accepts the work by ___________ Date _____________',
  section: '  ระดับแผนกขึ้นไป ( Section manager level and above)',
  unit: 'ระดับหน่วยขึ้นไป ( Supervisor level and above)'
};
const FRM_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const FRM_ITEMS_PER_BLOCK = 10; // 10 เครื่อง/หน้า พอดี 1 หน้าที่ scale เดิม 77% (วัดจริงด้วย Excel COM)
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

// เครื่องละ 2 แถว: แถวบนแถบฟ้า bar_end..31, แถวล่างเลขเดือน+ฟ้า bar_start..bar_end
// item รับ override ได้: bar_start/bar_end/month_num (default = วัน 1..วัน due + เดือนของแผน)
// isFirst = แถวแรกใต้หัวตาราง (แถวแรกของแต่ละหน้า/บล็อก) ใช้ชุด style FRM_STYLE.first
function frmBuildItemRows(item, itemNo, rowNum, monthNum, isFirst) {
  const S = FRM_STYLE;
  const T = isFirst ? S.first : S.item; // แถวบน
  const B = S.item;                     // แถวล่างใช้ชุดทั่วไปเสมอ
  const due = frmDateSerial(item.due_date);
  const dueDay = due ? parseInt(String(item.due_date).slice(8, 10), 10) : 0;
  const barEnd = item.bar_end != null ? item.bar_end : dueDay;
  const barStart = item.bar_start != null ? item.bar_start : (barEnd ? 1 : 0);
  const mNum = item.month_num != null ? item.month_num : monthNum;
  const r1 = rowNum, r2 = rowNum + 1;
  let x = '<row r="' + r1 + '" spans="1:44" ht="21.75" customHeight="1">';
  x += frmCellNum('A', r1, T.a, itemNo);
  x += frmCellText('B', r1, T.b, item.instrument_name || item.name || '');
  x += frmCellText('C', r1, T.c, item.id_code || '');
  x += frmCellText('D', r1, T.d, item.location || '');
  x += due ? frmCellNum('E', r1, T.e, due) : frmCellEmpty('E', r1, T.e);
  for (let d = 1; d <= 31; d++) {
    const col = frmColLetter(5 + d);
    const blue = barEnd > 0 && d >= barEnd;
    const s = d === 1 ? (blue ? S.day1Blue : T.day1) : d === 31 ? (blue ? S.day31Blue : T.day31) : (blue ? S.dayBlue : T.day);
    x += frmCellEmpty(col, r1, s);
  }
  for (let i = 0; i < 7; i++) x += frmCellEmpty(frmColLetter(37 + i), r1, T.eib[i]);
  x += '</row>';
  x += '<row r="' + r2 + '" spans="1:44" ht="21.75" customHeight="1">';
  x += frmCellEmpty('A', r2, B.a) + frmCellEmpty('B', r2, B.b) + frmCellEmpty('C', r2, B.c) + frmCellEmpty('D', r2, B.d) + frmCellEmpty('E', r2, B.e);
  for (let d = 1; d <= 31; d++) {
    const col = frmColLetter(5 + d);
    const num = barEnd > 0 && d >= barStart && d <= barEnd;
    const s = d === 1 ? (num ? S.botNum1 : B.day1) : d === 31 ? (num ? S.botNum31 : B.day31) : (num ? S.botNum : B.day);
    x += num ? frmCellNum(col, r2, s, mNum) : frmCellEmpty(col, r2, s);
  }
  for (let i = 0; i < 7; i++) x += frmCellEmpty(frmColLetter(37 + i), r2, B.eib[i]);
  x += '</row>';
  return x;
}

// แถวปิดตาราง (เส้นล่างหนา) ก่อนแถวลายเซ็นของแต่ละบล็อก — ตามต้นแบบแถว 26
function frmBuildClosingRow(rowNum) {
  const S = FRM_STYLE.close;
  let x = '<row r="' + rowNum + '" spans="1:44" ht="21.75" customHeight="1">';
  for (let c = 1; c <= 5; c++) x += frmCellEmpty(frmColLetter(c), rowNum, S.a);
  for (let d = 1; d <= 31; d++) {
    const col = frmColLetter(5 + d);
    const s = d === 1 ? S.day1 : d === 31 ? S.day31 : S.day;
    x += frmCellEmpty(col, rowNum, s);
  }
  for (let i = 0; i < 7; i++) x += frmCellEmpty(frmColLetter(37 + i), rowNum, S.eib[i]);
  return x + '</row>';
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
  const blockEnds = []; // แถวสุดท้ายของแต่ละบล็อก (แถวเซ็นล่าง) — ใช้วาง page break
  const addSig = () => {
    xml += frmBuildClosingRow(r);
    r += 1;
    xml += frmBuildSignatureRows(r);
    merges.push('AK' + r + ':AQ' + r, 'AK' + (r + 1) + ':AQ' + (r + 1));
    r += 2;
    blockEnds.push(r - 1);
  };
  items.forEach((it, i) => {
    xml += frmBuildItemRows(it, i + 1, r, monthNum, i % FRM_ITEMS_PER_BLOCK === 0);
    r += 2;
    if ((i + 1) % FRM_ITEMS_PER_BLOCK === 0) addSig();
  });
  if (items.length % FRM_ITEMS_PER_BLOCK !== 0 || items.length === 0) addSig();
  // break ระหว่างบล็อก (บล็อกสุดท้ายไม่ต้อง) — บังคับขึ้นหน้าใหม่ทุก 8 เครื่อง
  return { xml: xml, merges: merges, lastRow: r - 1, breaks: blockEnds.slice(0, -1) };
}

// รหัสหน่วยงาน = ID CODE ช่วงหน้า (ตัวอักษรถึงเลขตัวแรก เช่น WRM1BB05-WI01 → WRM1)
function frmUnitCode(it) {
  const idc = String(it.id_code || '').trim().toUpperCase();
  const m = idc.match(/^[A-Z]+\d/);
  if (m) return m[0];
  if (idc) return idc.slice(0, 4);
  return String(it.department || '').trim() || 'ไม่ระบุ';
}

// กติกาหน่วยงาน: 1 แผน = 1 หน่วยงาน (รหัส ID CODE) + 1 ประเภทเครื่องมือ — WRM1/WRM2 แยกแผนกันเสมอ
function frmBuildGroups(items) {
  const map = {};
  (items || []).forEach(it => {
    const unit = frmUnitCode(it);
    const type = String(it.instrument_type || '').trim() || 'ไม่ระบุประเภท';
    const key = unit + '|' + type;
    (map[key] = map[key] || { unitCode: unit, typeName: type, items: [] }).items.push(it);
  });
  return Object.keys(map).sort().map(k => {
    const g = map[k];
    g.items.sort((a, b) => String(a.id_code || '').localeCompare(String(b.id_code || '')));
    g.header = frmDefaultHeader(g.items);
    if (!g.header.unit) g.header.unit = g.unitCode;
    return g;
  });
}

function frmMode(arr) { // ค่าที่พบบ่อยสุด (ข้าม falsy)
  const c = {};
  let best = '', n = 0;
  arr.forEach(v => { if (!v) return; c[v] = (c[v] || 0) + 1; if (c[v] > n) { n = c[v]; best = v; } });
  return best;
}

// เปิด template → เติม token: ☑/☐ อยู่ในเซลล์ sheet, ค่า Month/Year/Group/Unit/Section อยู่ใน TextBox
// (drawing ทับเส้น ______ ให้เห็นช่องกรอกแบบฟอร์มกระดาษ) + แถวข้อมูล + merge + page break → Blob .xlsx
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
        sheet = sheet.replace('{{CHK_INT}}', chk(header.internal))
                     .replace('{{CHK_EXT}}', chk(header.external))
                     .replace('{{CHK_DRUG}}', chk(header.drug))
                     .replace('{{CHK_COS}}', chk(header.cosmetic))
                     .replace('{{CHK_OTHER}}', chk(!!(header.otherText || '').trim()))
                     .replace('{{OTHER_TEXT}}', (header.otherText || '').trim() ? frmEscapeXml(header.otherText.trim()) : FRM_OTHER_BLANK);
        if (built.breaks.length) {
          const brXml = '<rowBreaks count="' + built.breaks.length + '" manualBreakCount="' + built.breaks.length + '">' +
            built.breaks.map(b => '<brk id="' + b + '" max="16383" man="1"/>').join('') + '</rowBreaks>';
          sheet = sheet.replace('</headerFooter>', '</headerFooter>' + brXml);
        }
        drawing = drawing.replace('{{MONTH}}', frmEscapeXml(frmMonthName(header.monthNum)))
                         .replace('{{YEAR}}', frmEscapeXml(header.year))
                         .replace('{{GROUP}}', frmEscapeXml(header.group))
                         .replace('{{UNIT}}', frmEscapeXml(header.unit))
                         .replace('{{SECTION}}', frmEscapeXml(header.section));
        zip.file('xl/worksheets/sheet1.xml', sheet);
        zip.file('xl/drawings/drawing1.xml', drawing);
        return zip.generateAsync({ type: 'blob', compression: 'DEFLATE',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      }));
}

// ชื่อหน่วยงาน/แผนกเต็มจากรหัส (list departments) — ไม่มีชื่อ → ใช้รหัส/ค่าที่ลงไว้ที่เครื่อง
function frmDeptFullName(code) {
  return (code && typeof deptUnitName === 'function' && deptUnitName(code)) || '';
}
function frmDeptSectionName(code) {
  return (code && typeof deptSectionName === 'function' && deptSectionName(code)) || '';
}

function frmDefaultHeader(items) {
  const dues = items.map(it => String(it.due_date || '').slice(0, 7)).filter(Boolean);
  const ym = frmMode(dues) || new Date().toISOString().slice(0, 7);
  const type = frmMode(items.map(it => it.instrument_type));
  let group = type || '';
  if (/เครื่องชั่ง|balance/i.test(group)) group = 'BALANCE';
  group = group.replace(/\s*\(.*\)\s*/g, '').trim();
  const external = frmMode(items.map(it => it.cal_type)) === 'ภายนอก';
  const deptCode = frmMode(items.map(it => it.department)) || '';
  return {
    monthNum: parseInt(ym.slice(5, 7), 10), year: parseInt(ym.slice(0, 4), 10),
    group: group, unit: frmDeptFullName(deptCode) || deptCode,
    section: frmMode(items.map(it => it.division)) || frmDeptSectionName(deptCode) || '',
    internal: !external, external: external, drug: false, cosmetic: false, otherText: ''
  };
}

// สร้าง item ของแผนจากแถวทะเบียนเครื่องมือ — default แถบ = วัน 1..วัน due
function frmItemFromInstrument(row, planMonth) {
  const dueDay = row.due_date ? parseInt(String(row.due_date).slice(8, 10), 10) || 0 : 0;
  return {
    instrument_id: row.id, id_code: row.id_code || '', name: row.instrument_name || '',
    location: row.location || '', due_date: row.due_date || null,
    bar_start: dueDay ? 1 : 0, bar_end: dueDay, month_num: planMonth
  };
}

// สองคลิกกำหนดช่วง: คลิกแรกจำไว้ (pending) คลิกสองปิดช่วง (normalize start<=end)
function frmClickRange(sel, day) {
  if (sel.pending == null) return { pending: day };
  return { start: Math.min(sel.pending, day), end: Math.max(sel.pending, day), pending: null };
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
  frmExportGroups = frmBuildGroups(planSelectedItems);
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
      '<legend style="font-size:13px;font-weight:700;padding:0 6px">' + escapeHtmlAttr(g.unitCode) + (frmDeptFullName(g.unitCode) ? ' · ' + escapeHtmlAttr(frmDeptFullName(g.unitCode)) : '') + ' — ' + escapeHtmlAttr(g.typeName) + ' (' + g.items.length + ' รายการ)</legend>' +
      (g.unitCode === 'ไม่ระบุ' ? '<div style="font-size:12px;color:var(--red);margin-bottom:8px">⚠️ เครื่องกลุ่มนี้ไม่มี ID CODE/หน่วยงานในทะเบียน — แก้หน่วยงานในช่องด้านล่างก่อนพิมพ์</div>' : '') +
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
  const clean = s => String(s || '').replace(/[\\\/:*?"<>|]/g, '-').trim();
  const grp = clean(g.header.group);
  return 'FRM-EIB04_' + clean(g.unitCode) + (grp ? '_' + grp : '') + '_' + g.header.year + '-' + String(g.header.monthNum).padStart(2, '0') + '.xlsx';
}

async function exportPlanFrmUnit(i) {
  const g = frmExportGroups[i];
  try {
    showLoading('กำลังสร้างไฟล์ ' + g.unitCode + '...');
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

// ---------------- แท็บลงแผน FRM: รายการแผน ----------------
let frmPlanRows = [];

function frmPlanFromGroup(g) {
  const h = g.header;
  return {
    id: null, unit_code: g.unitCode, type_name: g.typeName,
    month_num: h.monthNum, year: h.year,
    header: { group: h.group, unit: h.unit, section: h.section, internal: h.internal, external: h.external, drug: h.drug, cosmetic: h.cosmetic, otherText: h.otherText },
    items: g.items.map(it => frmItemFromInstrument(it, h.monthNum)),
    status: 'draft'
  };
}

async function frmLoadPlanList() {
  const el = document.getElementById('frmPlanList');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--text3);font-size:13px">กำลังโหลด...</div>';
  const { data, error } = await sb.from('frm_plans').select('*').order('updated_at', { ascending: false });
  if (error) { el.innerHTML = '<div style="color:var(--red);font-size:13px">โหลดไม่สำเร็จ: ' + escapeHtmlText(error.message) + '</div>'; return; }
  frmPlanRows = data || [];
  if (!frmPlanRows.length) { el.innerHTML = '<div style="color:var(--text3);font-size:13px">ยังไม่มีแผน — กด "สร้างแผนใหม่" (ติ๊กเลือกเครื่องในแท็บสร้างแผนก่อน จะดึงมาให้อัตโนมัติ หรือเริ่มจากแผนว่างก็ได้)</div>'; return; }
  el.innerHTML = '<div style="display:grid;gap:8px">' + frmPlanRows.map(p =>
    '<div onclick="frmOpenPlanById(\'' + p.id + '\')" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;cursor:pointer">' +
    '<b style="font-size:14px">' + escapeHtmlText(p.unit_code || 'ไม่ระบุ') + '</b>' +
    (frmDeptFullName(p.unit_code) ? '<span style="font-size:12px;color:var(--text2)">' + escapeHtmlText(frmDeptFullName(p.unit_code)) + '</span>' : '') +
    '<span style="font-size:12px;color:var(--text2)">' + escapeHtmlText((p.type_name || '').split(' (')[0]) + '</span>' +
    '<span style="font-size:12px">' + frmMonthName(p.month_num) + ' ' + p.year + '</span>' +
    '<span style="font-size:12px;color:var(--text3)">' + ((p.items || []).length) + ' เครื่อง</span>' +
    '<span style="font-size:11px;padding:2px 8px;border-radius:99px;background:' + (p.status === 'exported' ? '#e6f4ea;color:#137333' : '#fef7e0;color:#b06000') + '">' + (p.status === 'exported' ? 'Export แล้ว' : 'ร่าง') + '</span>' +
    '<span style="font-size:11px;color:var(--text3);margin-left:auto">' + (p.updated_at || '').slice(0, 16).replace('T', ' ') + '</span>' +
    '</div>').join('') + '</div>';
}

function frmOpenPlanById(id) {
  const p = frmPlanRows.find(x => x.id === id);
  if (p) frmEditorOpen(JSON.parse(JSON.stringify(p)));
}

// ---------------- editor ลงแผน ----------------
let frmEditorPlan = null;
let frmEditorPending = {};

function frmEditorOpen(plan) {
  frmEditorPlan = plan; frmEditorPending = {};
  document.getElementById('frmEditorWrap').style.display = 'block';
  frmEditorRender();
  document.getElementById('frmEditorWrap').scrollIntoView({ behavior: 'smooth' });
}
function frmEditorClose() {
  frmEditorPlan = null;
  document.getElementById('frmEditorWrap').style.display = 'none';
  document.getElementById('frmEditorWrap').innerHTML = '';
  frmLoadPlanList();
}
function frmEditorMeta(key, val) { frmEditorPlan[key] = val; if (key === 'month_num') frmEditorRenderGrid(); }
function frmEditorHeader(key, val) { frmEditorPlan.header[key] = val; }
function frmEditorItem(i, key, val) { frmEditorPlan.items[i][key] = val; if (key === 'due_date') frmEditorRenderGrid(); }
function frmEditorMonth(i, val) { frmEditorPlan.items[i].month_num = +val; frmEditorRenderGrid(); }
function frmEditorDay(i, day) {
  const st = frmClickRange({ pending: frmEditorPending[i] != null ? frmEditorPending[i] : null }, day);
  if (st.pending != null) { frmEditorPending[i] = st.pending; }
  else { delete frmEditorPending[i]; frmEditorPlan.items[i].bar_start = st.start; frmEditorPlan.items[i].bar_end = st.end; }
  frmEditorRenderGrid();
}
function frmEditorClearBar(i) { const it = frmEditorPlan.items[i]; it.bar_start = 0; it.bar_end = 0; delete frmEditorPending[i]; frmEditorRenderGrid(); }
function frmEditorRemove(i) { frmEditorPlan.items.splice(i, 1); frmEditorPending = {}; frmEditorRenderGrid(); }

function frmEditorRender() {
  const p = frmEditorPlan;
  const monthOpts = m => FRM_MONTHS.map((x, i) => '<option value="' + (i + 1) + '"' + (m === i + 1 ? ' selected' : '') + '>' + (i + 1) + ' - ' + x + '</option>').join('');
  const inp = 'style="padding:6px 9px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:13px"';
  const lbl = 'style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:3px"';
  document.getElementById('frmEditorWrap').innerHTML =
    '<section class="plan-panel" style="padding:14px">' +
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">' +
    '<b style="font-size:15px">📝 ' + escapeHtmlText(p.unit_code || 'แผนใหม่') + '</b>' +
    (frmDeptFullName(p.unit_code) ? '<span style="font-size:12px;color:var(--text2)">' + escapeHtmlText(frmDeptFullName(p.unit_code)) + '</span>' : '') +
    '<span style="font-size:12px;color:var(--text2)">' + escapeHtmlText((p.type_name || '').split(' (')[0]) + '</span>' +
    '<span style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">' +
    '<button class="plan-btn" type="button" onclick="frmEditorClose()">← กลับรายการแผน</button>' +
    '<button class="plan-btn" type="button" onclick="frmEditorSave()">💾 บันทึก</button>' +
    '<button class="plan-btn primary" type="button" onclick="frmEditorExport()">⬇️ Export .xlsx</button>' +
    (p.id ? '<button class="plan-btn" type="button" style="color:var(--red)" onclick="frmEditorDelete()">🗑️</button>' : '') +
    '</span></div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:8px">' +
    '<div><label ' + lbl + '>เดือนที่สอบ</label><select ' + inp + ' onchange="frmEditorMeta(\'month_num\',+this.value)">' + monthOpts(p.month_num) + '</select></div>' +
    '<div><label ' + lbl + '>ปี (ค.ศ.)</label><input type="number" ' + inp + ' value="' + p.year + '" onchange="frmEditorMeta(\'year\',+this.value)"></div>' +
    '<div><label ' + lbl + '>กลุ่มเครื่องมือ</label><input type="text" ' + inp + ' value="' + escapeHtmlAttr(p.header.group || '') + '" oninput="frmEditorHeader(\'group\',this.value)"></div>' +
    '<div><label ' + lbl + '>หน่วยงาน (Unit)</label><input type="text" ' + inp + ' value="' + escapeHtmlAttr(p.header.unit || '') + '" oninput="frmEditorHeader(\'unit\',this.value)"></div>' +
    '<div><label ' + lbl + '>แผนก (Section)</label><input type="text" ' + inp + ' value="' + escapeHtmlAttr(p.header.section || '') + '" oninput="frmEditorHeader(\'section\',this.value)"></div>' +
    '</div>' +
    '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;margin-bottom:10px">' +
    '<label><input type="checkbox"' + (p.header.internal ? ' checked' : '') + ' onchange="frmEditorHeader(\'internal\',this.checked)"> สอบเทียบภายใน</label>' +
    '<label><input type="checkbox"' + (p.header.external ? ' checked' : '') + ' onchange="frmEditorHeader(\'external\',this.checked)"> สอบเทียบภายนอก</label>' +
    '<label><input type="checkbox"' + (p.header.drug ? ' checked' : '') + ' onchange="frmEditorHeader(\'drug\',this.checked)"> Drug product</label>' +
    '<label><input type="checkbox"' + (p.header.cosmetic ? ' checked' : '') + ' onchange="frmEditorHeader(\'cosmetic\',this.checked)"> Cosmetic product</label>' +
    '<label>Other: <input type="text" style="padding:3px 7px;border:1.5px solid var(--border);border-radius:6px;font-size:12px;width:130px" value="' + escapeHtmlAttr(p.header.otherText || '') + '" oninput="frmEditorHeader(\'otherText\',this.value)"></label>' +
    '</div>' +
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">' +
    '<input type="text" id="frmAddSearch" placeholder="🔍 เพิ่มเครื่อง: พิมพ์ ID CODE / ชื่อ" style="flex:1;max-width:340px;padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-family:var(--font);font-size:13px" oninput="frmEditorSearch(this.value)">' +
    '<span style="font-size:11px;color:var(--text3)">คลิกช่องวัน = จุดเริ่ม แล้วคลิกอีกครั้ง = จุดจบ</span></div>' +
    '<div id="frmAddResults" style="margin-bottom:8px"></div>' +
    '<div style="overflow:auto"><table class="frm-grid" id="frmGridTable"></table></div>' +
    '</section>';
  frmEditorRenderGrid();
}

function frmEditorRenderGrid() {
  const p = frmEditorPlan;
  if (!p) return;
  const el = document.getElementById('frmGridTable');
  if (!el) return;
  let days = ''; for (let d = 1; d <= 31; d++) days += '<th style="width:20px">' + d + '</th>';
  let html = '<tr><th>#</th><th>ชื่อเครื่อง</th><th>ID CODE</th><th>Location</th><th>Due Date</th>' + days + '<th>เดือน</th><th></th></tr>';
  p.items.forEach((it, i) => {
    const pend = frmEditorPending[i];
    let top = '', bot = '';
    for (let d = 1; d <= 31; d++) {
      const band = it.bar_end > 0 && d >= it.bar_end;
      top += '<td class="frm-day ro' + (band ? ' band' : '') + '"></td>';
      const on = it.bar_end > 0 && d >= it.bar_start && d <= it.bar_end;
      bot += '<td class="frm-day' + (on ? ' on' : '') + (pend === d ? ' pending' : '') + '" onclick="frmEditorDay(' + i + ',' + d + ')">' + (on ? it.month_num : '') + '</td>';
    }
    const mOpts = Array.from({ length: 12 }, (_, m) => '<option value="' + (m + 1) + '"' + (it.month_num === m + 1 ? ' selected' : '') + '>' + (m + 1) + '</option>').join('');
    html += '<tr>' +
      '<td rowspan="2">' + (i + 1) + '</td>' +
      '<td rowspan="2"><input class="frm-name" value="' + escapeHtmlAttr(it.name || '') + '" oninput="frmEditorItem(' + i + ',\'name\',this.value)"></td>' +
      '<td rowspan="2" style="white-space:nowrap">' + escapeHtmlText(it.id_code || '–') + '</td>' +
      '<td rowspan="2"><input class="frm-loc" value="' + escapeHtmlAttr(it.location || '') + '" oninput="frmEditorItem(' + i + ',\'location\',this.value)"></td>' +
      '<td rowspan="2"><input type="date" value="' + escapeHtmlAttr(it.due_date || '') + '" onchange="frmEditorItem(' + i + ',\'due_date\',this.value)"></td>' +
      top +
      '<td rowspan="2"><select onchange="frmEditorMonth(' + i + ',this.value)">' + mOpts + '</select>' +
      ' <button type="button" title="ล้างแถบ" onclick="frmEditorClearBar(' + i + ')" style="border:0;background:none;cursor:pointer">✕</button></td>' +
      '<td rowspan="2"><button type="button" title="เอาออกจากแผน" onclick="frmEditorRemove(' + i + ')" style="border:0;background:none;cursor:pointer;color:var(--red)">🗑️</button></td>' +
      '</tr><tr>' + bot + '</tr>';
  });
  if (!p.items.length) html += '<tr><td colspan="38" style="padding:14px;color:var(--text3)">ยังไม่มีเครื่องในแผน — ใช้ช่องค้นหาด้านบนเพื่อเพิ่ม</td></tr>';
  el.innerHTML = html;
}

function frmEditorSearch(term) {
  const el = document.getElementById('frmAddResults');
  term = String(term || '').trim().toLowerCase();
  if (term.length < 2) { el.innerHTML = ''; return; }
  const p = frmEditorPlan;
  const inPlan = new Set(p.items.map(it => String(it.instrument_id)));
  const hits = (allData || []).filter(r => {
    if (inPlan.has(String(r.id))) return false;
    if (p.unit_code && frmUnitCode(r) !== p.unit_code) return false;
    if (p.type_name && String(r.instrument_type || '').trim() !== p.type_name) return false;
    return String(r.id_code || '').toLowerCase().includes(term) || String(r.instrument_name || '').toLowerCase().includes(term);
  }).slice(0, 12);
  el.innerHTML = hits.length
    ? hits.map(r => '<button type="button" class="plan-btn" style="margin:2px" onclick="frmEditorAdd(' + r.id + ')">' + escapeHtmlText(r.id_code || r.instrument_name) + '</button>').join('')
    : '<span style="font-size:12px;color:var(--text3)">ไม่พบเครื่องในกลุ่ม ' + escapeHtmlText(p.unit_code || '') + ' ที่ยังไม่อยู่ในแผน</span>';
}

function frmEditorAdd(id) {
  const r = (allData || []).find(x => x.id == id);
  if (!r) return;
  const p = frmEditorPlan;
  if (!p.unit_code) { p.unit_code = frmUnitCode(r); p.type_name = String(r.instrument_type || '').trim(); if (!p.header.unit) p.header.unit = frmDeptFullName(r.department) || r.department || p.unit_code; if (!p.header.section) p.header.section = r.division || frmDeptSectionName(r.department) || ''; }
  p.items.push(frmItemFromInstrument(r, p.month_num));
  document.getElementById('frmAddSearch').value = '';
  document.getElementById('frmAddResults').innerHTML = '';
  frmEditorRender();
}

async function frmEditorSave(silent) {
  const p = frmEditorPlan;
  if (!p) return false;
  const row = { unit_code: p.unit_code, type_name: p.type_name, month_num: p.month_num, year: p.year, header: p.header, items: p.items, status: p.status || 'draft', updated_at: new Date().toISOString() };
  try {
    if (p.id) {
      const { error } = await sb.from('frm_plans').update(row).eq('id', p.id);
      if (error) throw error;
    } else {
      row.created_by = currentUser?.username || '';
      const { data, error } = await sb.from('frm_plans').insert(row).select().single();
      if (error) throw error;
      p.id = data.id;
      frmEditorRender();
    }
    if (!silent) showToast('✅ บันทึกแผนแล้ว', 'success');
    return true;
  } catch (e) { showToast('บันทึกไม่สำเร็จ: ' + e.message, 'error'); return false; }
}

async function frmEditorExport() {
  const p = frmEditorPlan;
  if (!p || !p.items.length) { showToast('แผนยังไม่มีเครื่อง', 'error'); return; }
  try {
    showLoading('กำลังสร้างไฟล์...');
    const hdr = Object.assign({}, p.header, { monthNum: p.month_num, year: p.year });
    const buf = await frmGetTemplate();
    const blob = await frmRenderTemplate(buf, hdr, p.items);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = frmFileName({ unitCode: p.unit_code, header: hdr });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    p.status = 'exported';
    await frmEditorSave(true);
    hideLoading();
    showToast('✅ Export แล้ว', 'success');
  } catch (e) { hideLoading(); showToast('Export ไม่สำเร็จ: ' + e.message, 'error'); }
}

async function frmEditorDelete() {
  const p = frmEditorPlan;
  if (!p || !p.id) return;
  if (!confirm('ลบแผน ' + p.unit_code + ' ' + frmMonthName(p.month_num) + ' ' + p.year + ' ?')) return;
  const { error } = await sb.from('frm_plans').delete().eq('id', p.id);
  if (error) { showToast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  showToast('ลบแผนแล้ว', 'success');
  frmEditorClose();
}

// ทางลัดจาก step 1 สร้างแผน: เลือกเครื่องเสร็จ → เปิดแท็บลงแผน FRM + สร้าง draft จากที่เลือกทันที
function goToFrmPlanFromSelection() {
  if (!planSelectedItems.length) { showToast('กรุณาเลือกเครื่องมืออย่างน้อย 1 รายการ', 'error'); return; }
  switchPlanTab('frm');
  frmNewPlanFromSelection();
}

async function frmNewPlanFromSelection() {
  if (!planSelectedItems.length) {
    frmEditorOpen({ id: null, unit_code: '', type_name: '', month_num: new Date().getMonth() + 1, year: new Date().getFullYear(), header: { group: '', unit: '', section: '', internal: true, external: false, drug: false, cosmetic: false, otherText: '' }, items: [], status: 'draft' });
    return;
  }
  const groups = frmBuildGroups(planSelectedItems);
  try {
    showLoading('กำลังสร้างแผน...');
    const rows = groups.map(g => { const p = frmPlanFromGroup(g); return { unit_code: p.unit_code, type_name: p.type_name, month_num: p.month_num, year: p.year, header: p.header, items: p.items, status: 'draft', created_by: currentUser?.username || '' }; });
    const { data, error } = await sb.from('frm_plans').insert(rows).select();
    if (error) throw error;
    hideLoading();
    showToast('✅ สร้างแผน ' + data.length + ' ฉบับ', 'success');
    await frmLoadPlanList();
    if (data[0]) frmOpenPlanById(data[0].id);
  } catch (e) { hideLoading(); showToast('สร้างแผนไม่สำเร็จ: ' + e.message, 'error'); }
}
