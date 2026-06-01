/* ===== 07-notifications.js ===== (extracted from index.html lines 3962-4098) */
document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('notifWrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    const dd = document.getElementById('notifDropdown');
    if (dd) dd.style.display = 'none';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const ia = document.getElementById('importUploadArea');
  if (!ia) return;
  ia.addEventListener('dragover', e => { e.preventDefault(); ia.classList.add('dragover'); });
  ia.addEventListener('dragleave', () => ia.classList.remove('dragover'));
  ia.addEventListener('drop', e => { e.preventDefault(); ia.classList.remove('dragover'); handleImportFile(e.dataTransfer.files[0]); });
});


// ====================================================
// NOTIFICATION BELL
// ====================================================
function updateNotificationBell() {
  if (!currentUser) return;
  const userTypes = currentUser.instrument_types;
  const relevant = (userTypes && userTypes.length > 0)
    ? allData.filter(d => userTypes.includes(d.instrument_type))
    : allData;

  const overdue = relevant.filter(d => d.days_left !== null && d.days_left < 0);
  const warning = relevant.filter(d => d.days_left !== null && d.days_left >= 0 && d.days_left <= 30);
  const total = overdue.length + warning.length;

  const badge = document.getElementById('notifBadge');
  const countEl = document.getElementById('notifCount');
  if (badge) { badge.style.display = total > 0 ? 'flex' : 'none'; }
  if (countEl) countEl.textContent = total > 99 ? '99+' : total;
  window._notifItems = { overdue, warning };
}

function toggleNotifDropdown() {
  const dd = document.getElementById('notifDropdown');
  if (!dd) return;
  if (dd.style.display === 'block') { dd.style.display = 'none'; return; }
  renderNotifDropdown();
  dd.style.display = 'block';
}

function renderNotifDropdown() {
  const { overdue = [], warning = [] } = window._notifItems || {};
  const dd = document.getElementById('notifDropdown');
  if (!dd) return;
  const total = overdue.length + warning.length;

  if (total === 0) {
    dd.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text3);font-size:13px">✅ ไม่มีรายการที่ต้องดำเนินการ</div>';
    return;
  }

  const items = [...overdue.slice(0,8).map(d => ({...d,_t:'ov'})), ...warning.slice(0,5).map(d => ({...d,_t:'wa'}))];
  dd.innerHTML = `
    <div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:var(--surface2)">
      <span style="font-size:13px;font-weight:700;color:var(--text)">🔔 การแจ้งเตือน</span>
      <span style="font-size:11px;background:var(--red-light);color:var(--red);padding:2px 8px;border-radius:10px;font-weight:600">${total} รายการ</span>
    </div>
    ${items.map(d => {
      const isOv = d._t === 'ov';
      const color = isOv ? 'var(--red)' : 'var(--amber)';
      const bg    = isOv ? 'var(--red-light)' : 'var(--amber-light)';
      const icon  = isOv ? '🔴' : '🟡';
      const label = isOv ? `เลยกำหนด ${Math.abs(d.days_left)} วัน` : `ครบในอีก ${d.days_left} วัน`;
      const name  = (d.instrument_name || d.id_code || '–').substring(0, 22);
      return `<div style="padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .1s"
                   onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background=''"
                   onclick="notifGoTo('${(d.id_code||'').replace(/'/g,"\\'")}')">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
          <span style="font-size:14px">${icon}</span>
          <span style="font-size:12px;font-weight:600;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</span>
          <span style="font-size:10px;color:${color};font-weight:600;background:${bg};padding:2px 7px;border-radius:10px;white-space:nowrap">${label}</span>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-left:22px;font-family:var(--mono)">${d.id_code || '–'} &nbsp;·&nbsp; ${d.department || '–'}</div>
      </div>`;
    }).join('')}
    ${total > items.length ? `<div style="padding:10px 16px;text-align:center;font-size:12px;color:var(--accent);cursor:pointer;font-weight:500" onclick="notifGoAll()">ดูทั้งหมด ${total} รายการ →</div>` : ''}
  `;
}

function notifGoTo(idCode) {
  document.getElementById('notifDropdown').style.display = 'none';
  showPage('dashboard');
  document.getElementById('searchInput').value = idCode;
  filterData();
  setTimeout(() => {
    const rows = document.querySelectorAll('#dataTable tr');
    rows.forEach(row => {
      if (row.textContent.includes(idCode)) {
        row.style.background = '#e0f4f1';
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => { row.style.background = ''; }, 2500);
      }
    });
  }, 200);
}

function notifGoAll() {
  document.getElementById('notifDropdown').style.display = 'none';
  showPage('dashboard');
  document.getElementById('statusFilter').value = 'overdue';
  filterData();
}

// ====================================================
// PLAN PAGE
// ====================================================
const MONTH_NAMES_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                         'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
let planSchedule = {};
let planStatusMap = {}; // instrument_id → {status, title, planned_date}

// โหลดสถานะแผนจาก Supabase เพื่อแสดงในตาราง
async function loadPlanStatusMap() {
  try {
    const { data } = await sb.from('calibration_plan_items')
      .select('instrument_id, calibration_plans!inner(status, title, planned_date)')
      .in('calibration_plans.status', ['pending_plan','planned','pending_cert','completed']);
    planStatusMap = {};
    if (data) {
      data.forEach(item => {
        const p = item.calibration_plans;
        planStatusMap[item.instrument_id] = { status: p.status, title: p.title, planned_date: p.planned_date };
      });
    }
    renderTable(); // re-render ตารางหลัง load
  } catch(e) { /* ignore */ }
}

// ====================================================
// STANDARD WEIGHTS (ลูกตุ้มมาตรฐาน)
// ====================================================
