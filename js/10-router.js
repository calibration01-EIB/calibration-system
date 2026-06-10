/* ===== 10-router.js ===== (generated from index.html inline app script) */
// SHOW PAGE
// ====================================================
function showPage(page) {
  const pages = ['dashboard','list','audit','admin','monthly','plan','weights','cert'];
  pages.forEach(p => {
    const el = document.getElementById('page' + p.charAt(0).toUpperCase() + p.slice(1));
    if (el) el.style.display = page === p ? 'block' : 'none';
  });
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');
  updateMobileNav(page);
  updateMobileListVisibility(page);

  const titles = {
    dashboard: ['Dashboard','ภาพรวมสถานะเครื่องมือ'],
    list: ['รายการเครื่องมือ','ค้นหา กรอง และจัดการรายการ'],
    audit: ['Audit Log','ประวัติการเปลี่ยนแปลง'],
    admin: ['จัดการผู้ใช้','ตั้งค่าบัญชีและสิทธิ์'],
    monthly: ['รายงานรายเดือน','แผนสอบเทียบ'],
    plan: ['📅 วางแผนสอบเทียบ','กำหนดตารางและ Export FRM-EIB04'],
    weights: ['⚖️ Standard Weights','ทะเบียนลูกตุ้มมาตรฐาน'],
    cert: ['🏷️ ออก Cert','บันทึกการออกหมายเลขใบรับรองผลการสอบเทียบ'],
  };
  const t = titles[page] || ['',''];
  const tb = document.getElementById('topbarTitle');
  const ts = document.getElementById('topbarSub');
  if (tb) tb.textContent = t[0];
  if (ts) ts.textContent = t[1];

  if (page === 'plan') { loadPlanConfirmBadge(); initPlanPage(); }
  if (page === 'weights') loadStandardWeights();
  if (page === 'admin') loadUsers();
  if (page === 'audit') loadAuditLogs();
  if (page === 'cert') {
    const waitAndLoad = (attempt) => {
      if (allData && allData.length > 0) { loadCertPage(); return; }
      if (attempt > 20) { loadCertPage(); return; }
      setTimeout(() => waitAndLoad(attempt + 1), 200);
    };
    waitAndLoad(0);
  }
}

function updateMobileNav(page) {
  document.querySelectorAll('.bottom-nav .mobile-nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}

function updateMobileListVisibility(page) {
  const el = document.getElementById('mobileCardList');
  if (!el) return;
  const shouldShow = page === 'list' && window.innerWidth <= 768;
  el.classList.toggle('mobile-visible', shouldShow);
  if (shouldShow && typeof renderMobileCards === 'function') renderMobileCards();
}

window.addEventListener('resize', () => {
  const active = document.querySelector('.nav-item.active')?.id?.replace('nav-', '') || 'dashboard';
  updateMobileListVisibility(active);
});

function filterByStatus(status) {
  showPage('list');
  const sel = document.getElementById('statusFilter');
  if (sel) sel.value = status;
  if (typeof filterData === 'function') filterData();
}

(function installListIntegrityFixes() {
  const CANCEL_LABEL = 'ยกเลิกสอบเทียบ';
  const LEGACY_MARKER = '[[CAL_STATUS_CANCELLED]]';
  window.__calibrationListFixVersion = 14;

  function getRemarkLines(value) {
    return String(value || '').split(/\r?\n/);
  }

  function stripCalibrationCancelMarker(value) {
    return getRemarkLines(value)
      .filter(line => {
        const text = line.trim();
        return text && text !== CANCEL_LABEL && text !== `[${CANCEL_LABEL}]` && text !== LEGACY_MARKER;
      })
      .join('\n')
      .trim();
  }

  function buildCalibrationRemark(remark, status) {
    const clean = stripCalibrationCancelMarker(remark);
    return status === 'cancelled' ? [CANCEL_LABEL, clean].filter(Boolean).join('\n') : (clean || null);
  }

  function isCalibrationCancelled(row) {
    const remarkLines = getRemarkLines(row?.remark).map(line => line.trim());
    const statusText = String(row?.cal_status || row?.status || '').trim().toLowerCase();
    return statusText === 'cancelled'
      || statusText === CANCEL_LABEL.toLowerCase()
      || remarkLines.includes(CANCEL_LABEL)
      || remarkLines.includes(`[${CANCEL_LABEL}]`)
      || remarkLines.includes(LEGACY_MARKER);
  }

  function calculateDaysLeft(row) {
    if (!row?.due_date) return null;
    const due = new Date(row.due_date);
    if (Number.isNaN(due.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.round((due - today) / 86400000);
  }

  function normalizeRows(rows) {
    (rows || []).forEach(row => {
      if (!row) return;
      row.calibration_cancelled = isCalibrationCancelled(row);
      row._days_left_actual = calculateDaysLeft(row);
      row.days_left = row.calibration_cancelled ? null : row._days_left_actual;
    });
  }

  function getRowStatus(row) {
    if (isCalibrationCancelled(row)) return 'cancelled';
    const days = calculateDaysLeft(row);
    if (days === null) return 'none';
    if (days < 0) return 'overdue';
    if (days <= 30) return 'warning';
    return 'ok';
  }

  function ensureCancelStatusFilterOption() {
    const sel = document.getElementById('statusFilter');
    if (!sel) return;
    if (![...sel.options].some(option => option.value === 'cancelled')) {
      sel.insertAdjacentHTML('beforeend', '<option value="cancelled">ยกเลิกสอบเทียบ</option>');
    }
  }

  function setSelectValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    if (value && ![...el.options].some(option => option.value === value)) return;
    el.value = value || '';
  }

  function getTableWrap() {
    return document.querySelector('#pageList .table-wrap') || document.querySelector('.table-wrap');
  }

  function captureListState() {
    const wrap = getTableWrap();
    return {
      page: typeof currentPage === 'number' ? currentPage : 1,
      scrollTop: wrap ? wrap.scrollTop : 0,
      scrollLeft: wrap ? wrap.scrollLeft : 0,
      windowY: window.scrollY || 0,
      activeCategory: typeof activeCategory !== 'undefined' ? activeCategory : 'all',
      search: document.getElementById('searchInput')?.value || '',
      type: document.getElementById('typeFilter')?.value || '',
      unit: document.getElementById('unitFilter')?.value || '',
      status: document.getElementById('statusFilter')?.value || '',
      month: document.getElementById('monthFilter')?.value || '',
      idCode: document.getElementById('iIdCode')?.value?.trim() || '',
    };
  }

  function matchesText(row, search) {
    if (!search) return true;
    return ['instrument_type','instrument_name','brand','id_code','cert_no','serial_no','department','machine_name','location']
      .some(key => String(row[key] || '').toLowerCase().includes(search));
  }

  function matchesStatus(row, status) {
    if (!status) return true;
    const rowStatus = getRowStatus(row);
    if (status === 'cancelled') return rowStatus === 'cancelled';
    if (rowStatus === 'cancelled') return false;
    return rowStatus === status;
  }

  function applyListFilters(keepPage = false) {
    ensureCancelStatusFilterOption();
    normalizeRows(allData);
    const previousPage = typeof currentPage === 'number' ? currentPage : 1;
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const type = document.getElementById('typeFilter')?.value || '';
    const unit = document.getElementById('unitFilter')?.value || '';
    const status = document.getElementById('statusFilter')?.value || '';
    const month = document.getElementById('monthFilter')?.value || '';

    filteredData = (allData || []).filter(row => {
      if (!matchesText(row, search)) return false;
      if (type && row.instrument_type !== type) return false;
      if (unit && row.department !== unit) return false;
      if (typeof activeCategory !== 'undefined' && activeCategory && activeCategory !== 'all') {
        const category = typeof getInstrumentCategory === 'function' ? getInstrumentCategory(row) : row.instrument_type;
        if (category !== activeCategory) return false;
      }
      if (!matchesStatus(row, status)) return false;
      if (month && !row.due_date) return false;
      if (month) {
        const m = new Date(row.due_date).getMonth() + 1;
        if (String(m) !== month) return false;
      }
      return true;
    });

    const size = typeof pageSize === 'number' && pageSize > 0 ? pageSize : 100;
    const totalPages = Math.max(1, Math.ceil(filteredData.length / size));
    currentPage = keepPage ? Math.min(Math.max(previousPage, 1), totalPages) : 1;
    if (typeof updateStats === 'function') updateStats();
    if (typeof renderTable === 'function') renderTable();
  }

  function restoreListState(state) {
    if (!state) return;
    ensureCancelStatusFilterOption();
    const search = document.getElementById('searchInput');
    if (search) search.value = state.search || '';
    setSelectValue('typeFilter', state.type);
    setSelectValue('unitFilter', state.unit);
    setSelectValue('statusFilter', state.status);
    setSelectValue('monthFilter', state.month);
    if (typeof activeCategory !== 'undefined') activeCategory = state.activeCategory || 'all';
    if (typeof renderCategoryCards === 'function') renderCategoryCards();
    applyListFilters(true);
    requestAnimationFrame(() => {
      const wrap = getTableWrap();
      if (wrap) {
        wrap.scrollTop = state.scrollTop || 0;
        wrap.scrollLeft = state.scrollLeft || 0;
      }
      window.scrollTo({ top: state.windowY || 0, left: 0, behavior: 'auto' });
      if (state.idCode) highlightVisibleRow(state.idCode);
    });
  }

  function highlightVisibleRow(idCode) {
    document.querySelectorAll('#dataTable tr').forEach(row => {
      if (!row.textContent.includes(idCode)) return;
      row.style.background = '#e0f4f1';
      setTimeout(() => { row.style.background = ''; }, 2500);
    });
  }

  function ensureCalibrationStatusField() {
    if (document.getElementById('iCalStatus')) return;
    const dueInput = document.getElementById('iDueDate');
    const dueGroup = dueInput?.closest('div');
    const field = document.createElement('div');
    field.id = 'iCalStatusGroup';
    field.innerHTML = `
      <label>สถานะสอบเทียบ</label>
      <select id="iCalStatus" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:var(--radius);font-family:var(--font);font-size:13px;color:var(--text);background:var(--surface);outline:none">
        <option value="active">ใช้งาน / รอสอบเทียบ</option>
        <option value="cancelled">ยกเลิกสอบเทียบ</option>
      </select>
    `;
    if (dueGroup?.parentNode) dueGroup.insertAdjacentElement('afterend', field);
    else document.querySelector('#instrumentModal .modal-body')?.appendChild(field);
  }

  // หมายเหตุ: ตารางหน้า list แสดงสถานะยกเลิกสอบเทียบเองใน renderTable (02-dashboard.js)
  function cleanRenderedMobileCards() {
    const rows = window._mobileRows || [];
    document.querySelectorAll('#mobileCardList .mobile-card').forEach((card, index) => {
      const item = rows[index];
      if (!item || !isCalibrationCancelled(item)) return;
      const badge = card.querySelector('.mobile-badge');
      if (badge) {
        badge.textContent = CANCEL_LABEL;
        badge.className = 'mobile-badge';
        badge.style.background = '#eef0f3';
        badge.style.color = '#5f6b7a';
      }
      card.querySelectorAll('.mobile-field').forEach(field => {
        const strong = field.querySelector('strong');
        if (!strong) return;
        if (field.textContent.includes('ครบกำหนด')) strong.textContent = CANCEL_LABEL;
        if (field.textContent.includes('คงเหลือ')) strong.textContent = '-';
      });
      const planBadge = card.querySelector('.mobile-plan-badge');
      if (planBadge) {
        planBadge.textContent = CANCEL_LABEL;
        planBadge.style.background = '#eef0f3';
        planBadge.style.color = '#5f6b7a';
      }
      const primaryAction = card.querySelector('.mobile-card-action.primary');
      if (primaryAction) {
        primaryAction.textContent = 'ยกเลิกแล้ว';
        primaryAction.disabled = true;
        primaryAction.onclick = null;
        primaryAction.style.opacity = '.7';
        primaryAction.style.cursor = 'not-allowed';
      }
    });
  }

  window.isCalibrationCancelled = isCalibrationCancelled;
  window.stripCalibrationCancelMarker = stripCalibrationCancelMarker;

  const originalUpdateStats = typeof updateStats === 'function' ? updateStats : null;
  if (originalUpdateStats) {
    updateStats = window.updateStats = function(...args) {
      normalizeRows(allData);
      normalizeRows(filteredData);
      return originalUpdateStats.apply(this, args);
    };
  }

  const originalUpdatePaginationUI = typeof updatePaginationUI === 'function' ? updatePaginationUI : null;
  if (originalUpdatePaginationUI) {
    updatePaginationUI = window.updatePaginationUI = function(...args) {
      const total = Array.isArray(filteredData) ? filteredData.length : 0;
      if (total === 0) {
        const info = document.getElementById('paginationInfo');
        const pageNum = document.getElementById('pageNum');
        const prev = document.getElementById('btnPrev');
        const next = document.getElementById('btnNext');
        if (info) info.textContent = 'แสดง 0 จาก 0 รายการ';
        if (pageNum) pageNum.textContent = 'หน้า 0 / 0';
        if (prev) prev.disabled = true;
        if (next) next.disabled = true;
        return;
      }
      const size = typeof pageSize === 'number' && pageSize > 0 ? pageSize : 100;
      const totalPages = Math.max(1, Math.ceil(total / size));
      currentPage = Math.min(Math.max(currentPage || 1, 1), totalPages);
      return originalUpdatePaginationUI.apply(this, args);
    };
  }

  const originalRenderTable = typeof renderTable === 'function' ? renderTable : null;
  if (originalRenderTable) {
    renderTable = window.renderTable = function(...args) {
      normalizeRows(allData);
      normalizeRows(filteredData);
      return originalRenderTable.apply(this, args);
    };
  }

  const originalRenderMobileCards = typeof renderMobileCards === 'function' ? renderMobileCards : null;
  if (originalRenderMobileCards) {
    renderMobileCards = window.renderMobileCards = function(...args) {
      normalizeRows(filteredData);
      const result = originalRenderMobileCards.apply(this, args);
      cleanRenderedMobileCards();
      return result;
    };
  }

  const originalRenderDonut = typeof renderDonut === 'function' ? renderDonut : null;
  if (originalRenderDonut) {
    renderDonut = window.renderDonut = function(...args) {
      normalizeRows(allData);
      return originalRenderDonut.apply(this, args);
    };
  }

  const originalRenderAlerts = typeof renderAlerts === 'function' ? renderAlerts : null;
  if (originalRenderAlerts) {
    renderAlerts = window.renderAlerts = function(...args) {
      normalizeRows(allData);
      return originalRenderAlerts.apply(this, args);
    };
  }

  filterData = window.filterData = function() {
    applyListFilters(false);
  };

  const originalResetFilters = typeof resetFilters === 'function' ? resetFilters : null;
  if (originalResetFilters) {
    resetFilters = window.resetFilters = function(...args) {
      const result = originalResetFilters.apply(this, args);
      ensureCancelStatusFilterOption();
      normalizeRows(allData);
      normalizeRows(filteredData);
      return result;
    };
  }

  const originalOpenInstrumentModal = typeof openInstrumentModal === 'function' ? openInstrumentModal : null;
  if (originalOpenInstrumentModal) {
    openInstrumentModal = window.openInstrumentModal = function(instrumentId, ...args) {
      const result = originalOpenInstrumentModal.call(this, instrumentId, ...args);
      ensureCalibrationStatusField();
      const item = Array.isArray(allData) ? allData.find(row => String(row.id) === String(instrumentId)) : null;
      const statusEl = document.getElementById('iCalStatus');
      const remarkEl = document.getElementById('iRemark');
      if (statusEl) statusEl.value = item && isCalibrationCancelled(item) ? 'cancelled' : 'active';
      if (remarkEl) remarkEl.value = stripCalibrationCancelMarker(item?.remark || remarkEl.value || '');
      return result;
    };
  }

  const originalSaveInstrument = typeof saveInstrument === 'function' ? saveInstrument : null;
  if (originalSaveInstrument) {
    saveInstrument = window.saveInstrument = async function(...args) {
      const listState = captureListState();
      const statusEl = document.getElementById('iCalStatus');
      const remarkEl = document.getElementById('iRemark');
      const cleanRemark = stripCalibrationCancelMarker(remarkEl?.value || '');
      if (remarkEl) remarkEl.value = buildCalibrationRemark(cleanRemark, statusEl?.value);

      const currentLoadData = typeof loadData === 'function' ? loadData : null;
      if (currentLoadData) {
        loadData = window.loadData = async function(...loadArgs) {
          const result = await currentLoadData.apply(this, loadArgs);
          restoreListState(listState);
          return result;
        };
      }

      try {
        return await originalSaveInstrument.apply(this, args);
      } finally {
        if (currentLoadData) loadData = window.loadData = currentLoadData;
        const modalOpen = document.getElementById('instrumentModal')?.classList.contains('open');
        if (modalOpen && remarkEl) remarkEl.value = cleanRemark;
      }
    };
  }

  const originalLoadData = typeof loadData === 'function' ? loadData : null;
  if (originalLoadData) {
    loadData = window.loadData = async function(...args) {
      ensureCancelStatusFilterOption();
      const result = await originalLoadData.apply(this, args);
      ensureCancelStatusFilterOption();
      normalizeRows(allData);
      normalizeRows(filteredData);
      cleanRenderedMobileCards();
      return result;
    };
  }

  ensureCancelStatusFilterOption();
})();

(function init() {
  const session = getSession();
  if (session) {
    currentUser = session;
    enterApp(session);
  } else {
    document.body.classList.add('login-mode');
    document.body.classList.remove('app-mode');
    document.getElementById('loginPage')?.style.setProperty('display', 'grid', 'important');
    document.getElementById('app')?.style.setProperty('display', 'none', 'important');
  }
})();
