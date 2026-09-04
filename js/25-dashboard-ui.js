/* ============================================================
   25-dashboard-ui.js — การ์ด "งานที่ต้องทำก่อน" บน Dashboard (ดีไซน์ใหม่)
   อ่านตัวเลขจาก element ที่ระบบเดิมอัปเดตอยู่แล้ว จึงไม่แตะ logic เดิม
   ต้องโหลดหลัง 02-dashboard.js / 04-reports.js / 10-router.js
   ============================================================ */

const DASH_TODO = [
  { src:'statOverdue',     emoji:'⚠️', bg:'#fde8e8', color:'#b91c1c',
    title:'เครื่องมือเกินกำหนดสอบเทียบ', desc:'ต้องดำเนินการทันที',
    go:"filterByStatus('overdue')" },
  { src:'scanNotifCount',  emoji:'📎', bg:'#fdf3dd', color:'#b45309',
    title:'สอบเสร็จแล้ว รอแนบสแกน',      desc:'ยังไม่ได้แนบไฟล์ใบรับรอง',
    go:"showPage('calrecs')" },
  { src:'navRepairBadge',  emoji:'🔧', bg:'#fde8e8', color:'#b91c1c',
    title:'งานซ่อมค้าง',                 desc:'รอตรวจรับ / รอปิดงาน',
    go:"showPage('repairs')" },
  { src:'navPlanBadge',    emoji:'📅', bg:'#ece6fb', color:'#5b3fae',
    title:'แผนสอบเทียบรอดำเนินการ',      desc:'ติดตาม PDF รับทราบ ผลสอบเทียบ และ PDF ปิดแผน',
    go:"showPage('plan')" },
  { src:'statWarning',     emoji:'⏳', bg:'#fdf3dd', color:'#b45309',
    title:'ใกล้ครบกำหนดสอบเทียบ',        desc:'ภายใน 30 วันข้างหน้า',
    go:"filterByStatus('warning')" }
];

function dashReadCount(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const n = parseInt(String(el.textContent).replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function renderDashTodo() {
  const host = document.getElementById('dashTodoList');
  if (!host) return;

  const rows = DASH_TODO
    .map(x => Object.assign({}, x, { n: dashReadCount(x.src) }))
    .filter(x => x.n > 0);

  if (!rows.length) {
    host.innerHTML = '<div class="dsh-todo-empty">ไม่มีงานค้าง — ทุกอย่างเป็นปัจจุบัน ✅</div>';
    return;
  }

  host.innerHTML = rows.map(x => `
    <button type="button" class="dsh-todo-item" onclick="${x.go}">
      <span class="dsh-todo-ic" style="background:${x.bg}">${x.emoji}</span>
      <span class="dsh-todo-tx">
        <b>${x.title}</b>
        <span>${x.desc}</span>
      </span>
      <span class="dsh-todo-n" style="color:${x.color}">${x.n}</span>
      <span class="dsh-todo-ar">→</span>
    </button>`).join('');
}

/* วาดใหม่เมื่อเข้า Dashboard */
(function () {
  const prev = window.showPage;
  if (typeof prev !== 'function') return;
  window.showPage = function (page) {
    prev.apply(this, arguments);
    if (page === 'dashboard') setTimeout(renderDashTodo, 60);
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  renderDashTodo();
  // ตัวเลขต้นทางถูกเติมแบบ async — ตามอัปเดตเป็นระยะ
  setInterval(() => {
    const p = document.getElementById('pageDashboard');
    if (p && p.style.display !== 'none') renderDashTodo();
  }, 4000);
});
