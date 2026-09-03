/* ============================================================
   28-kpi.js — หน้า KPI (ดีไซน์ Calibration App)

   **ที่มาของตัวเลข — อ่านก่อนแก้**
   ระบบเดิมไม่มีประวัติ "แผน" รายเดือนให้ใช้ และ instruments เก็บแค่สถานะปัจจุบัน (พอสอบเสร็จ due_date
   ถูกดันไปปีหน้า) จึงกู้แผนเดิมรายเดือนตรง ๆ ไม่ได้

   วิธีที่ใช้ = ประกอบขึ้นจากทะเบียนเครื่องมือ:
     ผลสอบเทียบ (Complete) เดือน M = เครื่องที่ cal_date อยู่ในเดือน M
     พลาดแผน (Missed)      เดือน M = เครื่องที่ due_date อยู่ในเดือน M, เลยกำหนดแล้ว
                                      และยังไม่ถูกยกเลิกสอบเทียบ
     แผน (Plan) เดือน M            = Complete + Missed
   เดือนอนาคตยังไม่มีผล จึงนับ Plan จาก due_date ที่ยังมาไม่ถึงแทน (งานที่รออยู่)
   ============================================================ */

let kpiYear = new Date().getFullYear();
let kpiView = 'year';
let kpiMonth = new Date().getMonth();   // 0-11
const KPI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function kpiRows() {
  return (typeof allData !== 'undefined' ? (allData || []) : []).filter(d =>
    !(d.calibration_cancelled === true
      || (typeof window.isCalibrationCancelled === 'function' && window.isCalibrationCancelled(d))));
}
function kpiMonthOf(value) {
  if (!value) return null;
  const s = String(value).slice(0, 7);           // YYYY-MM
  const [y, m] = s.split('-');
  return { year: Number(y), month: Number(m) - 1 };
}

/* สรุปรายเดือนของปีที่เลือก — กรองตามหน่วยงานได้ (dept = '' คือรวมทั้งหมด) */
function kpiMonthly(dept) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const out = KPI_MONTHS.map(() => ({ done: 0, missed: 0, pending: 0 }));
  kpiRows().forEach(d => {
    if (dept && d.department !== dept) return;
    const c = kpiMonthOf(d.cal_date);
    if (c && c.year === kpiYear) out[c.month].done++;
    const u = kpiMonthOf(d.due_date);
    if (u && u.year === kpiYear) {
      const due = new Date(d.due_date); due.setHours(0, 0, 0, 0);
      if (due < today) out[u.month].missed++;   // ครบกำหนดแล้วแต่ยังไม่ได้สอบ
      else out[u.month].pending++;              // ยังมาไม่ถึงกำหนด
    }
  });
  return out.map(m => {
    const plan = m.done + m.missed;
    return { ...m, plan, pct: plan ? (m.done / plan * 100) : null };
  });
}

function kpiTotals(monthly) {
  const done = monthly.reduce((s, m) => s + m.done, 0);
  const missed = monthly.reduce((s, m) => s + m.missed, 0);
  const pending = monthly.reduce((s, m) => s + m.pending, 0);
  const plan = done + missed;
  return { done, missed, pending, plan, pct: plan ? (done / plan * 100) : null };
}

function kpiTopDepts(limit) {
  const tally = {};
  kpiRows().forEach(d => {
    const c = kpiMonthOf(d.cal_date);
    if (c && c.year === kpiYear && d.department) tally[d.department] = (tally[d.department] || 0) + 1;
  });
  return Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, limit).map(x => x[0]);
}

function kpiPct(v, dp) {
  return v === null || v === undefined ? '–' : v.toFixed(dp === undefined ? 2 : dp) + '%';
}
function kpiPctColor(v) {
  if (v === null || v === undefined) return '#8ba0b2';
  if (v >= 95) return '#0f6e56';
  if (v >= 85) return '#b45309';
  return '#b91c1c';
}

function kpiSetView(v) { kpiView = v; renderKpiPage(); }
function kpiSetMonth(m) { kpiMonth = m; renderKpiPage(); }
function kpiSetYear(y) { kpiYear = Number(y); renderKpiPage(); }

function renderKpiPage() {
  const host = document.getElementById('kpiBody');
  if (!host) return;
  const nav = document.getElementById('kpiSubNav');
  if (nav) {
    nav.innerHTML = [['year', '📅', 'ภาพรวมรายปี'], ['month', '🗓️', 'เจาะรายเดือน']]
      .map(([k, e, lb]) => '<button type="button" class="ax-kpi-pill' + (kpiView === k ? ' is-on' : '') + '"'
        + ' onclick="kpiSetView(\'' + k + '\')"><span>' + e + '</span><span>' + lb + '</span></button>').join('');
  }
  const yearSel = document.getElementById('kpiYear');
  if (yearSel) {
    const years = [...new Set(kpiRows().map(d => (kpiMonthOf(d.cal_date) || {}).year)
      .concat(kpiRows().map(d => (kpiMonthOf(d.due_date) || {}).year)).filter(Boolean))].sort((a, b) => b - a);
    if (!years.includes(kpiYear)) years.unshift(kpiYear);
    yearSel.innerHTML = years.map(y => '<option value="' + y + '">ปี ' + y + '</option>').join('');
    yearSel.value = String(kpiYear);
  }
  host.innerHTML = kpiView === 'year' ? kpiYearViewHtml() : kpiMonthViewHtml();
}

function kpiYearViewHtml() {
  const monthly = kpiMonthly('');
  const t = kpiTotals(monthly);
  // ตัวเลขรวมเป็นยอดทั้งปี (ไม่ได้ตัดที่เดือนปัจจุบัน) — ป้ายต้องพูดตรงกับที่นับจริง
  const upto = ' · รวมทั้งปี';
  const pctText = t.pct === null ? '–' : t.pct.toFixed(2) + '%';
  const barMax = Math.max(1, ...monthly.map(m => Math.max(m.plan, m.done)));

  const bars = monthly.map((m, i) => {
    const hP = Math.round(m.plan / barMax * 100);
    const hD = Math.round(m.done / barMax * 100);
    const isNow = i === new Date().getMonth() && kpiYear === new Date().getFullYear();
    return '<span class="ax-kpi-bargroup">'
      + '<span class="ax-kpi-barpct" style="color:' + kpiPctColor(m.pct) + '">' + (m.pct === null ? '' : Math.round(m.pct) + '%') + '</span>'
      + '<span class="ax-kpi-bars">'
      + '<span class="ax-kpi-bar plan" style="height:' + hP + '%" title="แผน ' + m.plan + '"></span>'
      + '<span class="ax-kpi-bar done" style="height:' + hD + '%" title="ผล ' + m.done + '"></span>'
      + '</span></span>'
      + '<!--label:' + (isNow ? 'now' : '') + '-->';
  }).join('');
  const labels = monthly.map((m, i) => {
    const isNow = i === new Date().getMonth() && kpiYear === new Date().getFullYear();
    return '<span class="ax-kpi-barlb' + (isNow ? ' is-now' : '') + '">' + KPI_MONTHS[i] + '</span>';
  }).join('');

  const depts = kpiTopDepts(4);
  const groups = [{ code: '', label: 'รวมทั้งหมด' }].concat(depts.map(c => ({ code: c, label: c })));
  const perDept = groups.map(g => kpiMonthly(g.code));
  const head1 = '<th rowspan="2" class="c-mon">แผนปี ' + kpiYear + '</th>'
    + groups.map(g => '<th colspan="3" class="c-grp">' + escapeHtmlText(g.label) + '</th>').join('');
  const head2 = groups.map(() => '<th class="c-sub">แผน</th><th class="c-sub">ผล</th><th class="c-sub">%</th>').join('');
  const body = KPI_MONTHS.map((mn, i) => {
    const cells = perDept.map(md => {
      const m = md[i];
      return '<td>' + (m.plan || '–') + '</td><td class="is-done">' + (m.done || '–') + '</td>'
        + '<td style="color:' + kpiPctColor(m.pct) + ';font-weight:700">' + (m.pct === null ? '–' : Math.round(m.pct) + '%') + '</td>';
    }).join('');
    return '<tr><td class="c-mon"><span class="ax-kpi-mon"><i>' + (i + 1) + '</i>' + mn + '</span></td>' + cells + '</tr>';
  }).join('');
  const totals = perDept.map(md => {
    const tt = kpiTotals(md);
    return '<td>' + (tt.plan || '–') + '</td><td class="is-done">' + (tt.done || '–') + '</td>'
      + '<td style="color:' + kpiPctColor(tt.pct) + '">' + (tt.pct === null ? '–' : tt.pct.toFixed(1) + '%') + '</td>';
  }).join('');

  return ''
    + '<div class="ax-kpi-top">'
      + '<div class="ax-kpi-hero">'
        + '<span class="ax-kpi-hero-lb">Calibration Job Performance of ' + kpiYear + upto + '</span>'
        + '<span class="ax-kpi-hero-val"><b>' + pctText + '</b>'
        + '<span>สอบเทียบได้ตามแผน ' + t.done.toLocaleString() + ' จาก ' + t.plan.toLocaleString() + ' รายการ</span></span>'
        + '<span class="ax-kpi-hero-bar"><span style="width:' + (t.pct === null ? 0 : t.pct) + '%"></span></span>'
      + '</div>'
      + '<div class="ax-kpi-cards">'
        + kpiCard(t.done.toLocaleString(), '#0f6e56', 'สอบเทียบแล้วปีนี้', 'นับจากวันสอบเทียบในทะเบียน')
        + kpiCard(t.missed.toLocaleString(), '#b91c1c', 'เลยกำหนด ยังไม่ได้สอบ', 'ครบกำหนดแล้วแต่ยังค้างอยู่')
        + kpiCard(t.pending.toLocaleString(), '#185fa5', 'รอถึงกำหนดในปีนี้', 'ยังมาไม่ถึงวันครบกำหนด')
      + '</div>'
    + '</div>'
    + '<div class="ax-kpi-card">'
      + '<div class="ax-kpi-cardhead"><h3>แผน (Plan) เทียบผลสอบเทียบ (Complete) รายเดือน · ปี ' + kpiYear + '</h3>'
      + '<div class="ax-kpi-legend"><span><i style="background:#cfe0ea"></i>แผน</span><span><i style="background:#0f8f7d"></i>ผลสอบเทียบ</span></div></div>'
      + '<div class="ax-kpi-chart">' + bars + '</div>'
      + '<div class="ax-kpi-chartlb">' + labels + '</div>'
    + '</div>'
    + '<div class="ax-kpi-card">'
      + '<h3>Calibration Job Performance of ' + kpiYear + '</h3>'
      + '<div class="table-wrap"><table class="ax-table ax-table-kpi">'
        + '<thead><tr class="is-dark">' + head1 + '</tr><tr>' + head2 + '</tr></thead>'
        + '<tbody>' + body + '<tr class="is-total"><td class="c-mon">รวมทั้งปี</td>' + totals + '</tr></tbody>'
      + '</table></div>'
      + '<p class="ax-perm-note">ℹ️ รายงานนี้ไม่มีประวัติแผนรายเดือนย้อนหลัง ตัวเลข "แผน" จึงประกอบจากทะเบียนเครื่องมือ = ผลสอบเทียบในเดือนนั้น + รายการที่ครบกำหนดเดือนนั้นแต่ยังค้าง · หน่วยงานที่แสดงคือ 4 อันดับแรกตามปริมาณงานปีนี้</p>'
    + '</div>';
}

function kpiCard(value, color, label, note) {
  return '<div class="ax-kpi-mini"><b style="color:' + color + '">' + value + '</b>'
    + '<span>' + label + '</span><i>' + note + '</i></div>';
}

function kpiMonthViewHtml() {
  const monthly = kpiMonthly('');
  const m = monthly[kpiMonth];
  const chips = KPI_MONTHS.map((mn, i) =>
    '<button type="button" class="ax-kpi-chip' + (i === kpiMonth ? ' is-on' : '') + '" onclick="kpiSetMonth(' + i + ')">'
    + mn + '</button>').join('');

  const rows = [];
  const tally = {};
  kpiRows().forEach(d => {
    const dept = d.department || '(ไม่ระบุ)';
    tally[dept] = tally[dept] || { done: 0, missed: 0, pending: 0 };
    const c = kpiMonthOf(d.cal_date);
    if (c && c.year === kpiYear && c.month === kpiMonth) tally[dept].done++;
    const u = kpiMonthOf(d.due_date);
    if (u && u.year === kpiYear && u.month === kpiMonth) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const due = new Date(d.due_date); due.setHours(0, 0, 0, 0);
      if (due < today) tally[dept].missed++; else tally[dept].pending++;
    }
  });
  Object.entries(tally)
    .map(([dept, v]) => ({ dept, ...v, plan: v.done + v.missed }))
    .filter(v => v.plan || v.pending)
    .sort((a, b) => b.plan - a.plan || b.pending - a.pending)
    .forEach(v => {
      const pct = v.plan ? v.done / v.plan * 100 : null;
      rows.push('<tr><td class="c-mon">' + escapeHtmlText(v.dept) + '</td>'
        + '<td>' + (v.plan || '–') + '</td><td class="is-done">' + (v.done || '–') + '</td>'
        + '<td style="color:#b91c1c">' + (v.missed || '–') + '</td>'
        + '<td style="color:#185fa5">' + (v.pending || '–') + '</td>'
        + '<td style="color:' + kpiPctColor(pct) + ';font-weight:700">' + (pct === null ? '–' : Math.round(pct) + '%') + '</td></tr>');
    });

  return ''
    + '<div class="ax-kpi-card"><span class="ax-kpi-chiplb">เลือกเดือน · ปี ' + kpiYear + '</span>'
      + '<div class="ax-kpi-chips">' + chips + '</div></div>'
    + '<div class="ax-kpi-cards ax-kpi-cards--wide">'
      + kpiCard((m.plan || 0).toLocaleString(), '#0c4a5e', 'แผนเดือน ' + KPI_MONTHS[kpiMonth], 'ผลสอบเทียบ + ที่ยังค้าง')
      + kpiCard((m.done || 0).toLocaleString(), '#0f6e56', 'สอบเทียบแล้ว', 'นับจากวันสอบเทียบในทะเบียน')
      + kpiCard((m.missed || 0).toLocaleString(), '#b91c1c', 'เลยกำหนด ยังไม่ได้สอบ', 'ครบกำหนดเดือนนี้แต่ยังค้าง')
      + kpiCard(kpiPct(m.pct, 1), kpiPctColor(m.pct), 'ทำได้ตามแผน', 'ผลสอบเทียบ ÷ แผน')
    + '</div>'
    + '<div class="ax-kpi-card"><h3>แยกตามหน่วยงาน · ' + KPI_MONTHS[kpiMonth] + ' ' + kpiYear + '</h3>'
      + '<div class="table-wrap"><table class="ax-table ax-table-kpi">'
      + '<thead><tr><th class="c-mon">หน่วยงาน</th><th class="c-sub">แผน</th><th class="c-sub">ผล</th>'
      + '<th class="c-sub">ค้าง</th><th class="c-sub">รอถึงกำหนด</th><th class="c-sub">%</th></tr></thead>'
      + '<tbody>' + (rows.join('') || '<tr><td colspan="6" class="no-data">ไม่มีข้อมูลในเดือนนี้</td></tr>') + '</tbody>'
      + '</table></div></div>';
}

function loadKpiPage() { renderKpiPage(); }
