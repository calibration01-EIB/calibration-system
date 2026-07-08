/* ===== 02-dashboard.js ===== (generated from index.html inline app script) */

let _monthlyBarChart = null;
function renderMonthlyBarChart() {
  const canvas = document.getElementById('monthlyBarChart');
  if (!canvas || typeof Chart === 'undefined') return;
  if (!allData.length) { setTimeout(renderMonthlyBarChart, 500); return; }

  const yearLabel = document.getElementById('monthlyYearLabel');
  if (yearLabel) yearLabel.textContent = (new Date().getFullYear() + 543).toString();

  const byMonth = Array.from({length: 12}, () => ({ok: 0, warn: 0, over: 0}));
  allData.forEach(d => {
    if (!d.due_date || d.days_left === null) return;
    const m = new Date(d.due_date).getMonth();
    if (d.days_left < 0) byMonth[m].over++;
    else if (d.days_left <= 30) byMonth[m].warn++;
    else byMonth[m].ok++;
  });

  const labels = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  if (_monthlyBarChart) _monthlyBarChart.destroy();
  _monthlyBarChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'เกินกำหนด', data: byMonth.map(m => m.over), backgroundColor: 'rgba(221,47,59,.82)', borderRadius: 3 },
        { label: 'ใกล้ครบ',   data: byMonth.map(m => m.warn), backgroundColor: 'rgba(249,115,22,.82)', borderRadius: 3 },
        { label: 'ปกติ',      data: byMonth.map(m => m.ok),   backgroundColor: 'rgba(0,137,123,.82)', borderRadius: 3 },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,                 // ปิด animation → ไม่ redraw รัวตอน hover/resize
      hover: { mode: 'index', intersect: false, animationDuration: 0 },
      plugins: {
        legend: { position: 'top', align: 'end', labels: { font: { size: 11 }, usePointStyle: true, boxWidth: 8, padding: 16 } },
        tooltip: { mode: 'index', intersect: false, animation: false }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(0,0,0,.05)' }, ticks: { font: { size: 11 } } }
      },
      onClick: (_evt, elements) => {
        if (!elements.length) return;
        document.getElementById('monthFilter').value = elements[0].index + 1;
        filterData();
        showPage('list');
      }
    }
  });
}
// MOBILE CARDS
// ====================================================
function renderMobileCards() {
  const el = document.getElementById('mobileCardList');
  if (!el) return;
  const start = (currentPage - 1) * pageSize;
  const rows = filteredData.slice(start, start + pageSize);
  window._mobileRows = rows;
  el.innerHTML = rows.map((d, i) => {
    const id = Number(d.id) || 0;
    const days = d.days_left;
    const cancelled = d.calibration_cancelled === true
      || (typeof window.isCalibrationCancelled === 'function' && window.isCalibrationCancelled(d));
    let badgeClass = 'ok';
    let badgeText = 'ปกติ';
    let daysText = days !== null ? 'อีก ' + days + ' วัน' : '-';
    if (cancelled) {
      badgeClass = 'overdue';
      badgeText = 'ยกเลิก';
      daysText = 'ยกเลิกสอบเทียบ';
    } else if (days !== null && days < 0) {
      badgeClass = 'overdue';
      badgeText = 'เกินกำหนด';
      daysText = 'เกิน ' + Math.abs(days) + ' วัน';
    } else if (days !== null && days <= 30) {
      badgeClass = 'warn';
      badgeText = 'ใกล้ครบ';
      daysText = days === 0 ? 'วันนี้' : 'อีก ' + days + ' วัน';
    }
    const calDate = d.cal_date ? new Date(d.cal_date).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}) : '-';
    const dueDate = d.due_date ? new Date(d.due_date).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}) : '-';
    const dueLine = d.due_date && !cancelled ? dueDate + ' (' + daysText + ')' : (cancelled ? daysText : dueDate);
    const displayType = getDisplayInstrumentType(d);
    const typShort = (displayType || d.instrument_type || '-').split(' (')[0];
    const [letter, icon, color] = regTypeMeta(displayType, d);
    const title = escapeHtmlText(d.instrument_name || '-');
    const certNo = escapeHtmlText(d.cert_no || '-');
    const idCode = escapeHtmlText(d.id_code || '-');
    const serialNo = escapeHtmlText(d.serial_no || '-');
    const typeText = escapeHtmlText(typShort);
    const calText = escapeHtmlText(calDate + (d.cal_type ? ' · ' + d.cal_type : ''));
    const dueText = escapeHtmlText(dueLine);
    const idCertLine = [d.id_code, d.cert_no].filter(Boolean).map(escapeHtmlText).join(' · ') || '-';
    const brandDept = [d.brand, d.department].filter(Boolean).map(escapeHtmlText).join(' · ') || '-';
    const machineLoc = [d.machine_name, d.location].filter(Boolean).map(escapeHtmlText).join(' · ') || escapeHtmlText(d.department || '-');
    const ps = planStatusMap[d.id];
    const sMap = {
      pending_plan: ['&#x0E23;&#x0E2D;&#x0E22;&#x0E37;&#x0E19;&#x0E22;&#x0E31;&#x0E19;&#x0E41;&#x0E1C;&#x0E19;', '#854F0B', '#FAEEDA'],
      planned:      ['&#x0E27;&#x0E32;&#x0E07;&#x0E41;&#x0E1C;&#x0E19;&#x0E41;&#x0E25;&#x0E49;&#x0E27;', '#3B6D11', '#EAF3DE'],
      pending_cert: ['&#x0E23;&#x0E2D;&#x0E22;&#x0E37;&#x0E19;&#x0E22;&#x0E31;&#x0E19;&#x0E2A;&#x0E2D;&#x0E1A;', '#185FA5', '#E6F1FB'],
      completed:    ['&#x0E2A;&#x0E2D;&#x0E1A;&#x0E40;&#x0E17;&#x0E35;&#x0E22;&#x0E1A;&#x0E41;&#x0E25;&#x0E49;&#x0E27;', '#0F6E56', '#E1F5EE'],
    };
    const planMeta = cancelled
      ? ['ไม่ต้องวางแผน', '#8A1F1F', '#FCEBEB']
      : (ps ? (sMap[ps.status] || [escapeHtmlText(ps.status), '#52667d', '#f2f6fb']) : ['ยังไม่วางแผน', '#52667d', '#f2f6fb']);
    const planBadge = '<div class="mobile-plan-row"><span class="mobile-plan-badge" style="color:' + planMeta[1] + ';background:' + planMeta[2] + '">' + planMeta[0] + '</span></div>';
    const planBtn = cancelled
      ? '<button class="mobile-card-action" disabled><i class="ti ti-calendar-off"></i><span>งดแผน</span></button>'
      : (ps
        ? '<button class="mobile-card-action primary" onclick="event.stopPropagation();goToPlanDetail(' + id + ')"><i class="ti ti-calendar-check"></i><span>แผน</span></button>'
        : '<button class="mobile-card-action primary" onclick="event.stopPropagation();goToPlanWithItem(' + id + ')"><i class="ti ti-calendar-plus"></i><span>วางแผน</span></button>');
    return '<article class="mobile-card mobile-card--' + badgeClass + '" role="button" tabindex="0" onclick="openInstrumentDetail(' + id + ')">' +
      '<div class="mobile-card-head">' +
        '<span class="mobile-type-mark" style="color:' + color + ';background:' + color + '14;border-color:' + color + '40"><i class="ti ' + icon + '"></i><b>' + escapeHtmlText(letter) + '</b></span>' +
        '<div class="mobile-card-main">' +
          '<div class="mobile-card-title-row">' +
            '<div class="mobile-card-title">' + title + '</div>' +
            '<span class="mobile-badge ' + badgeClass + '">' + escapeHtmlText(badgeText) + '</span>' +
          '</div>' +
          '<div class="mobile-card-sub">' + idCertLine + '</div>' +
          '<div class="mobile-card-kicker">' + typeText + ' · ' + brandDept + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="mobile-card-grid">' +
        '<div class="mobile-field"><span>สอบเทียบ</span><strong>' + calText + '</strong></div>' +
        '<div class="mobile-field"><span>ครบกำหนด</span><strong>' + dueText + '</strong></div>' +
        '<div class="mobile-field"><span>S/N</span><strong>' + serialNo + '</strong></div>' +
        '<div class="mobile-field"><span>จุดใช้งาน</span><strong>' + machineLoc + '</strong></div>' +
      '</div>' +
      planBadge +
      '<div class="mobile-card-actions">' +
        '<button class="mobile-card-action" onclick="event.stopPropagation();openInstrumentDetail(' + id + ')"><i class="ti ti-eye"></i><span>ดู</span></button>' +
        '<button class="mobile-card-action" onclick="event.stopPropagation();mobileCert(' + i + ')"><i class="ti ti-paperclip"></i><span>ไฟล์</span></button>' +
        planBtn +
      '</div>' +
    '</article>';
  }).join('') || '<div class="mobile-empty">&#x0E44;&#x0E21;&#x0E48;&#x0E1E;&#x0E1A;&#x0E02;&#x0E49;&#x0E2D;&#x0E21;&#x0E39;&#x0E25;</div>';
}
function mobileEdit(i) { const d = window._mobileRows?.[i]; if (d) openInstrumentModal(d.id); }
function mobileCert(i) { const d = window._mobileRows?.[i]; if (d) openCertModal(d.id, d.id_code||'', d.cert_no||'', d.instrument_name||''); }

// ====================================================
// DONUT + ALERTS
// ====================================================
let _dashDonut = null;
function renderDonut() {
  const canvas = document.getElementById('dashDonutChart');
  if (!canvas || typeof Chart === 'undefined') return;
  let ov = 0, wa = 0, ok = 0;
  allData.forEach(d => { if (d.days_left === null) return; if (d.days_left < 0) ov++; else if (d.days_left <= 30) wa++; else ok++; });
  const elTotal = document.getElementById('donutTotal');
  if (elTotal) elTotal.textContent = allData.length.toLocaleString();
  if (_dashDonut) _dashDonut.destroy();
  _dashDonut = new Chart(canvas, { type:'doughnut', data:{ labels:['ปกติ','เกินกำหนด','ใกล้ครบ'], datasets:[{ data:[ok,ov,wa], backgroundColor:['#2E7D32','#C62828','#F57F17'], borderWidth:0 }] }, options:{ responsive:true, maintainAspectRatio:false, cutout:'70%', plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: ${ctx.parsed.toLocaleString()} เครื่อง` } } } } });
}
async function renderAlerts() {
  const el = document.getElementById('alertList');
  if (!el) return;
  if (!allData.length) { setTimeout(renderAlerts, 500); return; }

  el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:12px 0">กำลังโหลด...</div>';

  // ดึง instrument_id ที่มีแผน active อยู่แล้ว
  let plannedIds = new Set();
  try {
    const { data: planItems } = await sb
      .from('calibration_plan_items')
      .select('instrument_id, calibration_plans!inner(status)')
      .in('calibration_plans.status', ['pending_plan','planned','pending_cert']);
    if (planItems) planItems.forEach(p => plannedIds.add(p.instrument_id));
  } catch(e) { /* ถ้าดึงไม่ได้ก็แสดงทั้งหมด */ }

  const today = new Date(); today.setHours(0,0,0,0);

  // กรองเครื่องมือที่ยังไม่มีแผนและ due ภายใน 60 วัน
  const alerts = allData.filter(d => {
    if (d.days_left === null) return false;
    if (plannedIds.has(d.id)) return false;
    return d.days_left >= -30 && d.days_left <= 60;
  }).sort((a,b) => a.days_left - b.days_left).slice(0, 12);

  if (!alerts.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:16px 0">✅ เครื่องมือทุกเครื่องมีแผนแล้ว</div>';
    return;
  }

  el.innerHTML = alerts.map(d => {
    const days = d.days_left;
    const due = new Date(d.due_date);
    const planStart = new Date(due.getFullYear(), due.getMonth() - 1, 1);
    const planEnd   = new Date(due.getFullYear(), due.getMonth() - 1, 15);
    let bg, color, icon, label;
    if (days < 0) {
      bg = "var(--red-light)"; color = "var(--red)";
      icon = "🔴"; label = "เกินกำหนด " + Math.abs(days) + " วัน";
    } else if (days <= 15) {
      bg = "#fff3e0"; color = "#E65100";
      icon = "⚠️"; label = "ใกล้ Due " + days + " วัน";
    } else if (today >= planStart && today <= planEnd) {
      bg = "#fff8e1"; color = "var(--amber)";
      icon = "🟡"; label = "ถึงเวลาวางแผน! (" + days + " วัน)";
    } else if (today > planEnd && days <= 45) {
      bg = "var(--red-light)"; color = "var(--red)";
      icon = "🔴"; label = "วางแผนช้าแล้ว! (" + days + " วัน)";
    } else {
      bg = "var(--accent-light)"; color = "var(--accent)";
      icon = "📋"; label = "เตรียมวางแผน (" + days + " วัน)";
    }
    const dueStr = due.toLocaleDateString("th-TH", {day:"numeric", month:"short", year:"numeric"});
    return "<div style='background:" + bg + ";border-radius:8px;padding:7px 10px;margin-bottom:4px'>" +
      "<div style='display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:2px'>" +
      "<div style='font-size:12px;font-weight:600;color:" + color + ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1'>"+icon+" "+(d.instrument_name||"–")+"</div>" +
      "<button onclick='goToPlanWithItem(" + d.id + ")' style='font-size:10px;background:" + color + ";color:white;border:none;border-radius:6px;padding:2px 8px;cursor:pointer;white-space:nowrap;font-family:var(--font);font-weight:600'>วางแผน →</button>" +
      "</div>" +
      "<div style='display:flex;align-items:center;justify-content:space-between;gap:6px'>" +
      "<div style='font-size:10px;color:var(--text3)'>"+( d.id_code||"–")+" · "+(d.department||"–")+" · Due: "+dueStr+"</div>" +
      "<span style='font-size:10px;color:" + color + ";font-weight:600'>"+label+"</span>" +
      "</div></div>";
  }).filter(Boolean).join("");
}

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

// ===== กล่องเตือน Dashboard: งานสอบเทียบค้างดำเนินการ (issued ที่ยังไม่สมบูรณ์) =====
async function renderPendingCertWidget() {
  const el = document.getElementById('pendingCertWidget'); if (!el) return;
  let recs = [];
  try {
    const { data, error } = await sb.from('calibration_records')
      .select('id,cert_no,cal_date,instrument_id,calibrated_by')
      .eq('status', 'issued').order('cal_date', { ascending: true });
    if (error) throw error;
    recs = data || [];
  } catch (e) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const navBadge = document.getElementById('navCalrecsBadge');
  if (navBadge) { navBadge.textContent = recs.length; navBadge.style.display = recs.length ? 'inline-block' : 'none'; }
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  const fmt = s => s ? new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '–';
  if (!recs.length) {
    el.innerHTML = `<div class="dsh-pending dsh-pending--ok"><div class="dsh-pending-n"><i class="ti ti-check"></i></div><div><b>ไม่มีงานสอบเทียบค้างดำเนินการ</b><div class="dsh-pending-sub">ทุกใบแนบสแกน / สมบูรณ์แล้วเรียบร้อย</div></div></div>`;
    return;
  }
  const rows = recs.map(r => {
    const inst = (allData || []).find(x => x.id === r.instrument_id) || {};
    const name = escapeHtmlText(inst.instrument_name || '–');
    const idc = escapeHtmlText(inst.id_code || '–');
    const certNo = escapeHtmlText(r.cert_no || '–');
    const nameCell = inst.id != null
      ? `<a onclick="openCalHistory(${inst.id})" class="dsh-plink">${name}</a>`
      : `<strong>${name}</strong>`;
    const scanBtn = canEdit ? `<button onclick="calRecComplete('${r.id}')" class="dsh-btn-dark">📎 แนบสแกน → สมบูรณ์</button>` : '';
    const viewBtn = `<button onclick="openRecReview('${r.id}')" class="dsh-btn-ghost">ดูรายละเอียด</button>`;
    return `<tr>
      <td class="dsh-mono">${certNo}</td>
      <td>${nameCell} <span class="dsh-sub">${idc}</span></td>
      <td style="white-space:nowrap">${fmt(r.cal_date)}</td>
      <td>${escapeHtmlText(r.calibrated_by || '–')}</td>
      <td style="text-align:right;white-space:nowrap"><span style="display:inline-flex;gap:6px">${scanBtn}${viewBtn}</span></td>
    </tr>`;
  }).join('');
  el.innerHTML = `<div class="dsh-card" style="padding:0;overflow:hidden">
    <div class="dsh-pending">
      <div class="dsh-pending-n">${recs.length}</div>
      <div><b>งานสอบเทียบค้างดำเนินการ</b><div class="dsh-pending-sub">ออกเลขแล้ว — รอแนบสแกน / อนุมัติ</div></div>
    </div>
    <div style="overflow-x:auto;padding:2px 18px 14px">
      <table class="dsh-ptable">
        <thead><tr><th>Cert No.</th><th>เครื่องมือ / ID</th><th>วันสอบ</th><th>ผู้สอบ</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
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

// ====================================================
let allData = [], filteredData = [];
let fileCountCache = {};

function escapeHtmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtmlAttr(value) {
  return escapeHtmlText(value).replace(/`/g, '&#96;');
}

function escapeJsSingle(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/</g, '\\x3C')
    .replace(/>/g, '\\x3E')
    .replace(/&/g, '\\x26')
    .replace(/"/g, '&quot;');
}

function getInstrumentCachePrefix() {
  const userKey = currentUser?.id || currentUser?.username || 'anonymous';
  const roleKey = currentUser?.role || 'unknown';
  return 'ilc_instruments_cache_' + roleKey + '_' + userKey;
}

// ===== List หน่วยงาน (Unit) — ตาราง departments: รหัส → ชื่อเต็ม + แผนก =====
window.DEPT_INFO = window.DEPT_INFO || {};
function deptUnitName(code) { return (window.DEPT_INFO[code] && window.DEPT_INFO[code].unit_name) || ''; }
function deptSectionName(code) { return (window.DEPT_INFO[code] && window.DEPT_INFO[code].section_name) || ''; }
async function loadDeptInfo() {
  try { window.DEPT_INFO = JSON.parse(localStorage.getItem('ilc_dept_info') || '{}') || {}; } catch (e) {}
  try {
    const { data, error } = await sb.from('departments').select('code,unit_name,section_name');
    if (error || !data || !data.length) return;
    const map = {};
    data.forEach(d => { map[d.code] = { unit_name: d.unit_name || '', section_name: d.section_name || '' }; });
    window.DEPT_INFO = map;
    try { localStorage.setItem('ilc_dept_info', JSON.stringify(map)); } catch (e) {}
    if (Array.isArray(allData) && allData.length) populateFilters();
  } catch (e) { /* ตารางยังไม่มี/ออฟไลน์ → ใช้รหัสอย่างเดียว */ }
}

async function loadData(forceRefresh = false) {
  loadDeptInfo(); // โหลดชื่อหน่วยงานคู่ขนาน — เสร็จแล้วค่อย refresh ตัวกรองเอง
  const cachePrefix = getInstrumentCachePrefix();
  const CACHE_KEY = cachePrefix + '_rows';
  const CACHE_TIME_KEY = cachePrefix + '_time';
  const CACHE_TTL = 5 * 60 * 1000; // 5 นาที

  const procesData = (rows) => {
    const today = new Date(); today.setHours(0,0,0,0);
    allData = rows.map(d => ({
      ...d,
      days_left: d.due_date ? Math.round((new Date(d.due_date) - today) / 86400000) : null
    }));
    filteredData = [...allData];
    populateFilters();
    fileCountCache = {};
    updateStats();
    renderTable();
    renderMonthly();
    renderCategoryCards();
    renderDonut();
    renderMonthlyBarChart();
    renderDashboardAuditLog();
    renderPendingCertWidget();
    loadPlanStatusMap();
    updateNotificationBell();
    const certEl = document.getElementById("pageCert"); if (certEl && certEl.style.display !== "none" && certEl.offsetParent !== null) loadCertPage();
  };

  // โหลดจาก cache ก่อนถ้ายังไม่หมดอายุ
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const cachedTime = parseInt(localStorage.getItem(CACHE_TIME_KEY) || '0');
    const age = Date.now() - cachedTime;
    if (!forceRefresh && cached && age < CACHE_TTL) {
      procesData(JSON.parse(cached));
      hideLoading();
      setDriveStatus(true, 'แคช ' + Math.round(age/1000) + 'วินาทีที่แล้ว');
      // refresh ใน background เงียบๆ
      fetchFromSupabase().then(rows => {
        if (rows) {
          localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
          localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
          procesData(rows);
          setDriveStatus(true, 'อัพเดท ' + new Date().toLocaleTimeString('th-TH'));
        }
      });
      return;
    }
  } catch(e) { /* cache miss */ }

  // ไม่มี cache หรือหมดอายุ → โหลดจาก Supabase ปกติ
  showLoading('กำลังโหลดข้อมูล...');
  try {
    const rows = await fetchFromSupabase();
    if (!rows) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
      localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch(e) { /* storage full */ }
    procesData(rows);
    setDriveStatus(true, 'อัพเดท ' + new Date().toLocaleTimeString('th-TH'));
  } catch(e) {
    setDriveStatus(false, 'โหลดไม่สำเร็จ');
    showToast('โหลดข้อมูลไม่สำเร็จ: ' + e.message, 'error');
  } finally { hideLoading(); }
}

async function fetchFromSupabase() {
  try {
    const COLS_BASE = 'id,instrument_type,machine_name,location,instrument_name,brand,model,range_val,capacity,resolution,accuracy_class,tolerance,serial_no,asset_no,department,id_code,cert_no,cal_date,due_date,cal_frequency,cal_type,remark,range_profile,issued_by,responsible_by,request_no,job_no,approved_by,approved_at,resolution_text,usage_min,usage_max,usage_frequency,product_group,usp_type,division,balance_type,capacity_unit';
    // tolerance_bands = คอลัมน์เสริม · ตรวจครั้งเดียวต่อ session — ถ้ายังไม่มีใน DB ให้ fallback (แอปไม่พัง) แล้วเปิดใช้เองเมื่อเพิ่มคอลัมน์
    if (window.HAS_TOL_BANDS === undefined) {
      try { const probe = await sb.from('instruments').select('tolerance_bands').limit(1); window.HAS_TOL_BANDS = !probe.error; }
      catch (e) { window.HAS_TOL_BANDS = false; }
    }
    const COLS = window.HAS_TOL_BANDS ? (COLS_BASE + ',tolerance_bands') : COLS_BASE;
    const chunkSize = 500;
    const isFiltered = currentUser?.role !== 'admin' && currentUser?.instrument_types?.length > 0;
    const allowedTypes = isFiltered ? expandInstrumentTypeFilter(currentUser.instrument_types) : [];

    // ดึง count
    let countQ = sb.from('instruments').select('id', { count: 'exact', head: true });
    if (isFiltered) countQ = countQ.in('instrument_type', allowedTypes);
    const { count, error: cErr } = await countQ;
    if (cErr) throw cErr;

    const total = count || 0;
    const chunks = [];
    for (let from = 0; from < total; from += chunkSize) {
      chunks.push([from, Math.min(from + chunkSize - 1, total - 1)]);
    }

    // parallel fetch
    const fetches = chunks.map(([from, to]) => {
      let q = sb.from('instruments').select(COLS).order('id').range(from, to);
      if (isFiltered) q = q.in('instrument_type', allowedTypes);
      return q;
    });
    const results = await Promise.all(fetches);

    let allRows = [];
    for (const { data, error } of results) {
      if (error) throw error;
      if (data) allRows = allRows.concat(data);
    }
    return allRows;
  } catch(e) {
    showToast('โหลดข้อมูลไม่สำเร็จ: ' + e.message, 'error');
    return null;
  }
}

// ====================================================
// DASHBOARD
// ====================================================
function populateFilters() {
  const types = [...new Set(allData.map(d => getDisplayInstrumentType(d)))].filter(Boolean).sort();
  const units = [...new Set(allData.map(d => d.department))].filter(Boolean).sort();
  // ป้ายตัวกรอง: "รหัส — ชื่อหน่วยงาน" (ชื่อจาก list departments ถ้ามี)
  const unitLabel = (u) => {
    const name = typeof deptUnitName === 'function' ? deptUnitName(u) : '';
    return name ? `${u} — ${name.length > 42 ? name.slice(0, 40) + '…' : name}` : u;
  };
  document.getElementById('typeFilter').innerHTML = '<option value="">ทุกประเภท</option>' + types.map(t => `<option value="${escapeHtmlAttr(t)}">${escapeHtmlText(t)}</option>`).join('');
  document.getElementById('unitFilter').innerHTML = '<option value="">ทุกหน่วยงาน</option>' + units.map(u => `<option value="${escapeHtmlAttr(u)}">${escapeHtmlText(unitLabel(u))}</option>`).join('');
  // datalist ช่องหน่วยงานในฟอร์มเครื่องมือ — รวมรหัสจาก list departments กับที่มีอยู่ในข้อมูล
  const dl = document.getElementById('deptCodeList');
  if (dl) {
    const codes = [...new Set([...Object.keys(window.DEPT_INFO || {}), ...units])].sort();
    dl.innerHTML = codes.map(c => `<option value="${escapeHtmlAttr(c)}" label="${escapeHtmlAttr(deptUnitName(c))}"></option>`).join('');
  }
  renderListCategoryPills();
}

// ===== Instrument registry redesign helpers =====
const REG_TYPE_META = {
  'เครื่องชั่ง (Balance)':                    ['B', 'ti-scale', '#00897b'],
  'Balance':                                  ['B', 'ti-scale', '#00897b'],
  'Electronic Balance':                       ['B', 'ti-scale', '#00897b'],
  'ตุ้มน้ำหนักมาตรฐาน (Mass)':                 ['M', 'ti-weight', '#639922'],
  'มวล/น้ำหนัก (Mass/Weight)':                ['B', 'ti-scale', '#00897b'],
  'อุณหภูมิ/ความชื้น (Temperature/Humidity)':  ['T', 'ti-temperature', '#d85a30'],
  'ความยาว/มิติ (Length/Dimension)':           ['D', 'ti-ruler-measure', '#185fa5'],
  'ความดัน/สุญญากาศ (Pressure/Vacuum)':        ['P', 'ti-gauge', '#534ab7'],
  'การไหล/ปริมาตร (Flow/Volume)':              ['Q', 'ti-wave-sine', '#993556'],
  'ความเร็วรอบ (Speed/Rotation)':              ['S', 'ti-rotate-clockwise-2', '#0f6e56'],
  'เวลา (Time)':                               ['C', 'ti-clock', '#565f6a'],
  'เคมี/ความเข้มข้น (Chemical/Concentration)': ['K', 'ti-flask', '#639922'],
  'ความหนืด/ความหนาแน่น (Viscosity/Density)':  ['V', 'ti-droplet', '#2563eb'],
  'ไฟฟ้า (Electrical)':                        ['E', 'ti-bolt', '#ba7517'],
  'แสง/เสียง (Light/Sound)':                   ['L', 'ti-bulb', '#c2410c'],
  'ความปลอดภัย (Safety)':                      ['F', 'ti-shield-check', '#dc3545'],
  'แรงบิด/แรงกด (Torque/Force)':               ['N', 'ti-tool', '#7c3aed'],
};

const BALANCE_DISPLAY_TYPE = 'เครื่องชั่ง (Balance)';
const BALANCE_TYPE_ALIASES = [
  BALANCE_DISPLAY_TYPE,
  'เครื่องชั่ง',
  'Balance',
  'balance',
  'Electronic Balance',
  'electronic balance',
  'Analytical Balance',
  'analytical balance',
  'Precision Balance',
  'precision balance',
  'Electronic Scale',
  'electronic scale',
  'Weighing Scale',
  'weighing scale',
  'Weighing Machine',
  'weighing machine',
  'Scale',
  'scale',
];

function normalizeInstrumentTypeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, '')
    .trim();
}

function isBalanceInstrumentType(value) {
  const key = normalizeInstrumentTypeKey(value);
  if (!key) return false;
  if (['เครื่องชั่ง balance', 'เครื่องชั่ง', 'balance', 'electronic balance', 'analytical balance', 'precision balance', 'electronic scale', 'weighing scale', 'weighing machine', 'scale'].includes(key)) return true;
  return /\bbalance\b|electronic\s*scale|weighing\s*scale|weighing\s*machine|เครื่องชั่ง/i.test(key);
}

function isMassInstrumentType(value) {
  const key = normalizeInstrumentTypeKey(value);
  if (!key) return false;
  return /\bmass\b|\bweight\s*set\b|\bweights\b|standard\s*weight|reference\s*weight|ตุ้มน้ำหนัก|มวลมาตรฐาน|ลูกตุ้ม/i.test(key);
}

function inferBalanceMassDisplayType(row) {
  const text = [row?.instrument_name, row?.brand].filter(Boolean).join(' ');
  if (isBalanceInstrumentType(text) && !isMassInstrumentType(text)) return BALANCE_DISPLAY_TYPE;
  if (isMassInstrumentType(text)) return 'ตุ้มน้ำหนักมาตรฐาน (Mass)';
  return '';
}

function expandInstrumentTypeFilter(types) {
  const source = Array.isArray(types) ? types.filter(Boolean) : [];
  const expanded = new Set(source);
  if (source.some(isBalanceInstrumentType)) {
    BALANCE_TYPE_ALIASES.forEach(type => expanded.add(type));
  }
  return [...expanded];
}

function getDisplayInstrumentType(row) {
  const rawType = String(row?.instrument_type || '').trim();
  const rawKey = rawType.toLowerCase().replace(/\s+/g, ' ');
  const inferredBalanceMass = inferBalanceMassDisplayType(row);
  if (inferredBalanceMass === BALANCE_DISPLAY_TYPE) return BALANCE_DISPLAY_TYPE;
  if (isBalanceInstrumentType(rawType)) return BALANCE_DISPLAY_TYPE;
  if (rawKey === 'มวล/น้ำหนัก' || rawKey === 'มวล/น้ำหนัก (mass/weight)' || rawKey === 'mass/weight') {
    if (inferredBalanceMass) return inferredBalanceMass;
    const code = typeof getCertTypeCode === 'function' ? getCertTypeCode(rawType, row?.instrument_name || '') : '';
    return code === 'M' ? 'ตุ้มน้ำหนักมาตรฐาน (Mass)' : 'เครื่องชั่ง (Balance)';
  }
  return rawType;
}

function regTypeMeta(type, row) {
  const displayType = row ? getDisplayInstrumentType(row) : type;
  return REG_TYPE_META[displayType] || REG_TYPE_META[type] || ['-', 'ti-tool', '#52667d'];
}

function renderListCategoryPills() {
  const strip = document.getElementById('listCategoryStrip');
  if (!strip) return;
  const totals = {};
  allData.forEach(d => {
    const type = getDisplayInstrumentType(d);
    if (type) totals[type] = (totals[type] || 0) + 1;
  });
  const current = document.getElementById('typeFilter')?.value || '';
  const allPill = `<button class="reg-pill ${current ? '' : 'active'}" onclick="setListCategory('')">
    <span>ทั้งหมด</span><strong>${allData.length.toLocaleString()}</strong>
  </button>`;
  const typePills = Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
    const [letter] = regTypeMeta(type);
    const label = type.split(' (')[0];
    return `<button class="reg-pill ${current === type ? 'active' : ''}" onclick="setListCategory('${escapeJsSingle(type)}')">
      <span>${escapeHtmlText(letter)} ${escapeHtmlText(label)}</span><strong>${count.toLocaleString()}</strong>
    </button>`;
  }).join('');
  strip.innerHTML = allPill + typePills;
}

function setListCategory(type) {
  const sel = document.getElementById('typeFilter');
  if (sel) sel.value = type;
  filterData();
}

function updateStats() {
  let ov = 0, wa = 0, ok = 0;
  const dashboardRows = allData || [];
  dashboardRows.forEach(d => {
    if (d.days_left === null) return;
    if (d.days_left < 0) ov++;
    else if (d.days_left <= 30) wa++;
    else ok++;
  });
  const total = dashboardRows.length;
  const okCount = ok;

  document.getElementById('statTotal').textContent = total.toLocaleString();
  document.getElementById('statOk').textContent = okCount.toLocaleString();
  document.getElementById('statOverdue').textContent = ov.toLocaleString();
  document.getElementById('statWarning').textContent = wa.toLocaleString();

  // summary box
  const el2Ok = document.getElementById('statOk2');
  const el2Ov = document.getElementById('statOverdue2');
  const el2Wa = document.getElementById('statWarning2');
  if (el2Ok) el2Ok.textContent = okCount.toLocaleString();
  if (el2Ov) el2Ov.textContent = ov.toLocaleString();
  if (el2Wa) el2Wa.textContent = wa.toLocaleString();

  // Progress bars (ใช้ allData เสมอ เพราะเป็นภาพรวมทั้งหมด)
  const internal = allData.filter(d => d.cal_type === 'ภายใน');
  const external = allData.filter(d => d.cal_type === 'ภายนอก');
  const inOk = internal.filter(d => d.days_left !== null && d.days_left >= 0).length;
  const exOk = external.filter(d => d.days_left !== null && d.days_left >= 0).length;
  const inPct = internal.length ? Math.round(inOk/internal.length*100) : 0;
  const exPct = external.length ? Math.round(exOk/external.length*100) : 0;
  const pIn = document.getElementById('dashPctIn');
  const pOut = document.getElementById('dashPctOut');
  const bIn = document.getElementById('dashBarIn');
  const bOut = document.getElementById('dashBarOut');
  if (pIn) pIn.textContent = inPct + '%';
  if (pOut) pOut.textContent = exPct + '%';
  if (bIn) bIn.style.width = inPct + '%';
  if (bOut) bOut.style.width = exPct + '%';
  const heroDate = document.getElementById('dashHeroDate');
  if (heroDate) {
    const now = new Date();
    heroDate.textContent = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      + ' · อัปเดตล่าสุด ' + now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
  }
  renderDashMiniList();
}

function renderDashMiniList() {
  const el = document.getElementById('dashMiniList');
  if (!el) return;
  const items = (allData || [])
    .filter(d => d.days_left !== null && d.days_left <= 30)
    .sort((a, b) => a.days_left - b.days_left)
    .slice(0, 8);
  if (!items.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--text3);text-align:center;padding:16px 0">✅ ไม่มีเครื่องมือที่เกินกำหนดหรือใกล้ครบ</div>';
    return;
  }
  el.innerHTML = items.map(d => {
    const over = d.days_left < 0;
    const dot = over ? '🔴' : '🟡';
    const color = over ? 'var(--red)' : 'var(--amber)';
    const status = over ? `เกิน ${Math.abs(d.days_left)} วัน` : `อีก ${d.days_left} วัน`;
    return `<div onclick="filterByStatus('${over ? 'overdue' : 'warning'}')" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid var(--border);cursor:pointer">
      <div style="font-size:13px;color:var(--text)">${dot} ${escapeHtmlText(d.id_code || '-')} ${escapeHtmlText(d.instrument_name || d.instrument_type || '')}</div>
      <div style="font-size:12px;color:${color};white-space:nowrap">${status}</div>
    </div>`;
  }).join('');
}

function formatDashboardAuditTime(value) {
  if (!value) return '–';
  const date = new Date(value);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'เมื่อสักครู่';
  if (diffMin < 60) return diffMin + ' นาทีที่แล้ว';
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return diffHour + ' ชม.ที่แล้ว';
  return date.toLocaleDateString('th-TH', { day:'2-digit', month:'short', year:'numeric' });
}

function getDashboardAuditStyle(action) {
  const text = String(action || '');
  if (text.includes('ลบ')) return { icon:'🗑️', color:'#C62828', bg:'#FCEBEB' };
  if (text.includes('เพิ่ม') || text.includes('สร้าง')) return { icon:'➕', color:'#2E7D32', bg:'#E8F5E9' };
  if (text.includes('แก้ไข') || text.includes('อัพเดท')) return { icon:'✏️', color:'#F57F17', bg:'#FFF8E1' };
  if (text.includes('อัพโหลด') || text.includes('แนบ')) return { icon:'📎', color:'#00695C', bg:'#E0F4F1' };
  if (text.includes('แผน') || text.includes('สอบ')) return { icon:'📅', color:'#5B21B6', bg:'#F3F0FF' };
  return { icon:'•', color:'var(--text2)', bg:'var(--surface2)' };
}

function renderDashboardAuditItems(items) {
  const el = document.getElementById('dashboardAuditList');
  if (!el) return;
  if (!items.length) {
    el.innerHTML = '<div class="dsh-empty">ยังไม่มีกิจกรรมล่าสุด</div>';
    return;
  }

  el.innerHTML = items.slice(0, 10).map(item => {
    const style = getDashboardAuditStyle(item.action);
    const title = item.instrument_name || item.id_code || item.title || item.note || '–';
    const meta = [
      item.id_code,
      item.username || item.created_by,
      formatDashboardAuditTime(item.created_at)
    ].filter(Boolean).join(' · ');
    return `<div class="dsh-aitem">
      <div class="dsh-aic" style="background:${style.bg};color:${style.color}">${style.icon}</div>
      <div style="min-width:0;flex:1">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div class="dsh-atitle">${escapeHtmlText(item.action || 'กิจกรรม')}</div>
          <div class="dsh-atime">${formatDashboardAuditTime(item.created_at)}</div>
        </div>
        <div class="dsh-aline">${escapeHtmlText(title)}</div>
        <div class="dsh-ameta">${escapeHtmlText(meta || '–')}</div>
      </div>
    </div>`;
  }).join('');
}

async function renderDashboardAuditLog() {
  const el = document.getElementById('dashboardAuditList');
  if (!el || typeof sb === 'undefined') return;
  el.innerHTML = '<div class="dsh-empty">กำลังโหลดกิจกรรม...</div>';

  try {
    const [auditRes, planRes] = await Promise.all([
      sb.from('audit_logs').select('created_at,username,action,id_code,instrument_name,changes').order('created_at', { ascending:false }).limit(12),
      sb.from('plan_audit_log').select('created_at,username,action,note').order('created_at', { ascending:false }).limit(8)
    ]);
    if (auditRes.error) throw auditRes.error;

    const auditItems = (auditRes.data || []).map(row => ({ ...row, source:'instrument' }));
    const planItems = planRes.error ? [] : (planRes.data || []).map(row => ({
      ...row,
      source:'plan',
      instrument_name: row.note || 'แผนสอบเทียบ'
    }));
    const items = auditItems.concat(planItems).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    renderDashboardAuditItems(items);
  } catch(e) {
    el.innerHTML = '<div class="dsh-empty">โหลด Audit log ไม่สำเร็จ</div>';
  }
}

function filterData() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const type = document.getElementById('typeFilter').value;
  const unit = document.getElementById('unitFilter').value;
  const status = document.getElementById('statusFilter').value;
  const month = document.getElementById('monthFilter').value;

  filteredData = allData.filter(d => {
    const displayType = getDisplayInstrumentType(d);
    if (search && !['instrument_type','instrument_name','brand','id_code','cert_no','serial_no','department','machine_name','location'].some(k => String(d[k]||'').toLowerCase().includes(search)) && !String(displayType || '').toLowerCase().includes(search)) return false;
    if (type && displayType !== type) return false;
    if (unit && d.department !== unit) return false;
    // กรองตาม activeCategory (การ์ดประเภทเครื่องมือ)
    if (activeCategory && activeCategory !== 'all') {
      const category = typeof getInstrumentCategory === 'function' ? getInstrumentCategory(d) : d.instrument_type;
      if (category !== activeCategory) return false;
    }
    if (status && d.days_left === null) return false;
    if (status) {
      if (status === 'overdue' && d.days_left >= 0) return false;
      if (status === 'warning' && (d.days_left < 0 || d.days_left > 30)) return false;
      if (status === 'ok' && d.days_left <= 30) return false;
    }
    if (month && !d.due_date) return false;
    if (month) {
      const m = new Date(d.due_date).getMonth() + 1;
      if (String(m) !== month) return false;
    }
    return true;
  });
  currentPage = 1;
  updateStats(); renderTable(); renderListCategoryPills();
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('typeFilter').value = '';
  document.getElementById('unitFilter').value = '';
  document.getElementById('statusFilter').value = '';
  document.getElementById('monthFilter').value = '';

  activeCategory = 'all';
  renderCategoryCards();
  if (activeMonthCard) { activeMonthCard.style.boxShadow=''; activeMonthCard.style.transform=''; activeMonthCard=null; }
  filteredData = [...allData];
  currentPage = 1;
  updateStats(); renderTable(); renderListCategoryPills();
}

function formatDate(s) {
  if (!s) return '–';
  return new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function renderTable() {
  const tbody = document.getElementById('dataTable');
  if (!filteredData.length) {
    tbody.innerHTML = '<tr><td colspan="11" class="no-data">ไม่พบข้อมูล</td></tr>';
    updatePaginationUI();
    renderMobileCards();
    return;
  }
  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * pageSize;
  const pageData = filteredData.slice(start, start + pageSize);
  updatePaginationUI();
  tbody.innerHTML = pageData.map((d, i) => {
    const rowNum = start + i + 1;
    const id = Number(d.id) || 0;
    const days = d.days_left;
    const idCode = escapeHtmlText(d.id_code || '–');
    const certNo = escapeHtmlText(d.cert_no || '–');
    const instrumentName = escapeHtmlText(d.instrument_name || '–');
    const planTitle = escapeHtmlAttr(planStatusMap[d.id]?.title || '');
    const openCertCall = `openCertModal(${id},'${escapeJsSingle(d.id_code)}','${escapeJsSingle(d.cert_no)}','${escapeJsSingle(d.instrument_name)}')`;
    const displayType = getDisplayInstrumentType(d);
    const [letter, icon, color] = regTypeMeta(displayType, d);
    const machineLoc = [d.machine_name, d.location].filter(Boolean).map(escapeHtmlText).join(' · ') || '–';
    const cancelled = d.calibration_cancelled === true
      || (typeof window.isCalibrationCancelled === 'function' && window.isCalibrationCancelled(d));
    let statusBadge, daysColor, daysText;
    if (cancelled) { statusBadge = '<span class="badge badge-red">ยกเลิกสอบเทียบ</span>'; daysColor = 'var(--red)'; daysText = 'ยกเลิกสอบเทียบ'; }
    else if (days === null) { statusBadge = '<span class="badge badge-gray">–</span>'; daysColor = 'var(--text3)'; daysText = '–'; }
    else if (days < 0) { statusBadge = '<span class="badge badge-red">🔴 เลยกำหนด</span>'; daysColor = 'var(--red)'; daysText = 'เกิน ' + Math.abs(days) + ' วัน'; }
    else if (days <= 30) { statusBadge = '<span class="badge badge-amber">🟡 ใกล้ครบ</span>'; daysColor = 'var(--amber)'; daysText = days === 0 ? 'วันนี้' : 'อีก ' + days + ' วัน'; }
    else { statusBadge = '<span class="badge badge-green">🟢 ปกติ</span>'; daysColor = 'var(--green)'; daysText = 'อีก ' + days + ' วัน'; }
    return `<tr class="${cancelled ? 'reg-cancelled' : ''}" onclick="if(!event.target.closest('button'))openInstrumentDetail(${id})" style="cursor:pointer" title="คลิกเพื่อดูรายละเอียด">
      <td>${rowNum}</td>
      <td><div class="reg-cell"><span class="reg-iconbox" style="color:${color};background:${color}14;border-color:${color}40"><i class="ti ${icon}"></i></span><div><div class="reg-name">${instrumentName}</div><div class="reg-sub">${escapeHtmlText(d.brand || '–')}</div></div></div></td>
      <td><div class="reg-stack"><strong>${idCode}</strong><span>${certNo}</span></div></td>
      <td><span class="reg-chip" style="background:${color}" title="${escapeHtmlAttr(displayType || d.instrument_type || '–')}">${escapeHtmlText(letter)}</span></td>
      <td><strong>${escapeHtmlText(d.department || '–')}</strong><br><span class="reg-sub">${machineLoc}</span></td>
      <td>${formatDate(d.cal_date)}<br><span class="reg-sub">${escapeHtmlText(d.cal_type || '–')}</span></td>
      <td><strong>${cancelled ? '–' : formatDate(d.due_date)}</strong><br><span class="reg-sub" style="color:${daysColor}">${daysText}</span></td>
      <td>${statusBadge}</td>
      <td>${(()=>{
        if (cancelled) return '<span class="badge badge-gray">ไม่ต้องวางแผน</span>';
        const ps = planStatusMap[d.id];
        if (!ps) return `<button onclick="goToPlanWithItem(${id})" style="font-size:11px;background:var(--accent-light);color:var(--accent);border:1px solid var(--accent);border-radius:6px;padding:2px 8px;cursor:pointer;white-space:nowrap;font-family:var(--font)">📋 วางแผน</button>`;
        const sMap = {
          pending_plan: ['🟡 รอยืนยันแผน','#854F0B','#FAEEDA'],
          planned:      ['✅ วางแผนแล้ว','#3B6D11','#EAF3DE'],
          pending_cert: ['🔵 รอยืนยันสอบ','#185FA5','#E6F1FB'],
          completed:    ['🏆 สอบเทียบแล้ว','#0F6E56','#E1F5EE'],
        };
        const [lbl,color2,bg] = sMap[ps.status] || ['–','#888','#f5f5f5'];
        return `<button onclick="goToPlanDetail(${id})" title="ดูแผน: ${planTitle}" style="font-size:11px;background:${bg};color:${color2};border:1px solid ${color2}40;border-radius:6px;padding:2px 8px;white-space:nowrap;cursor:pointer;font-family:var(--font);font-weight:500">${lbl}</button>`;
      })()}</td>
      <td><button id="certbtn-${id}" class="btn-cert ${fileCountCache[d.id]>0?'btn-cert-has':'btn-cert-empty'}" onclick="${openCertCall}" >📎 ${fileCountCache[d.id]>0?fileCountCache[d.id]+' ไฟล์':'ไฟล์'}</button></td>
      <td style="white-space:nowrap" class="td-manage"></td>
    </tr>`;
  }).join('');

  // ใส่ปุ่มจัดการถ้าเป็น Admin/Editor
  if (currentUser?.role === 'admin' || currentUser?.role === 'editor') {
    const start = (currentPage - 1) * pageSize;
    document.querySelectorAll('.td-manage').forEach((td, i) => {
      const d = filteredData[start + i];
      if (!d) return;
      const name = escapeJsSingle(d.instrument_name || '');
      const id = Number(d.id) || 0;
      td.innerHTML = `<button class="btn-del" onclick="deleteInstrument(${id},'${name}')">🗑️</button>`;
    });
  }
  updateFileCounts(pageData);
  renderMobileCards();
}

async function updateFileCounts(pageItems) {
  for (const d of pageItems) {
    if (fileCountCache[d.id] !== undefined) continue;
    try {
      const folder = 'cert_' + d.id + '_' + (d.id_code||'');
      const { data } = await sb.storage.from('certificates').list(folder);
      const cnt = (data || []).filter(f => f.name !== '.emptyFolderPlaceholder').length;
      fileCountCache[d.id] = cnt;
      const btn = document.getElementById('certbtn-' + d.id);
      if (btn) {
        btn.className = cnt > 0 ? 'btn-cert btn-cert-has' : 'btn-cert btn-cert-empty';
        btn.innerHTML = cnt > 0 ? '📎 ' + cnt + ' ไฟล์' : '📎 ไฟล์';
      }
    } catch(e) {}
  }
}

// ====================================================
