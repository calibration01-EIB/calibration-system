// ===== 18-asset-out.js ===== ใบขออนุญาตนำทรัพย์สินออกนอกบริษัท (FRM asset-out)
// export .xlsx จาก template ด้วย JSZip (แพตเทิร์นเดียวกับ 15-plan-export.js)
// ใช้ global helper จาก js/15-plan-export.js ตรง (global scope เดียวกัน — ไม่ทำซ้ำ): frmEscapeXml, frmDateSerial
let assetOutTemplateBufPromise = null;
function assetOutGetTemplate() {
  if (!assetOutTemplateBufPromise) {
    assetOutTemplateBufPromise = fetch('assets/frm-asset-out-template.xlsx')
      .then(r => { if (!r.ok) throw new Error('template ' + r.status); return r.arrayBuffer(); })
      .catch(e => { assetOutTemplateBufPromise = null; throw e; });
  }
  return assetOutTemplateBufPromise;
}

// แปลงคอลัมน์ตัวอักษร → เลข (ผกผันกับ frmColLetter ใน 15-plan-export.js) — ใช้จัดลำดับตอนแทรกเซลล์ใหม่
function aoColIndex(letters) {
  let n = 0;
  for (let i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
  return n;
}

// แทรก <c> ใหม่เข้าแถวเดิม โดยรักษาลำดับคอลัมน์ขึ้นจากน้อยไปมาก (กัน Excel มองว่าไฟล์ผิดโครงสร้างจนขึ้น repair prompt)
function aoInsertCell(sheet, addr, cellXml) {
  const m = addr.match(/^([A-Z]+)(\d+)$/);
  if (!m) return sheet;
  const rowNum = m[2];
  const colIdx = aoColIndex(m[1]);
  const rowRe = new RegExp('(<row r="' + rowNum + '"[^>]*>)([\\s\\S]*?)(<\\/row>)');
  const rm = sheet.match(rowRe);
  if (!rm) return sheet; // ไม่พบแถว (ไม่ควรเกิดกับ template นี้ — ทุกแถวเป้าหมายมีอยู่แล้ว)
  const rowOpen = rm[1], rowBody = rm[2], rowClose = rm[3];
  const cellRe = /<c r="([A-Z]+)\d+"/g;
  let insertAt = rowBody.length; // ไม่พบคอลัมน์ที่มากกว่า → แทรกท้ายแถว
  let cm;
  while ((cm = cellRe.exec(rowBody))) {
    if (aoColIndex(cm[1]) > colIdx) { insertAt = cm.index; break; }
  }
  const newBody = rowBody.slice(0, insertAt) + cellXml + rowBody.slice(insertAt);
  return sheet.slice(0, rm.index) + rowOpen + newBody + rowClose + sheet.slice(rm.index + rm[0].length);
}

// เขียนค่าลงเซลล์เดิมโดย "คง style เดิม" — set inline string โดยไม่แตะ attribute s
// หมายเหตุ: เซลล์เป้าหมายบางตัว (H16, C24, B22/F22/H22) ถูก Excel ตัดออกจาก sheet1.xml ตอนสร้าง
// template (Task 2 SaveAs) เพราะเป็นเซลล์ว่างไม่มี border/รูปแบบเด่น (s="6" ล้วน ไม่ใช่ merge anchor)
// → ต้องแทรกใหม่ ไม่ใช่แค่แทนที่ ไม่งั้นค่าจะเงียบหายไปโดยไม่มี error
function aoSetCellText(sheet, addr, text) {
  const esc = frmEscapeXml(text);
  const re = new RegExp('<c r="' + addr + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)');
  if (re.test(sheet)) {
    return sheet.replace(re, (m, attrs) => {
      const s = (attrs.match(/ s="\d+"/) || [''])[0];
      return '<c r="' + addr + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + esc + '</t></is></c>';
    });
  }
  // ไม่พบเซลล์ในต้นฉบับ → แทรกใหม่ s="6" (ไม่มีเส้นขอบ; ค่าตกอยู่บนเส้นขีดที่วาดทับด้วย connector shape อยู่แล้ว ไม่กระทบภาพรวม)
  return aoInsertCell(sheet, addr, '<c r="' + addr + '" s="6" t="inlineStr"><is><t xml:space="preserve">' + esc + '</t></is></c>');
}

function aoSetCellDate(sheet, addr, iso) {
  const serial = frmDateSerial(iso);
  if (serial == null) return sheet;
  const re = new RegExp('<c r="' + addr + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)');
  if (re.test(sheet)) {
    return sheet.replace(re, (m, attrs) => {
      const s = (attrs.match(/ s="\d+"/) || [''])[0];
      return '<c r="' + addr + '"' + s + '><v>' + serial + '</v></c>';
    });
  }
  // กันเผื่อกรณีเซลล์วันที่ถูกตัดหายเหมือนกัน (ไม่มีในสองเซลล์วันที่ปัจจุบัน H4/H24 แต่กัน mechanism ไว้ให้เหมือนกัน)
  return aoInsertCell(sheet, addr, '<c r="' + addr + '" s="6"><v>' + serial + '</v></c>');
}

function assetOutRenderTemplate(templateBuf, d, photoBytes) {
  return JSZip.loadAsync(templateBuf).then(async zip => {
    let sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
    const T = (addr, txt) => { sheet = aoSetCellText(sheet, addr, txt); };
    const D = (addr, iso) => { sheet = aoSetCellDate(sheet, addr, iso); };
    // autofill (ต่อท้าย label)
    T('A6', 'ชื่อทรัพย์สิน   ' + (d.instrument_name || ''));
    T('G6', 'รหัสทรัพย์สิน   ' + (d.asset_no || ''));
    T('G8', 'รหัส    ID.No.  ' + (d.id_code || ''));
    T('I28', d.dept_name || ''); T('I40', d.dept_name || '');
    T('J28', d.cost_center ? 'Cost Center  ' + d.cost_center : '');
    T('J40', d.cost_center ? 'Cost Center  ' + d.cost_center : '');
    // dialog
    D('H4', d.permit_date);
    T('A8', 'เป็นส่วนประกอบของ  ' + (d.is_component_of || ''));
    T('A10', 'Job Oder No. ' + (d.job_order_no || ''));
    T('A12', 'รายละเอียด/ปัญหางานซ่อม   ' + (d.detail || ''));
    T('A14', 'PR. NO. ' + (d.pr_no || ''));
    T('G14', 'PO.NO. ' + (d.po_no || ''));
    T('H16', d.purpose || '');
    T('G18', d.vendor_name || '');
    T('B20', d.vendor_address || '');
    T('B22', d.vendor_phone || '');
    T('F22', d.vendor_fax || '');
    T('H22', d.vendor_email || '');
    T('C24', d.vendor_contact || '');
    D('H24', d.due_date);
    zip.file('xl/worksheets/sheet1.xml', sheet);
    // รูปทรัพย์สิน → เขียนทับ image2.jpeg (rId2)
    if (photoBytes) zip.file('xl/media/image2.jpeg', photoBytes);
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  });
}
