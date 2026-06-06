/* ===== 07-notifications.js ===== (generated from index.html inline app script) */
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
  showPage('list');
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
  showPage('list');
  document.getElementById('statusFilter').value = 'overdue';
  filterData();
}

// ====================================================
