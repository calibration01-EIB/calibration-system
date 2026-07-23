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

// ===== Dialog + submit flow (ปุ่ม 📤 นำทรัพย์สินออก ในหน้าเครื่องมือ) =====
let aoState = { inst: null, photoBytes: null };

async function openAssetOutModal(instrumentId) {
  const { data, error } = await sb.from('instruments').select('*').eq('id', instrumentId).single();
  if (error || !data) { showToast('โหลดข้อมูลเครื่องมือไม่สำเร็จ', 'error'); return; }
  aoState = { inst: data, photoBytes: null };
  const today = new Date().toISOString().slice(0, 10);
  const dept = data.division || data.department || '';
  document.getElementById('assetOutBody').innerHTML = `
    <div class="modal-header">
      <h3>📤 ใบขออนุญาตนำทรัพย์สินออกนอกบริษัท</h3>
      <button class="btn-close" onclick="closeAssetOutModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="meta-row">
        <div class="meta-item"><label>เครื่องมือ</label><span>${frmEscapeXml(data.instrument_name || '')}</span></div>
        <div class="meta-item"><label>รหัสทรัพย์สิน</label><span>${frmEscapeXml(data.asset_no || '')}</span></div>
        <div class="meta-item"><label>ID Code</label><span>${frmEscapeXml(data.id_code || '')}</span></div>
      </div>
      <div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
        <div class="form-group"><label>วันที่</label><input id="ao_date" type="date" value="${today}"></div>
        <div class="form-group"><label>เป็นส่วนประกอบของ</label><input id="ao_component" type="text"></div>
        <div class="form-group"><label>Job Order No.</label><input id="ao_job" type="text"></div>
        <div class="form-group" style="grid-column:span 2"><label>รายละเอียด/ปัญหา</label><textarea id="ao_detail" style="width:100%;min-height:60px;padding:12px 14px;border:1.5px solid var(--border);border-radius:var(--radius);font-family:var(--font);font-size:14px;color:var(--text);background:var(--surface);resize:vertical">ส่งเครื่องมือไปสอบเทียบภายนอก ตามวาระ 1ปี/ครั้ง (ISO 17025)</textarea></div>
        <div class="form-group"><label>PR. NO.</label><input id="ao_pr" type="text"></div>
        <div class="form-group"><label>PO. NO.</label><input id="ao_po" type="text"></div>
        <div class="form-group" style="grid-column:span 2"><label>วัตถุประสงค์</label><input id="ao_purpose" type="text" value="ส่งเครื่องมือไปสอบเทียบภายนอก"></div>
        <div class="form-group" style="grid-column:span 2"><label>บริษัท/ร้านที่รับแก้ไข</label><input id="ao_vname" type="text"></div>
        <div class="form-group" style="grid-column:span 2"><label>ที่อยู่</label><input id="ao_vaddr" type="text"></div>
        <div class="form-group"><label>โทรศัพท์</label><input id="ao_vphone" type="text"></div>
        <div class="form-group"><label>โทรสาร</label><input id="ao_vfax" type="text"></div>
        <div class="form-group"><label>Email</label><input id="ao_vemail" type="text"></div>
        <div class="form-group"><label>ชื่อผู้ติดต่อ</label><input id="ao_vcontact" type="text"></div>
        <div class="form-group"><label>กำหนดวันแล้วเสร็จ</label><input id="ao_due" type="date"></div>
        <div class="form-group"><label>รูปทรัพย์สิน</label>
          <input id="ao_photo" type="file" accept="image/*" onchange="assetOutPickPhoto(event)">
          <img id="ao_photo_prev" style="max-width:120px;display:none;margin-top:6px;border-radius:6px">
        </div>
      </div>
      <div class="ao-hint" style="margin-top:10px;color:var(--text3);font-size:13px">
        Cost Center: ${frmEscapeXml(data.cost_center || '(ยังไม่ตั้ง)')} · หน่วยงาน: ${frmEscapeXml(dept)}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeAssetOutModal()">ยกเลิก</button>
      <button class="btn-primary" onclick="assetOutSubmit()">บันทึก + Export .xlsx</button>
    </div>`;
  document.getElementById('assetOutModal').classList.add('open');
}

function closeAssetOutModal() {
  document.getElementById('assetOutModal').classList.remove('open');
  aoState = { inst: null, photoBytes: null };
}

function assetOutPickPhoto(ev) {
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  f.arrayBuffer().then(buf => { aoState.photoBytes = buf; });
  const prev = document.getElementById('ao_photo_prev');
  prev.src = URL.createObjectURL(f);
  prev.style.display = 'block';
}

async function assetOutSubmit() {
  const d = aoState.inst; if (!d) return;
  const val = id => (document.getElementById(id).value || '').trim();
  const dept = d.division || d.department || '';
  const rec = {
    instrument_id: d.id, permit_date: val('ao_date') || null,
    is_component_of: val('ao_component'), job_order_no: val('ao_job'),
    detail: val('ao_detail'), pr_no: val('ao_pr'), po_no: val('ao_po'),
    purpose: val('ao_purpose'), vendor_name: val('ao_vname'), vendor_address: val('ao_vaddr'),
    vendor_phone: val('ao_vphone'), vendor_fax: val('ao_vfax'), vendor_email: val('ao_vemail'),
    vendor_contact: val('ao_vcontact'), due_date: val('ao_due') || null,
    cost_center: d.cost_center || null, dept_name: dept,
    created_by: currentUser?.name || 'Unknown'
  };
  // 1) insert → ได้ id
  const { data: ins, error } = await sb.from('asset_out_permits').insert(rec).select('id').single();
  if (error) { showToast('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return; }
  // 2) upload รูป (ถ้ามี) → path asset_out_permits/<instrument_id>/<permit_id>.jpg
  if (aoState.photoBytes) {
    const path = `asset_out_permits/${d.id}/${ins.id}.jpg`;
    const { error: upErr } = await sb.storage.from('certificates')
      .upload(path, new Blob([aoState.photoBytes], { type: 'image/jpeg' }), { upsert: true, contentType: 'image/jpeg' });
    if (!upErr) await sb.from('asset_out_permits').update({ photo_path: path }).eq('id', ins.id);
  }
  // 3) export
  await assetOutExport({ ...rec, instrument_name: d.instrument_name, asset_no: d.asset_no, id_code: d.id_code }, aoState.photoBytes);
  showToast('สร้างใบนำทรัพย์สินออกแล้ว', 'success');
  closeAssetOutModal();
}

async function assetOutExport(data, photoBytes) {
  if (typeof JSZip === 'undefined') { showToast('โหลด JSZip ไม่สำเร็จ (ต้องออนไลน์ครั้งแรก)', 'error'); return; }
  const buf = await assetOutGetTemplate();
  const blob = await assetOutRenderTemplate(buf, data, photoBytes || null);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ใบนำทรัพย์สินออก_${(data.id_code || 'asset').replace(/[\\/:*?"<>|]/g, '_')}_${(data.permit_date || '').replace(/-/g, '')}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
