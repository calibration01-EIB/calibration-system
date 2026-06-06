/* ===== 04-reports.js ===== (generated from index.html inline app script) */
// PRINT / PDF REPORT
// ====================================================
function printReport() {
  const today = new Date();
  const todayStr = today.toLocaleDateString('th-TH', {year:'numeric', month:'long', day:'numeric'});
  const year = today.getFullYear() + 543;

  let ov=0, wa=0, ok=0;
  filteredData.forEach(d => {
    if (d.days_left === null) return;
    if (d.days_left < 0) ov++;
    else if (d.days_left <= 30) wa++;
    else ok++;
  });

  // สร้างแถวตาราง
  const rows = filteredData.map((d, i) => {
    const rowNum = i + 1;
    const days = d.days_left;
    let statusText, statusColor;
    if (days === null) { statusText = '–'; statusColor = '#666'; }
    else if (days < 0) { statusText = 'เลยกำหนด'; statusColor = '#c0392b'; }
    else if (days <= 30) { statusText = 'ใกล้ครบ'; statusColor = '#b8860b'; }
    else { statusText = 'ปกติ'; statusColor = '#1e7e34'; }
    const due = d.due_date ? new Date(d.due_date).toLocaleDateString('th-TH', {year:'numeric',month:'2-digit',day:'2-digit'}) : '–';
    const cal = d.cal_date ? new Date(d.cal_date).toLocaleDateString('th-TH', {year:'numeric',month:'2-digit',day:'2-digit'}) : '–';
    return `<tr>
      <td>${rowNum}</td>
      <td>${d.instrument_type||'–'}</td>
      <td>${d.instrument_name||'–'}</td>
      <td>${d.brand||'–'}</td>
      <td>${d.range_val||'–'}</td>
      <td>${d.department||'–'}</td>
      <td>${d.id_code||'–'}</td>
      <td>${d.cert_no||'–'}</td>
      <td>${cal}</td>
      <td>${due}</td>
      <td style="color:${statusColor};font-weight:600">${statusText}</td>
    </tr>`;
  }).join('');

  // ชื่อ filter ที่เลือก
  const filterInfo = [];
  const tf = document.getElementById('typeFilter').value;
  const uf = document.getElementById('unitFilter').value;
  const sf = document.getElementById('statusFilter').value;
  const mf = document.getElementById('monthFilter').value;
  const mfNames = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  if (tf) filterInfo.push(`ประเภท: ${tf}`);
  if (uf) filterInfo.push(`หน่วยงาน: ${uf}`);
  if (sf) filterInfo.push(`สถานะ: ${sf==='overdue'?'เลยกำหนด':sf==='warning'?'ใกล้ครบ':'ปกติ'}`);
  if (mf) filterInfo.push(`เดือน: ${mfNames[parseInt(mf)]}`);

  const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>รายงานสอบเทียบเครื่องมือ</title>
<style>
  @page { size: A4 landscape; margin: 15mm 12mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 9pt; color: #222; }
  .header { text-align:center; margin-bottom: 12px; border-bottom: 2px solid #1a2f4a; padding-bottom: 10px; }
  .header h1 { font-size: 16pt; color: #1a2f4a; font-weight: 700; margin-bottom: 4px; }
  .header p { font-size: 9pt; color: #555; }
  .summary { display: flex; gap: 12px; margin-bottom: 12px; }
  .sum-card { flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 8px 12px; text-align: center; }
  .sum-card .num { font-size: 20pt; font-weight: 700; line-height: 1.2; }
  .sum-card .lbl { font-size: 8pt; color: #666; margin-top: 2px; }
  .sum-card.ov { border-color: #e74c3c; }
  .sum-card.ov .num { color: #e74c3c; }
  .sum-card.wa { border-color: #f39c12; }
  .sum-card.wa .num { color: #f39c12; }
  .sum-card.ok { border-color: #27ae60; }
  .sum-card.ok .num { color: #27ae60; }
  .sum-card.tt .num { color: #1a2f4a; }
  .filter-info { font-size: 8pt; color: #555; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; table-layout: auto; }
table td, table th { white-space: nowrap; }
  th { background: #1a2f4a; color: white; padding: 6px 5px; text-align: left; font-size: 8pt; font-weight: 600; }
  td { padding: 5px; border-bottom: 0.5px solid #e0e0e0; font-size: 8pt; vertical-align: middle; }
  tr:nth-child(even) td { background: #f8f9fa; }
  tr:last-child td { border-bottom: none; }
  .footer { margin-top: 12px; font-size: 8pt; color: #888; text-align: right; border-top: 1px solid #ddd; padding-top: 6px; }
</style>
</head>
<body>
  <div class="header">
    <h1>🔧 รายงานสถานะการสอบเทียบเครื่องมือ</h1>
    <p>พิมพ์วันที่ ${todayStr} &nbsp;|&nbsp; ทั้งหมด ${filteredData.length} รายการ</p>
  </div>

  <div class="summary">
    <div class="sum-card ov"><div class="num">${ov}</div><div class="lbl">🔴 เลยกำหนด</div></div>
    <div class="sum-card wa"><div class="num">${wa}</div><div class="lbl">🟡 ใกล้ครบ (≤30 วัน)</div></div>
    <div class="sum-card ok"><div class="num">${ok}</div><div class="lbl">🟢 ปกติ</div></div>
    <div class="sum-card tt"><div class="num">${filteredData.length}</div><div class="lbl">📦 ทั้งหมด</div></div>
  </div>

  ${filterInfo.length ? `<div class="filter-info">⚙️ Filter: ${filterInfo.join(' | ')}</div>` : ''}

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>ประเภท</th>
        <th>เครื่องมือ</th>
        <th>ยี่ห้อ / รุ่น</th>
        <th>Range</th>
        <th>หน่วยงาน</th>
        <th>ID Code</th>
        <th>CERT.</th>
        <th>วันสอบเทียบ</th>
        <th>ครบกำหนด</th>
        <th>สถานะ</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="footer">
    รายงานนี้สร้างจากระบบสอบเทียบเครื่องมือ &nbsp;|&nbsp; พิมพ์วันที่ ${todayStr}
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.print(); };
}


// ====================================================
// CATEGORY (กลุ่มเครื่องมือ ดึงจาก Supabase column category)
// ====================================================
const CATEGORY_ICONS = {
  'มวล/น้ำหนัก (Mass/Weight)': 'ti-weight',
  'ความยาว/มิติ (Length/Dimension)': 'ti-ruler',
  'อุณหภูมิ/ความชื้น (Temperature/Humidity)': 'ti-temperature',
  'ความดัน/สุญญากาศ (Pressure/Vacuum)': 'ti-gauge',
  'ความเร็วรอบ (Speed/Rotation)': 'ti-rotate-clockwise',
  'เวลา (Time)': 'ti-clock',
  'เคมี/ความเข้มข้น (Chemical/Concentration)': 'ti-flask',
  'ความหนืด/ความหนาแน่น (Viscosity/Density)': 'ti-droplet',
  'ไฟฟ้า (Electrical)': 'ti-bolt',
  'การไหล/ปริมาตร (Flow/Volume)': 'ti-wave-sine',
  'แสง/เสียง (Light/Sound)': 'ti-bulb',
  'ความปลอดภัย (Safety)': 'ti-shield',
  'แรงบิด/แรงกด (Torque/Force)': 'ti-arrows-transfer-down',
  'อื่นๆ (Others)': 'ti-dots-circle-horizontal',
};

let activeCategory = 'all';

// ====================================================
// RENDER MONTHLY CARDS
// ====================================================
const MONTH_NAMES_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const MONTH_NAMES_FULL  = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
let activeMonthCard = null;

function renderMonthly() {
  if (!allData.length) { setTimeout(renderMonthly, 500); return; }
  const byMonth = {};
  for (let i = 0; i < 12; i++) byMonth[i] = [];
  allData.forEach(d => {
    if (!d.due_date) return;
    byMonth[new Date(d.due_date).getMonth()].push(d);
  });
  const grid = document.getElementById('monthGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const items = byMonth[i];
    const cnt = items.length;
    const ov  = items.filter(d => d.days_left !== null && d.days_left < 0).length;
    const wa  = items.filter(d => d.days_left !== null && d.days_left >= 0 && d.days_left <= 30).length;
    const barColor  = ov > 0 ? 'var(--red)' : wa > 0 ? 'var(--amber)' : 'var(--green)';
    const numColor  = ov > 0 ? 'var(--red)' : wa > 0 ? 'var(--amber)' : cnt > 0 ? 'var(--green)' : 'var(--text3)';
    const card = document.createElement('div');
    card.style.cssText = `border:1.5px solid var(--border);border-radius:10px;padding:10px 6px;text-align:center;cursor:${cnt?'pointer':'default'};transition:all .15s;background:white`;
    const ok = cnt - ov - wa;
    card.innerHTML = `
      <div style="font-size:11px;color:#444;margin-bottom:4px;font-weight:600">${MONTH_NAMES_SHORT[i]}</div>
      <div style="font-size:20px;font-weight:700;color:${numColor};line-height:1">${cnt||'–'}</div>
      <div style="height:3px;background:var(--surface2);border-radius:2px;margin:5px 3px 4px;display:flex;gap:1px;overflow:hidden">
        ${ov>0?`<div style="flex:${ov};background:var(--red);border-radius:2px"></div>`:''}
        ${wa>0?`<div style="flex:${wa};background:var(--amber);border-radius:2px"></div>`:''}
        ${ok>0?`<div style="flex:${ok};background:var(--green);border-radius:2px"></div>`:''}
      </div>
      <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
        ${ov>0?`<span style="font-size:10px;color:#c0392b;font-weight:600">🔴 ${ov}</span>`:''}
        ${wa>0?`<span style="font-size:10px;color:#b8690a;font-weight:600">🟡 ${wa}</span>`:''}
        ${ok>0&&cnt>0?`<span style="font-size:10px;color:#1a6b3c;font-weight:600">🟢 ${ok}</span>`:''}
        ${cnt===0?`<span style="font-size:10px;color:var(--text3)">–</span>`:''}
      </div>`;
    if (cnt) {
      card.addEventListener('mouseenter', () => { card.style.borderColor = barColor; card.style.transform = 'translateY(-1px)'; });
      card.addEventListener('mouseleave', () => { if (activeMonthCard !== card) { card.style.borderColor = 'var(--border)'; card.style.transform = ''; } });
      card.addEventListener('click', () => {
        if (activeMonthCard && activeMonthCard !== card) {
          activeMonthCard.style.borderColor = 'var(--border)';
          activeMonthCard.style.transform = '';
          activeMonthCard.style.boxShadow = '';
        }
        if (activeMonthCard === card) {
          activeMonthCard = null;
          card.style.borderColor = 'var(--border)';
          card.style.transform = '';
          document.getElementById('monthFilter').value = '';
        } else {
          activeMonthCard = card;
          card.style.borderColor = barColor;
          card.style.boxShadow = `0 0 0 2px ${barColor}40`;
          document.getElementById('monthFilter').value = i + 1;
        }
        filterData();
      });
    }
    grid.appendChild(card);
  }
}


function renderCategoryCards() {
  const grid = document.getElementById('categoryGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const CAT_14 = [
    ['มวล/น้ำหนัก (Mass/Weight)', 'Mass/Weight'],
    ['ความยาว/มิติ (Length/Dimension)', 'Length/Dimension'],
    ['อุณหภูมิ/ความชื้น (Temperature/Humidity)', 'Temperature/Humidity'],
    ['ความดัน/สุญญากาศ (Pressure/Vacuum)', 'Pressure/Vacuum'],
    ['ความเร็วรอบ (Speed/Rotation)', 'Speed/Rotation'],
    ['เวลา (Time)', 'Time'],
    ['เคมี/ความเข้มข้น (Chemical/Concentration)', 'Chemical/Concentration'],
    ['ความหนืด/ความหนาแน่น (Viscosity/Density)', 'Viscosity/Density'],
    ['ไฟฟ้า (Electrical)', 'Electrical'],
    ['การไหล/ปริมาตร (Flow/Volume)', 'Flow/Volume'],
    ['แสง/เสียง (Light/Sound)', 'Light/Sound'],
    ['ความปลอดภัย (Safety)', 'Safety'],
    ['แรงบิด/แรงกด (Torque/Force)', 'Torque/Force'],
    ['อื่นๆ (Others)', 'Others'],
  ];

  const today = new Date();

  // นับจำนวนและสถานะจาก allData
  const stats = {};
  allData.forEach(d => {
    const t = d.instrument_type || 'อื่นๆ (Others)';
    if (!stats[t]) stats[t] = { total: 0, overdue: 0, warning: 0, ok: 0 };
    stats[t].total++;
    const due = d.due_date ? new Date(d.due_date) : null;
    if (!due) { stats[t].ok++; return; }
    const diff = Math.ceil((due - today) / 86400000);
    if (diff < 0) stats[t].overdue++;
    else if (diff <= 30) stats[t].warning++;
    else stats[t].ok++;
  });

  CAT_14.forEach(([fullName, enName]) => {
    const s = stats[fullName] || { total: 0, overdue: 0, warning: 0, ok: 0 };
    const cnt = s.total;
    const thName = fullName.split(' (')[0];
    const isActive = activeCategory === fullName;

    const numColor  = s.overdue > 0 ? 'var(--red)' : s.warning > 0 ? 'var(--amber)' : cnt > 0 ? '#1a6b3c' : 'var(--text3)';
    const mainColor = s.overdue > 0 ? 'var(--red)' : s.warning > 0 ? 'var(--amber)' : 'var(--green)';
    const cardBorder = isActive ? mainColor : 'var(--border)';
    const boxShadow  = isActive ? `0 0 0 2px ${mainColor}40` : 'none';

    const card = document.createElement('div');
    card.style.cssText = `background:white;border:1.5px solid ${cardBorder};box-shadow:${boxShadow};border-radius:10px;padding:10px 8px;text-align:center;cursor:${cnt?'pointer':'default'};transition:all .15s`;
    card.innerHTML = `
      <div style="font-size:11px;color:#444;margin-bottom:4px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${thName}</div>
      <div style="font-size:20px;font-weight:700;color:${numColor};line-height:1">${cnt||'–'}</div>
      <div style="height:3px;background:var(--surface2);border-radius:2px;margin:5px 3px 4px;display:flex;gap:1px;overflow:hidden">
        ${s.overdue>0?`<div style="flex:${s.overdue};background:var(--red);border-radius:2px"></div>`:''}
        ${s.warning>0?`<div style="flex:${s.warning};background:var(--amber);border-radius:2px"></div>`:''}
        ${s.ok>0?`<div style="flex:${s.ok};background:var(--green);border-radius:2px"></div>`:''}
      </div>
      <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">
        ${s.overdue>0?`<span style="font-size:10px;color:#c0392b;font-weight:600">🔴 ${s.overdue}</span>`:''}
        ${s.warning>0?`<span style="font-size:10px;color:#b8690a;font-weight:600">🟡 ${s.warning}</span>`:''}
        ${s.ok>0&&cnt>0?`<span style="font-size:10px;color:#1a6b3c;font-weight:600">🟢 ${s.ok}</span>`:''}
        ${cnt===0?`<span style="font-size:10px;color:var(--text3)">–</span>`:''}
      </div>`;

    if (cnt) {
      card.addEventListener('mouseenter', () => { if (activeCategory !== fullName) card.style.borderColor = mainColor; card.style.transform = 'translateY(-1px)'; });
      card.addEventListener('mouseleave', () => { if (activeCategory !== fullName) card.style.borderColor = cardBorder; card.style.transform = ''; });
      card.addEventListener('click', () => {
        activeCategory = (activeCategory === fullName) ? 'all' : fullName;
        renderCategoryCards();
        filterData();
      });
    }
    grid.appendChild(card);
  });
}


function selectCategory(cat) {
  activeCategory = (activeCategory === cat) ? 'all' : cat;
  currentPage = 1;
  filterData();
  renderCategoryCards();
}

// ====================================================
// PAGINATION
// ====================================================
let currentPage = 1;
let pageSize = 100;

function changePageSize() {
  pageSize = parseInt(document.getElementById('pageSizeSelect').value);
  currentPage = 1;
  renderTable();
}

function goPage(dir) {
  const totalPages = Math.ceil(filteredData.length / pageSize);
  currentPage = Math.max(1, Math.min(currentPage + dir, totalPages));
  renderTable();
  document.querySelector('.table-wrap').scrollIntoView({behavior:'smooth', block:'start'});
}

function updatePaginationUI() {
  const total = filteredData.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);
  document.getElementById('paginationInfo').textContent = `แสดง ${start.toLocaleString()}–${end.toLocaleString()} จาก ${total.toLocaleString()} รายการ`;
  document.getElementById('pageNum').textContent = `หน้า ${currentPage} / ${totalPages}`;
  document.getElementById('btnPrev').disabled = currentPage <= 1;
  document.getElementById('btnNext').disabled = currentPage >= totalPages;
}


// ====================================================
