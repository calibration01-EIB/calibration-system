/* ===== 02-dashboard.js ===== (generated from index.html inline app script) */
// MOBILE CARDS
// ====================================================
function renderMobileCards() {
  const el = document.getElementById('mobileCardList');
  if (!el) return;
  const start = (currentPage - 1) * pageSize;
  const rows = filteredData.slice(start, start + pageSize);
  window._mobileRows = rows;
  el.innerHTML = rows.map((d, i) => {
    const days = d.days_left;
    let badge = '', rowBg = '', daysText = '';
    if (days !== null && days < 0) {
      badge = `<span style="background:#fdecea;color:#C62828;font-size:11px;padding:2px 8px;border-radius:20px">เกินกำหนด</span>`;
      daysText = `<span style="font-size:11px;color:#C62828">${days} วัน</span>`;
      rowBg = '#1a0000';
    } else if (days !== null && days <= 30) {
      badge = `<span style="background:#fff8e1;color:#F57F17;font-size:11px;padding:2px 8px;border-radius:20px">ใกล้ครบ</span>`;
      daysText = `<span style="font-size:11px;color:#F57F17">${days} วัน</span>`;
      rowBg = '#1a1400';
    } else {
      badge = `<span style="background:#e8f5e9;color:#2E7D32;font-size:11px;padding:2px 8px;border-radius:20px">ปกติ</span>`;
      daysText = `<span style="font-size:11px;color:#2E7D32">${days !== null ? days + ' วัน' : '–'}</span>`;
      rowBg = '#1E1E1E';
    }
    const dueDate = d.due_date ? new Date(d.due_date).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}) : '–';
    const typShort = (d.instrument_type||'–').split(' (')[0];

    // สถานะวางแผน
    const ps = planStatusMap[d.id];
    const sMap = {
      pending_plan: ['🟡 รอยืนยันแผน','#854F0B','#2A2000'],
      planned:      ['✅ วางแผนแล้ว','#3B6D11','#0A1A0A'],
      pending_cert: ['🔵 รอยืนยันสอบ','#185FA5','#001020'],
      completed:    ['🏆 สอบเทียบแล้ว','#0F6E56','#001A14'],
    };
    const planBadge = ps
      ? `<span style="font-size:10px;color:${(sMap[ps.status]||['','#888'])[1]};background:${(sMap[ps.status]||['','','#333'])[2]};border-radius:4px;padding:2px 7px;font-weight:500">${(sMap[ps.status]||[ps.status])[0]}</span>`
      : `<span style="font-size:10px;color:#888;background:#222;border-radius:4px;padding:2px 7px">📋 ยังไม่วางแผน</span>`;
    const planBtn = ps
      ? `<button onclick="goToPlanDetail(${d.id})" style="flex:1;padding:8px;background:#001A14;border:1px solid #0F6E56;border-radius:8px;font-size:12px;color:#34D399;cursor:pointer;font-family:var(--font)">📅 ดูแผน</button>`
      : `<button onclick="goToPlanWithItem(${d.id})" style="flex:1;padding:8px;background:#001020;border:1px solid #185FA5;border-radius:8px;font-size:12px;color:#60A5FA;cursor:pointer;font-family:var(--font)">📋 วางแผน</button>`;

    return `<div style="background:${rowBg};border:0.5px solid #333;border-radius:12px;padding:14px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div style="flex:1;min-width:0;margin-right:8px">
          <div style="font-size:15px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.instrument_name||'–'}</div>
          <div style="font-size:12px;color:#aaa;margin-top:2px">${d.brand||''} · ${d.department||''}</div>
        </div>${badge}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;margin-bottom:8px">
        <div style="font-size:11px;color:#aaa">🏷 <span style="color:#69F0AE;font-weight:500">${d.id_code||'–'}</span></div>
        <div style="font-size:11px;color:#aaa">📂 ${typShort}</div>
        <div style="font-size:11px;color:#aaa">📅 ครบ: ${dueDate}</div>
        <div style="font-size:11px">${daysText}</div>
      </div>
      <div style="margin-bottom:8px">${planBadge}</div>
      <div style="display:flex;gap:8px">
        <button onclick="mobileEdit(${i})" style="flex:1;padding:8px;background:#1B3A2A;border:1px solid #2E7D32;border-radius:8px;font-size:12px;color:#69F0AE;cursor:pointer;font-family:var(--font)">✏️ แก้ไข</button>
        <button onclick="mobileCert(${i})" style="flex:1;padding:8px;background:#1A2A1A;border:1px solid #388E3C;border-radius:8px;font-size:12px;color:#A5D6A7;cursor:pointer;font-family:var(--font)">📄 Cert</button>
        ${planBtn}
      </div>
    </div>`;
  }).join('') || `<div style="text-align:center;padding:32px;color:#888">ไม่พบข้อมูล</div>`;
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

async function loadData(forceRefresh = false) {
  const CACHE_KEY = 'ilc_instruments_cache';
  const CACHE_TIME_KEY = 'ilc_instruments_cache_time';
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
    renderAlerts();
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
    const COLS = 'id,instrument_type,machine_name,location,instrument_name,brand,range_val,tolerance,serial_no,department,id_code,cert_no,cal_date,due_date,cal_frequency,cal_type,remark,issued_by,responsible_by,request_no,job_no,approved_by,approved_at';
    const chunkSize = 500;
    const isFiltered = currentUser?.role !== 'admin' && currentUser?.instrument_types?.length > 0;

    // ดึง count
    let countQ = sb.from('instruments').select('id', { count: 'exact', head: true });
    if (isFiltered) countQ = countQ.in('instrument_type', currentUser.instrument_types);
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
      if (isFiltered) q = q.in('instrument_type', currentUser.instrument_types);
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
  const types = [...new Set(allData.map(d => d.instrument_type))].filter(Boolean).sort();
  const units = [...new Set(allData.map(d => d.department))].filter(Boolean).sort();
  document.getElementById('typeFilter').innerHTML = '<option value="">ทุกประเภท</option>' + types.map(t => `<option>${t}</option>`).join('');
  document.getElementById('unitFilter').innerHTML = '<option value="">ทุกหน่วยงาน</option>' + units.map(u => `<option>${u}</option>`).join('');
}

function updateStats() {
  let ov = 0, wa = 0, ok = 0;
  filteredData.forEach(d => {
    if (d.days_left === null) return;
    if (d.days_left < 0) ov++;
    else if (d.days_left <= 30) wa++;
    else ok++;
  });
  const total = filteredData.length;
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
      <div style="font-size:13px;color:var(--text)">${dot} ${d.id_code || '-'} ${d.instrument_name || d.instrument_type || ''}</div>
      <div style="font-size:12px;color:${color};white-space:nowrap">${status}</div>
    </div>`;
  }).join('');
}

function filterData() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const type = document.getElementById('typeFilter').value;
  const unit = document.getElementById('unitFilter').value;
  const status = document.getElementById('statusFilter').value;
  const month = document.getElementById('monthFilter').value;

  filteredData = allData.filter(d => {
    if (search && !['instrument_type','instrument_name','brand','id_code','cert_no','serial_no','department','machine_name','location'].some(k => String(d[k]||'').toLowerCase().includes(search))) return false;
    if (type && d.instrument_type !== type) return false;
    if (unit && d.department !== unit) return false;
    // กรองตาม activeCategory (การ์ดประเภทเครื่องมือ)
    if (activeCategory && activeCategory !== 'all' && d.instrument_type !== activeCategory) return false;
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
  updateStats(); renderTable();
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
  updateStats(); renderTable();
}

function formatDate(s) {
  if (!s) return '–';
  return new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function typeBadge(t) {
  if (!t) return '<span class="badge badge-gray">–</span>';
  const map = {
    'มวล/น้ำหนัก (Mass/Weight)': 'badge-blue',
    'ความยาว/มิติ (Length/Dimension)': 'badge-purple',
    'อุณหภูมิ/ความชื้น (Temperature/Humidity)': 'badge-amber',
    'ความดัน/สุญญากาศ (Pressure/Vacuum)': 'badge-gray',
    'ความเร็วรอบ (Speed/Rotation)': 'badge-green',
    'เวลา (Time)': 'badge-gray',
    'เคมี/ความเข้มข้น (Chemical/Concentration)': 'badge-green',
    'ความหนืด/ความหนาแน่น (Viscosity/Density)': 'badge-blue',
    'ไฟฟ้า (Electrical)': 'badge-amber',
    'การไหล/ปริมาตร (Flow/Volume)': 'badge-blue',
    'แสง/เสียง (Light/Sound)': 'badge-amber',
    'ความปลอดภัย (Safety)': 'badge-red',
    'แรงบิด/แรงกด (Torque/Force)': 'badge-purple',
  };
  return `<span class="badge ${map[t]||'badge-gray'}" style="font-size:13px">${t}</span>`;
}

function renderTable() {
  const tbody = document.getElementById('dataTable');
  if (!filteredData.length) { 
    tbody.innerHTML = '<tr><td colspan="22" class="no-data">ไม่พบข้อมูล</td></tr>';
    updatePaginationUI();
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
    const days = d.days_left;
    let statusBadge, daysClass;
    if (days === null) { statusBadge = '<span class="badge badge-gray">–</span>'; daysClass = 'badge-gray'; }
    else if (days < 0) { statusBadge = '<span class="badge badge-red">🔴 เลยกำหนด</span>'; daysClass = 'badge-red'; }
    else if (days <= 30) { statusBadge = '<span class="badge badge-amber">🟡 ใกล้ครบ</span>'; daysClass = 'badge-amber'; }
    else { statusBadge = '<span class="badge badge-green">🟢 ปกติ</span>'; daysClass = 'badge-green'; }
    return `<tr>
      <td>${rowNum}</td>
      <td>${typeBadge(d.instrument_type)}</td>
      <td>${d.machine_name||'–'}</td>
      <td>${d.location||'–'}</td>
      <td>${d.instrument_name||'–'}</td>
      <td>${d.brand||'–'}</td>
      <td>${d.range_val||'–'}</td>
      <td style="font-family:var(--mono);font-size:20px">${d.tolerance ? '± '+d.tolerance : '–'}</td>
      <td style="font-family:var(--mono);font-size:20px">${d.serial_no||'–'}</td>
      <td><strong>${d.department||'–'}</strong></td>
      <td><button onclick="openCalHistory(${d.id})" style="font-family:var(--mono);font-size:11px;color:var(--accent);background:none;border:none;cursor:pointer;padding:0;text-decoration:underline dotted;text-underline-offset:3px" title="ดูประวัติสอบเทียบ">${d.id_code||'–'}</button></td>
      <td style="font-family:var(--mono);font-size:20px">${d.cert_no||'–'}</td>
      <td>${formatDate(d.cal_date)}</td>
      <td>${formatDate(d.due_date)}</td>
      <td><span class="days-chip badge ${daysClass}">${days !== null ? days+' วัน' : '–'}</span></td>
      <td>${d.cal_frequency||'–'}</td>
      <td>${d.cal_type ? '<span class="badge '+(d.cal_type==='ภายใน'?'badge-blue':'badge-purple')+'">'+(d.cal_type==='ภายใน'?'🏭 ภายใน':'🌐 ภายนอก')+'</span>' : '–'}</td>
      <td>${statusBadge}</td>
      <td>${(()=>{
        const ps = planStatusMap[d.id];
        if (!ps) return `<button onclick="goToPlanWithItem(${d.id})" style="font-size:11px;background:var(--accent-light);color:var(--accent);border:1px solid var(--accent);border-radius:6px;padding:2px 8px;cursor:pointer;white-space:nowrap;font-family:var(--font)">📋 วางแผน</button>`;
        const sMap = {
          pending_plan: ['🟡 รอยืนยันแผน','#854F0B','#FAEEDA'],
          planned:      ['✅ วางแผนแล้ว','#3B6D11','#EAF3DE'],
          pending_cert: ['🔵 รอยืนยันสอบ','#185FA5','#E6F1FB'],
          completed:    ['🏆 สอบเทียบแล้ว','#0F6E56','#E1F5EE'],
        };
        const [lbl,color,bg] = sMap[ps.status] || ['–','#888','#f5f5f5'];
        return `<button onclick="goToPlanDetail(${d.id})" title="ดูแผน: ${ps.title}" style="font-size:11px;background:${bg};color:${color};border:1px solid ${color}40;border-radius:6px;padding:2px 8px;white-space:nowrap;cursor:pointer;font-family:var(--font);font-weight:500">${lbl}</button>`;
      })()}</td>
      <td><button id="certbtn-${d.id}" class="btn-cert ${fileCountCache[d.id]>0?'btn-cert-has':'btn-cert-empty'}" onclick="openCertModal(${d.id},'${(d.id_code||'')}','${(d.cert_no||'')}','${(d.instrument_name||'').replace(/'/g,"\\'")}')" >📎 ${fileCountCache[d.id]>0?fileCountCache[d.id]+' ไฟล์':'ไฟล์'}</button></td>
      <td>${d.remark ? '<span style="font-size:13px;color:#888">'+d.remark+'</span>' : '–'}</td>
      <td style="white-space:nowrap" class="td-manage"></td>
    </tr>`;
  }).join('');

  // ใส่ปุ่มจัดการถ้าเป็น Admin/Editor
  if (currentUser?.role === 'admin' || currentUser?.role === 'editor') {
    const start = (currentPage - 1) * pageSize;
    document.querySelectorAll('.td-manage').forEach((td, i) => {
      const d = filteredData[start + i];
      if (!d) return;
      const name = (d.instrument_name||'').replace(/'/g, "\\'");
      td.innerHTML = `<button class="btn-view" style="margin-right:4px" onclick="openInstrumentModal(${d.id})">✏️</button><button class="btn-del" onclick="deleteInstrument(${d.id},'${name}')">🗑️</button>`;
    });
  }
  updateFileCounts(pageData);
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
