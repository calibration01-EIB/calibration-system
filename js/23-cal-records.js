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

// ===== หน้าติดตามผลสอบเทียบ: โหลด calibration_records ทั้งหมดมาไว้จับคู่กับเครื่องมือ =====
let CALRECS = [];
async function loadCalrecsPage() {
  const body = document.getElementById('calrecBody');
  if (body) body.innerHTML = '<tr><td colspan="8" class="no-data">กำลังโหลด...</td></tr>';
  try {
    const { data, error } = await sb.from('calibration_records')
      .select('id,cert_no,job_no,cal_date,due_date,status,calibrated_by,approved_by,approved_at,signed_file_path,instrument_id')
      .order('cal_date', { ascending: false }).order('created_at', { ascending: false });
    if (error) throw error;
    CALRECS = data || [];
  } catch (e) {
    CALRECS = [];
    if (body) body.innerHTML = `<tr><td colspan="8" class="no-data" style="color:var(--red)">โหลดไม่สำเร็จ: ${escapeHtmlText(e.message || '')}</td></tr>`;
    return;
  }
  renderCalrecsTable();
}
/* ===== ติดตามผลสอบเทียบ (ดีไซน์ Calibration App) =====
   มุมเครื่องมือ ไม่ใช่มุมใบ Cert: 1 แถว = 1 เครื่อง พร้อมความคืบหน้า 4 ขั้น
   ขั้นตอนแมปจากของที่มีอยู่แล้ว — planStatusMap (06-plan) + calibration_records
     1 วางแผน      : มีแผนผูกกับเครื่องนี้
     2 อนุมัติแผน   : plan.status ≥ planned
     3 สอบเทียบ    : plan.status = completed หรือมีใบ record แล้ว
     4 แนบสแกน     : record.status = approved หรือมีไฟล์สแกน                       */

const CRC_SCOPES = [
  { v: 'due30',   emoji: '🗓️', label: 'ครบกำหนดใน 30 วัน', bg: '#eef4f9', fg: '#0c4a5e', bd: '#d5e1ea',
    title: 'เครื่องมือที่ครบกำหนดภายใน 1 เดือน', meta: 'รวมรายการที่เลยกำหนดแล้ว · เรียงตามความเร่งด่วน' },
  { v: 'noplan',  emoji: '📋', label: 'ยังไม่ได้วางแผน',   bg: '#fde8e8', fg: '#b91c1c', bd: '#f6cfcf',
    title: 'ครบกำหนดใน 1 เดือน แต่ยังไม่ได้วางแผน', meta: 'ต้องเปิดแผนสอบเทียบให้เครื่องเหล่านี้ก่อน' },
  { v: 'running', emoji: '🚚', label: 'อยู่ระหว่างดำเนินการ', bg: '#e6f1fb', fg: '#185fa5', bd: '#cfe1f4',
    title: 'อยู่ระหว่างดำเนินการ', meta: 'วางแผนแล้วแต่ยังไม่ปิดงาน — ทุกช่วงวันครบกำหนด' },
  { v: 'scan',    emoji: '📎', label: 'รอแนบสแกน',        bg: '#fdf3dd', fg: '#b45309', bd: '#f3e0b6',
    title: 'สอบเทียบเสร็จแล้ว รอแนบสแกนใบรับรอง', meta: 'แสดงทุกใบที่ยังไม่แนบสแกน ไม่จำกัดวันครบกำหนด' },
  { v: 'done',    emoji: '✅', label: 'เสร็จสมบูรณ์',      bg: '#e1f5ee', fg: '#0f6e56', bd: '#c4e8dc',
    title: 'เสร็จสมบูรณ์', meta: 'แนบสแกนและอนุมัติแล้ว · แสดง 200 รายการล่าสุด' }
];

function crcScope() {
  const v = document.getElementById('calrecStatus')?.value || 'due30';
  return CRC_SCOPES.find(s => s.v === v) || CRC_SCOPES[0];
}

/* ใบล่าสุดของเครื่องนี้ — CALRECS เรียง cal_date desc มาแล้ว, ข้ามใบที่ยกเลิก */
function crcLatestRec(instrumentId) {
  return (CALRECS || []).find(r => r.instrument_id === instrumentId && r.status !== 'voided') || null;
}

function crcRowModel(d) {
  const rec = crcLatestRec(d.id);
  const ps = (typeof planStatusMap !== 'undefined' ? planStatusMap[d.id] : null) || null;
  const st = ps ? ps.status : null;
  const done = [
    !!st,                                                            // 1 วางแผน
    ['planned', 'pending_cert', 'completed'].includes(st),           // 2 อนุมัติแผน
    st === 'completed' || !!rec,                                     // 3 สอบเทียบ
    !!rec && (rec.status === 'approved' || !!rec.signed_file_path)   // 4 แนบสแกน
  ];
  // rejected ไม่ใช่ "ขั้น" — เป็นธงเสริมข้าง ๆ (แผนถูกตีกลับ = ยังค้างอยู่ที่ขั้นอนุมัติแผน)
  let stage;
  if (done[3])            stage = ['✅', 'เสร็จสมบูรณ์',    '#e1f5ee', '#0f6e56', '#c4e8dc'];
  else if (done[2])       stage = ['📎', 'รอแนบสแกน',      '#fdf3dd', '#b45309', '#f3e0b6'];
  else if (done[1])       stage = ['🚚', 'รอผลสอบเทียบ',    '#e6f1fb', '#185fa5', '#cfe1f4'];
  else if (done[0])       stage = ['🕒', 'รออนุมัติแผน',    '#faeeda', '#854f0b', '#f0dcb4'];
  else                    stage = ['📋', 'ยังไม่ได้วางแผน', '#eef0f3', '#5f6b7a', '#dfe4ea'];
  return { d, rec, ps, planStatus: st, done, stage, rejected: st === 'rejected' };
}

function crcMatchScope(m, scope) {
  const near = m.d.days_left !== null && m.d.days_left !== undefined && m.d.days_left <= 30;
  if (scope === 'due30')   return near;
  if (scope === 'noplan')  return near && !m.done[0];
  if (scope === 'running') return m.done[0] && !m.done[3];
  if (scope === 'scan')    return m.done[2] && !m.done[3];
  if (scope === 'done')    return m.done[3];
  return true;
}

function crcModels() {
  return (allData || [])
    .filter(d => !(d.calibration_cancelled === true
      || (typeof window.isCalibrationCancelled === 'function' && window.isCalibrationCancelled(d))))
    .map(crcRowModel);
}

function renderCalrecTiles(models) {
  const host = document.getElementById('calrecTiles');
  if (!host) return;
  const active = crcScope().v;
  host.innerHTML = CRC_SCOPES.slice(0, 4).map(s => {
    const n = models.filter(m => crcMatchScope(m, s.v)).length;
    return `<button type="button" class="ax-crc-tile${active === s.v ? ' is-on' : ''}" onclick="setCalrecScope('${s.v}')">
      <span class="ax-crc-ic" style="background:${s.bg};border-color:${s.bd}">${s.emoji}</span>
      <span class="ax-crc-tx">
        <b style="color:${s.fg}">${n.toLocaleString()}</b>
        <span>${s.label}</span>
      </span>
    </button>`;
  }).join('');
}

function renderCalrecChips(models) {
  const host = document.getElementById('calrecChips');
  if (!host) return;
  const active = crcScope().v;
  host.innerHTML = CRC_SCOPES.map(s => {
    const n = models.filter(m => crcMatchScope(m, s.v)).length;
    const on = active === s.v;
    const style = on ? `background:${s.bg};border-color:${s.fg}66;color:${s.fg}`
                     : 'background:#fff;border-color:#d7e3ec;color:#4a6377';
    return `<button type="button" class="ax-chip${on ? ' is-on' : ''}" style="${style}" onclick="setCalrecScope('${s.v}')">
      <span class="ax-chip-e">${s.emoji}</span><span>${s.label}</span><b>${n.toLocaleString()}</b>
    </button>`;
  }).join('');
}

function setCalrecScope(v) {
  const sel = document.getElementById('calrecStatus');
  if (sel) sel.value = v;
  renderCalrecsTable();
}

function crcStepsHtml(m) {
  const labels = ['วางแผน', 'อนุมัติแผน', 'สอบเทียบ', 'แนบสแกน'];
  return '<span class="ax-steps">' + labels.map((lb, i) => {
    const ok = m.done[i];
    const cls = ok ? 'is-done' : (i > 0 && m.done[i - 1] ? 'is-now' : '');
    const line = i < labels.length - 1
      ? `<i class="ax-step-line${m.done[i + 1] ? ' is-done' : ''}"></i>` : '';
    return `<span class="ax-step ${cls}">
      <span class="ax-step-dot">${ok ? '✓' : i + 1}</span>
      <span class="ax-step-lb">${lb}</span>
    </span>${line}`;
  }).join('') + '</span>';
}

function crcActionHtml(m) {
  const id = Number(m.d.id) || 0;
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  if (!m.done[0])
    return `<button type="button" class="ax-crc-act is-primary" onclick="event.stopPropagation();goToPlanWithItem(${id})"><span>📋</span><span>วางแผน</span></button>`;
  if (!m.done[2])
    return `<button type="button" class="ax-crc-act" onclick="event.stopPropagation();goToPlanDetail(${id})"><span>📅</span><span>ดูแผน</span></button>`;
  if (!m.done[3] && m.rec && canEdit)
    return `<button type="button" class="ax-crc-act is-primary" onclick="event.stopPropagation();calRecComplete('${m.rec.id}')"><span>📎</span><span>แนบสแกน</span></button>`;
  if (m.rec && m.rec.signed_file_path)
    return `<button type="button" class="ax-crc-act" onclick="event.stopPropagation();viewSignedScan('${String(m.rec.signed_file_path).replace(/'/g, '')}')"><span>📄</span><span>ดูสแกน</span></button>`;
  if (m.rec)
    return `<button type="button" class="ax-crc-act" onclick="event.stopPropagation();openRecReview('${m.rec.id}')"><span>🔍</span><span>ดูรายละเอียด</span></button>`;
  return `<button type="button" class="ax-crc-act" onclick="event.stopPropagation();openCalHistory(${id})"><span>🕘</span><span>ประวัติ</span></button>`;
}

function filterCalrecs() { renderCalrecsTable(); }

function renderCalrecsTable() {
  const body = document.getElementById('calrecBody');
  if (!body) return;
  const scope = crcScope();
  const q = (document.getElementById('calrecSearch')?.value || '').trim().toLowerCase();
  const fmt = s => s ? new Date(s).toLocaleDateString('th-TH-u-ca-gregory', { year: 'numeric', month: 'short', day: 'numeric' }) : '–';

  const all = crcModels();
  renderCalrecTiles(all);
  renderCalrecChips(all);

  let rows = all.filter(m => crcMatchScope(m, scope.v));
  if (q) rows = rows.filter(m => [m.d.instrument_name, m.d.id_code, m.d.department, m.d.division,
    m.d.location, m.rec && m.rec.cert_no].some(v => String(v || '').toLowerCase().includes(q)));

  // ค้างนานสุดขึ้นก่อน; ส่วนที่ปิดงานแล้วเรียงใบล่าสุดก่อน
  if (scope.v === 'done') {
    rows.sort((a, b) => String(b.rec && b.rec.cal_date || '').localeCompare(String(a.rec && a.rec.cal_date || '')));
    rows = rows.slice(0, 200);
  } else {
    rows.sort((a, b) => (a.d.days_left ?? 99999) - (b.d.days_left ?? 99999));
  }

  const title = document.getElementById('calrecScopeTitle');
  if (title) title.textContent = scope.title;
  const meta = document.getElementById('calrecScopeMeta');
  if (meta) meta.textContent = scope.meta;
  const cnt = document.getElementById('calrecCount');
  if (cnt) cnt.textContent = `${scope.label} · ${rows.length.toLocaleString()} รายการ`;

  const empty = document.getElementById('calrecEmpty');
  if (empty) empty.style.display = rows.length ? 'none' : 'flex';
  const card = body.closest('.ax-tablecard');
  const wrap = card && card.querySelector('.table-wrap');
  if (wrap) wrap.style.display = rows.length ? '' : 'none';
  if (!rows.length) { body.innerHTML = ''; return; }

  body.innerHTML = rows.map((m, i) => {
    const d = m.d;
    const id = Number(d.id) || 0;
    const displayType = typeof getDisplayInstrumentType === 'function' ? getDisplayInstrumentType(d) : d.instrument_type;
    const [letter, , color] = typeof regTypeMeta === 'function' ? regTypeMeta(displayType, d) : ['-', '', '#52667d'];
    const days = d.days_left;
    let dueFg = '#0f6e56', daysText = '–';
    if (days === null || days === undefined) { dueFg = '#7a8fa3'; }
    else if (days < 0)  { dueFg = '#d93a3a'; daysText = 'เกิน ' + Math.abs(days) + ' วัน'; }
    else if (days <= 30) { dueFg = '#b45309'; daysText = days === 0 ? 'วันนี้' : 'อีก ' + days + ' วัน'; }
    else { daysText = 'อีก ' + days + ' วัน'; }
    const calBy = (m.rec && m.rec.calibrated_by) || d.cal_type || '–';
    // เครื่องที่นำเข้าจากบัญชีรายการมี instruments.cert_no แต่ไม่มีแถวใน calibration_records
    // ถ้าไม่ตกมาใช้เลขทะเบียน หน้านี้จะขึ้น "ยังไม่มีใบรับรอง" ทั้งที่ทะเบียนมีเลขอยู่
    const regCert = (!m.rec && d.cert_no) ? String(d.cert_no) : '';
    const recFg = m.done[3] ? '#0f6e56' : (m.rec ? '#b45309' : (regCert ? '#5b7186' : '#8ba0b2'));

    return `<tr onclick="openCalHistory(${id})" title="คลิกเพื่อดูประวัติการสอบเทียบ">
      <td class="c-no">${i + 1}</td>
      <td class="c-name">
        <div class="ax-namecell">
          <span class="ax-tletter" style="background:${color}1a;color:${color}">${escapeHtmlText(letter)}</span>
          <span class="ax-nametx">
            <span class="ax-crc-name">${escapeHtmlText(d.instrument_name || '–')}</span>
            <span class="ax-crc-id">${escapeHtmlText(d.id_code || '–')}</span>
            <span class="ax-sub">ผู้ดูแล ${escapeHtmlText(d.division || d.location || d.department || '–')}</span>
          </span>
        </div>
      </td>
      <td class="c-dept"><span class="ax-mono">${escapeHtmlText(d.department || '–')}</span></td>
      <td class="c-due">
        <span class="ax-duecell">
          <b>${fmt(d.due_date)}</b>
          <span style="color:${dueFg}">${escapeHtmlText(daysText)}</span>
        </span>
      </td>
      <td class="c-by">${escapeHtmlText(calBy)}</td>
      <td class="c-prog">
        ${crcStepsHtml(m)}
        <span class="ax-tagrow ax-crc-stagerow">
          <span class="ax-crc-stage" style="background:${m.stage[2]};color:${m.stage[3]};border-color:${m.stage[4]}">${m.stage[0]} ${m.stage[1]}</span>
          ${m.rejected ? '<span class="ax-crc-stage" style="background:#fdf1dc;color:#a8620a;border-color:#f5ddb4">↩️ หัวหน้าส่งกลับแก้ไข</span>' : ''}
        </span>
      </td>
      <td class="c-rec">
        <span class="ax-crc-rec">
          <b style="color:${recFg}">${escapeHtmlText((m.rec && m.rec.cert_no) || regCert || 'ยังไม่มีใบรับรอง')}</b>
          <span>${m.rec ? fmt(m.rec.cal_date) : (regCert ? 'จากทะเบียน · ' + fmt(d.cal_date) : '–')}</span>
        </span>
      </td>
      <td class="c-act">${crcActionHtml(m)}</td>
    </tr>`;
  }).join('');
}

async function openCalHistory(instrumentId) {
  const d = allData.find(x => x.id === instrumentId);
  if (!d) return;
  const fmt = s => s ? new Date(s).toLocaleDateString('th-TH-u-ca-gregory',{year:'numeric',month:'short',day:'numeric'}) : '–';

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
