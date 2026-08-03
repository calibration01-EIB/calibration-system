/* ===== 23-cal-records.js ===== ติดตามผลสอบเทียบ (calibration_records — แยกจาก 02-dashboard.js) */
// ขอบเขต: หน้าติดตามผล + ประวัติการสอบเทียบรายเครื่อง + แนบไฟล์สแกนใบ Cert ที่เซ็นแล้ว (status -> approved)
// ไม่ใช่ตัว Dashboard — แก้เรื่องผลสอบ/ประวัติ/ไฟล์สแกน ให้แก้ที่ไฟล์นี้
// ===== ทำใบ Cert ให้สมบูรณ์: ปริ้นไปเซ็นกระดาษ → แนบไฟล์สแกน → status=approved (เสร็จสมบูรณ์) =====
let calHistInstId = null;
const SIGNED_BUCKET = 'certificates';   // reuse bucket เดิม · โฟลเดอร์ signed-certs/<recordId>/
async function calRecComplete(recordId) {
  if (!(currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor'))) { showToast('เฉพาะ admin/editor เท่านั้น', 'error'); return; }
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/pdf,image/*';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    try {
      if (typeof showLoading === 'function') showLoading('กำลังอัปโหลดไฟล์สแกน...');
      const safe = f.name.replace(/[^\w.\-]/g, '_');
      const path = 'signed-certs/' + recordId + '/' + Date.now() + '_' + safe;
      const { error: upErr } = await sb.storage.from(SIGNED_BUCKET).upload(path, f, { upsert: true });
      if (upErr) throw upErr;
      const { error } = await sb.from('calibration_records')
        .update({ status: 'approved', signed_file_path: path, approved_by: currentUser.name, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', recordId);
      if (error) throw error;
      showToast('แนบไฟล์สแกน + ทำให้สมบูรณ์แล้ว', 'success');
      if (typeof renderPendingCertWidget === 'function') renderPendingCertWidget();
      const cp = document.getElementById('pageCalrecs');
      if (cp && cp.style.display !== 'none' && typeof loadCalrecsPage === 'function') loadCalrecsPage();
      const hm = document.getElementById('calHistoryModal');
      if (calHistInstId && hm && hm.classList.contains('open')) openCalHistory(calHistInstId);
    } catch (e) { showToast('ไม่สำเร็จ: ' + (e.message || ''), 'error'); }
    finally { if (typeof hideLoading === 'function') hideLoading(); }
  };
  inp.click();
}
async function viewSignedScan(path) {
  try {
    const { data, error } = await sb.storage.from(SIGNED_BUCKET).createSignedUrl(path, 300);
    if (error || !data) throw (error || new Error('no url'));
    window.open(data.signedUrl, '_blank');
  } catch (e) { showToast('เปิดไฟล์สแกนไม่ได้: ' + (e.message || ''), 'error'); }
}

// ===== แจ้งเตือนข้างระฆัง 📎: สอบเทียบเสร็จแล้ว (issued) แต่ยังไม่แนบสแกน =====
// ชื่อฟังก์ชันคงเดิมเพราะถูกเรียกจาก loadData/calRecComplete หลายจุด — เปลี่ยนจาก
// วาดกล่องบน Dashboard มาเป็นอัปเดต badge ที่ topbar + เก็บรายการให้ dropdown (07-notifications.js)
async function renderPendingCertWidget() {
  let recs = [];
  try {
    const { data, error } = await sb.from('calibration_records')
      .select('id,cert_no,cal_date,instrument_id,calibrated_by')
      .eq('status', 'issued').order('cal_date', { ascending: true });
    if (error) throw error;
    recs = data || [];
  } catch (e) { recs = []; }
  window._scanNotifRecs = recs;
  const navBadge = document.getElementById('navCalrecsBadge');
  if (navBadge) { navBadge.textContent = recs.length; navBadge.style.display = recs.length ? 'inline-block' : 'none'; }
  const badge = document.getElementById('scanNotifBadge');
  const countEl = document.getElementById('scanNotifCount');
  if (badge) badge.style.display = recs.length ? 'flex' : 'none';
  if (countEl) countEl.textContent = recs.length > 99 ? '99+' : recs.length;
  const dd = document.getElementById('scanNotifDropdown');
  if (dd && dd.style.display === 'block') renderScanNotifDropdown();
}

// ===== หน้าติดตามผลสอบเทียบ: ตารางรวม calibration_records ทั้งหมด + กรองสถานะ/ค้นหา =====
let CALRECS = [];
async function loadCalrecsPage() {
  const body = document.getElementById('calrecBody');
  if (body) body.innerHTML = '<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--text3)">กำลังโหลด...</td></tr>';
  try {
    const { data, error } = await sb.from('calibration_records')
      .select('id,cert_no,job_no,cal_date,due_date,status,calibrated_by,approved_by,approved_at,signed_file_path,instrument_id')
      .order('cal_date', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    CALRECS = data || [];
  } catch (e) {
    CALRECS = [];
    if (body) body.innerHTML = `<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--red)">โหลดไม่สำเร็จ: ${escapeHtmlText(e.message || '')}</td></tr>`;
    return;
  }
  renderCalrecsTable();
}
function filterCalrecs() { renderCalrecsTable(); }
function renderCalrecsTable() {
  const body = document.getElementById('calrecBody'); if (!body) return;
  const q = (document.getElementById('calrecSearch')?.value || '').trim().toLowerCase();
  const st = document.getElementById('calrecStatus')?.value || '';
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  const fmt = s => s ? new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '–';
  const instOf = id => (allData || []).find(x => x.id === id) || {};
  const rows = CALRECS.filter(r => {
    if (st && r.status !== st) return false;
    if (!q) return true;
    const inst = instOf(r.instrument_id);
    return [r.cert_no, inst.instrument_name, inst.id_code, r.job_no].some(v => String(v || '').toLowerCase().includes(q));
  });
  const cnt = document.getElementById('calrecCount');
  if (cnt) cnt.textContent = CALRECS.length ? `แสดง ${rows.length} จาก ${CALRECS.length} ใบ` : '';
  if (!rows.length) { body.innerHTML = `<tr><td colspan="7" style="padding:16px;text-align:center;color:var(--text3)">ไม่มีข้อมูล</td></tr>`; return; }
  body.innerHTML = rows.map(r => {
    const inst = instOf(r.instrument_id);
    const name = escapeHtmlText(inst.instrument_name || '–');
    const idc = escapeHtmlText(inst.id_code || '–');
    const nameCell = inst.id != null ? `<a onclick="openCalHistory(${inst.id})" style="cursor:pointer;color:#00695C;font-weight:700">${name}</a>` : `<strong>${name}</strong>`;
    const acts = [];
    if (r.status === 'issued' && canEdit) acts.push(`<button onclick="calRecComplete('${r.id}')" style="padding:4px 9px;border:1px solid #1b5e20;border-radius:6px;background:#1b5e20;color:#fff;font-size:11.5px;cursor:pointer">📎 แนบสแกน</button>`);
    acts.push(`<button onclick="openRecReview('${r.id}')" style="padding:4px 9px;border:1px solid var(--border);border-radius:6px;background:#fff;font-size:11.5px;cursor:pointer">ดูรายละเอียด</button>`);
    if (r.signed_file_path) acts.push(`<button onclick="viewSignedScan('${String(r.signed_file_path).replace(/'/g, '')}')" style="padding:4px 9px;border:1px solid #00695C;border-radius:6px;background:#fff;color:#00695C;font-size:11.5px;cursor:pointer">📎 สแกน</button>`);
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px;font-family:var(--mono),monospace;font-weight:700">${escapeHtmlText(r.cert_no || '–')}</td>
      <td style="padding:8px">${nameCell} <span style="color:var(--text3);font-size:11px">${idc}</span></td>
      <td style="padding:8px;white-space:nowrap">${fmt(r.cal_date)}</td>
      <td style="padding:8px;white-space:nowrap">${fmt(r.due_date)}</td>
      <td style="padding:8px">${escapeHtmlText(r.calibrated_by || '–')}</td>
      <td style="padding:8px">${calRecStatusBadge(r.status)}</td>
      <td style="padding:8px"><span style="display:inline-flex;gap:5px;flex-wrap:wrap">${acts.join('')}</span></td>
    </tr>`;
  }).join('');
}

async function openCalHistory(instrumentId) {
  const d = allData.find(x => x.id === instrumentId);
  if (!d) return;
  const fmt = s => s ? new Date(s).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}) : '–';

  document.getElementById('calHistoryTitle').textContent = d.id_code || '–';
  document.getElementById('calHistoryBody').innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3)">กำลังโหลด...</div>';
  document.getElementById('calHistoryModal').classList.add('open');

  // ดึงประวัติจาก calibration_history
  const { data: history } = await sb.from('calibration_history')
    .select('*')
    .eq('instrument_id', instrumentId)
    .order('cal_date', { ascending: false })
    .limit(3);

  const rows = history || [];

  calHistInstId = instrumentId;   // เก็บไว้ refresh modal หลังเซ็น/อนุมัติ
  // ดึงผลสอบเทียบจริง (calibration_records) ของเครื่องนี้
  const { data: records } = await sb.from('calibration_records')
    .select('id,cert_no,cal_date,due_date,status,calibrated_by,approved_by,approved_at,signed_file_path')
    .eq('instrument_id', instrumentId)
    .order('cal_date', { ascending: false }).limit(20);
  const recs = records || [];

  document.getElementById('calHistoryBody').innerHTML = `
    <div style="margin-bottom:14px">
      <div style="font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">🟢 รอบปัจจุบัน</div>
      <div style="background:var(--accent-light);border-radius:10px;padding:12px 16px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><div style="font-size:11px;color:var(--text3)">CERT.</div>
          <div style="font-size:14px;font-weight:600;color:var(--accent);font-family:var(--mono)">${d.cert_no||'–'}</div></div>
        <div><div style="font-size:11px;color:var(--text3)">วันสอบเทียบ</div>
          <div style="font-size:13px;font-weight:600;color:var(--accent)">${fmt(d.cal_date)}</div></div>
        <div><div style="font-size:11px;color:var(--text3)">ครบกำหนด</div>
          <div style="font-size:13px;font-weight:600;color:var(--text)">${fmt(d.due_date)}</div></div>
        <div><div style="font-size:11px;color:var(--text3)">ความถี่</div>
          <div style="font-size:12px;color:var(--text)">${d.cal_frequency||'–'}</div></div>
      </div>
    </div>
    <div style="margin-bottom:14px">
      <div style="font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">📄 ผลสอบเทียบ (ปริ้นใบ Cert ได้)</div>
      ${recs.length ? `<div style="display:flex;flex-direction:column;gap:6px">${recs.map(r => {
        const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
        const sub = [];
        if (r.approved_by) sub.push(`✅ สมบูรณ์โดย ${r.approved_by}${r.approved_at ? ' · ' + fmt(r.approved_at) : ''}`);
        let act = '';
        if (canEdit && r.status === 'issued') act = `<button class="btn-view" style="background:#1b5e20;color:#fff;border-color:#1b5e20;font-size:12px" onclick="calRecComplete('${r.id}')">📎 แนบสแกน → สมบูรณ์</button>`;
        const scanLink = r.signed_file_path ? `<button class="btn-view" style="background:#fff;color:#00695C;border-color:#00695C;font-size:12px" onclick="viewSignedScan('${r.signed_file_path}')">📎 ดูไฟล์สแกน</button>` : '';
        return `
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:120px">
            <div style="font-size:12px;font-weight:600;font-family:var(--mono);color:var(--accent)">${r.cert_no || '(ไม่มีเลข)'}</div>
            <div style="font-size:11px;color:var(--text3)">${fmt(r.cal_date)} · ${r.calibrated_by || '–'}</div>
            ${sub.length ? `<div style="font-size:10.5px;color:var(--text2);margin-top:2px">${sub.join(' &nbsp; ')}</div>` : ''}
          </div>
          ${calRecStatusBadge(r.status)}
          ${act}
          ${scanLink}
          <button class="btn-view" style="background:#00695C;color:#fff;border-color:#00695C;font-size:12px" onclick="openSavedCert('${r.id}')">📄 เปิด/ปริ้นใบ Cert</button>
        </div>`; }).join('')}</div>`
        : `<div style="background:var(--surface2);border:1px dashed var(--border);border-radius:10px;padding:16px;text-align:center;color:var(--text3);font-size:12px">ยังไม่มีผลสอบเทียบในระบบ</div>`}
    </div>
    ${rows.length ? `
    <div>
      <div style="font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">📋 ประวัติย้อนหลัง (${rows.length} รอบ)</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${rows.map((h, i) => `
        <div style="background:var(--surface2);border:1px solid var(--border);border-left:3px solid ${i===0?'#00897B':i===1?'#80CBC4':'#B2DFDB'};border-radius:8px;padding:10px 14px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
          <div><div style="font-size:10px;color:var(--text3)">CERT.</div>
            <div style="font-size:12px;font-weight:600;color:var(--text2);font-family:var(--mono)">${h.cert_no||'–'}</div></div>
          <div><div style="font-size:10px;color:var(--text3)">วันสอบ</div>
            <div style="font-size:12px;color:var(--text2)">${fmt(h.cal_date)}</div></div>
          <div><div style="font-size:10px;color:var(--text3)">ครบกำหนด</div>
            <div style="font-size:12px;color:var(--text2)">${fmt(h.due_date)}</div></div>
        </div>`).join('')}
      </div>
    </div>` : `
    <div>
      <div style="font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">📋 ประวัติย้อนหลัง</div>
      <div style="background:var(--surface2);border:1px dashed var(--border);border-radius:10px;padding:20px;text-align:center;color:var(--text3);font-size:12px">
        ยังไม่มีประวัติ<br><span style="font-size:11px">จะบันทึกอัตโนมัติเมื่อแก้ไข CERT หรือวันสอบ</span>
      </div>
    </div>`}
    <div style="margin-top:12px;padding:8px 12px;background:#f0f7f6;border-radius:8px;font-size:11px;color:var(--text2)">
      <strong>${d.instrument_name||'–'}</strong> · ${d.department||'–'} · ${d.cal_type||'–'}
    </div>`;
}

function calRecStatusBadge(status) {
  const m = {
    draft: ['ร่าง', '#eee', '#888'],
    issued: ['ออกเลขแล้ว — รอเซ็น/แนบสแกน', '#e3f0fb', '#1565c0'],
    signed: ['เซ็นแล้ว', '#fff8e1', '#9a6112'],
    approved: ['เสร็จสมบูรณ์', '#e8f5e9', '#1b5e20'],
    voided: ['ยกเลิก', '#fce8e8', '#c0392b'],
  };
  const x = m[status] || [status || '–', '#eee', '#666'];
  return `<span style="font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:20px;background:${x[1]};color:${x[2]}">${x[0]}</span>`;
}
// เปิดใบ Cert ย้อนหลังจาก calibration_records → ยิง data jsonb เข้า cert-print (เหมือน balance-cal)
// เปิดดูรายละเอียดใบบันทึก (balance-cal โหมดตรวจทาน) จาก record id
function openRecReview(recordId) { window.open('balance-cal.html#rec=' + encodeURIComponent(recordId), '_blank'); }
async function openSavedCert(recordId) {
  try {
    const { data, error } = await sb.from('calibration_records').select('data').eq('id', recordId).single();
    if (error || !data || !data.data) throw (error || new Error('no data'));
    window.open('cert-print.html#data=' + encodeURIComponent(JSON.stringify(data.data)), '_blank');
  } catch (e) {
    if (typeof showToast === 'function') showToast('เปิดใบ Cert ไม่ได้: ' + (e.message || ''), 'error'); else alert('เปิดใบ Cert ไม่ได้');
  }
}

function closeCalHistoryModal() {
  document.getElementById('calHistoryModal').classList.remove('open');
}

function autoFillPrevCert() {
  if (!editingInstrumentId) return;
  const original = allData.find(x => x.id === editingInstrumentId);
  if (!original) return;
  const newCert = document.getElementById('iCertNo').value.trim();
  const newDate = document.getElementById('iCalDate').value;
  // ถ้าค่าใหม่ต่างจากเดิม → แสดง prev ให้เห็น
  if ((newCert && newCert !== original.cert_no) || (newDate && newDate !== original.cal_date)) {
    document.getElementById('iPrevCertNo').value = original.cert_no || '–';
    document.getElementById('iPrevCalDate').value = original.cal_date || '';
  } else {
    document.getElementById('iPrevCertNo').value = original.prev_cert_no || '–';
    document.getElementById('iPrevCalDate').value = original.prev_cal_date || '';
  }
}

function goToPlanWithItem(instrumentId) {
  const d = allData.find(x => x.id == instrumentId);
  if (d && !planSelectedItems.some(s => s.id == d.id)) {
    planSelectedItems.push(d);
  }
  showPage('plan');
}

function goToPlanDetail(instrumentId) {
  showPage('plan');
  setTimeout(() => {
    switchPlanTab('list');
    setTimeout(() => {
      const ps = planStatusMap[instrumentId];
      if (!ps) return;
      const cards = document.querySelectorAll('#planListContainer > div');
      cards.forEach(card => {
        const titleEl = card.querySelector('span[style*="font-size:15px"]');
        if (titleEl && titleEl.textContent.trim() === ps.title) {
          card.style.transition = 'box-shadow .3s';
          card.style.boxShadow = '0 0 0 3px #00897B';
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const itemDiv = card.querySelector('[id^="items_"]');
          if (itemDiv) itemDiv.style.display = 'block';
          setTimeout(() => { card.style.boxShadow = ''; }, 3000);
        }
      });
    }, 800);
  }, 400);
}
