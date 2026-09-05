/* ============================================================
   29-calibration-work.js — pure calibration work-batch helpers
   ============================================================ */
(function exposeCalibrationWorkHelpers(global) {
  'use strict';

  const PDF_MAX_BYTES = 52428800;
  const CW_DOCUMENT_BUCKET = 'calibration-work-batches';
  const CW_SIGNED_URL_SECONDS = 60;
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const BATCH_DOCUMENT_KINDS = new Set(['acknowledgement', 'closure']);
  const ITEM_DOCUMENT_KINDS = new Set(['certificate', 'overdue']);

  const CW_STATUS = Object.freeze({
    draft: Object.freeze({ label: 'ร่าง', color: '#64748B' }),
    awaiting_acknowledgement_pdf: Object.freeze({ label: 'รอ PDF รับทราบแผน', color: '#B45309' }),
    awaiting_calibration: Object.freeze({ label: 'รอสอบเทียบ', color: '#2563EB' }),
    partially_completed: Object.freeze({ label: 'ดำเนินการบางส่วน', color: '#7C3AED' }),
    awaiting_closure_pdf: Object.freeze({ label: 'รอแนบแผนยืนยัน', color: '#C2410C' }),
    completed: Object.freeze({ label: 'สอบเทียบสำเร็จ', color: '#15803D' }),
    cancelled: Object.freeze({ label: 'ยกเลิกชุดงาน', color: '#B91C1C' }),
    in_progress: Object.freeze({ label: 'กำลังสอบเทียบ', color: '#0F766E' }),
    overdue: Object.freeze({ label: 'เกินแผนสอบเทียบ', color: '#DC2626' }),
    skipped: Object.freeze({ label: 'ไม่ได้ดำเนินการ', color: '#6B7280' })
  });

  function cwTodayISO(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date instanceof Date ? date : new Date());
    const part = type => parts.find(value => value.type === type).value;
    return part('year') + '-' + part('month') + '-' + part('day');
  }

  function cwItemDisplayStatus(item, todayISO) {
    const source = item || {};
    const stored = source.result_status || 'in_progress';
    if (stored === 'completed' || stored === 'skipped') return stored;
    const today = todayISO || cwTodayISO();
    if (stored === 'in_progress'
        && source.is_active !== false
        && /^\d{4}-\d{2}-\d{2}$/.test(source.planned_date || '')
        && source.planned_date < today) {
      return 'overdue';
    }
    return stored;
  }

  function cwItemRequirements(item, todayISO, documents) {
    const source = item || {};
    if (source.result_status === 'skipped') {
      return { certificateRequired: false, overdueRequired: false, missing: [], displayOverdue: false };
    }
    const rows = Array.isArray(documents) ? documents
      : Array.isArray(source.documents) ? source.documents : [];
    const current = kind => rows.some(documentRow => documentRow
      && documentRow.item_id === source.id && documentRow.document_kind === kind
      && documentRow.is_current === true);
    const calibrationDate = String(source.calibration_date || '');
    const plannedDate = String(source.planned_date || '');
    const calibrationValid = cwValidISODate(calibrationDate);
    const plannedValid = cwValidISODate(plannedDate);
    const overdueRequired = calibrationValid && plannedValid && calibrationDate > plannedDate;
    const missing = [];
    if (!String(source.cert_no || '').trim()) missing.push('cert_no');
    if (!calibrationValid) missing.push('calibration_date');
    if (!current('certificate')) missing.push('certificate');
    if (overdueRequired && !String(source.overdue_reason || '').trim()) missing.push('overdue_reason');
    if (overdueRequired && !current('overdue')) missing.push('overdue');
    const today = todayISO || cwTodayISO();
    const displayOverdue = source.result_status === 'in_progress' && source.is_active !== false
      && plannedValid && plannedDate < today
      && (!calibrationValid || calibrationDate > plannedDate);
    return { certificateRequired: true, overdueRequired, missing, displayOverdue };
  }

  function cwBatchDerivedStatus(batch, items, docs) {
    const stored = batch && batch.status;
    const preserved = new Set([
      'draft', 'awaiting_acknowledgement_pdf', 'awaiting_closure_pdf',
      'completed', 'cancelled'
    ]);
    if (preserved.has(stored)) return stored;
    if (stored !== 'awaiting_calibration' && stored !== 'partially_completed') return stored;

    const activeItems = (Array.isArray(items) ? items : []).filter(item => item && item.is_active !== false);
    if (activeItems.length === 0) return 'awaiting_calibration';
    const resolved = activeItems.filter(item => item.result_status === 'completed' || item.result_status === 'skipped').length;
    if (resolved === activeItems.length) return 'awaiting_closure_pdf';
    if (resolved > 0) return 'partially_completed';
    void docs;
    return 'awaiting_calibration';
  }

  function cwValidatePdf(file) {
    if (!file) return 'กรุณาเลือกไฟล์ PDF';
    if (!/\.pdf$/i.test(String(file.name || '')) || String(file.type || '').toLowerCase() !== 'application/pdf') {
      return 'รองรับเฉพาะไฟล์ PDF เท่านั้น';
    }
    if (!Number.isFinite(file.size) || file.size <= 0) return 'ไฟล์ PDF ต้องมีขนาดมากกว่า 0 ไบต์';
    if (file.size > PDF_MAX_BYTES) return 'ไฟล์ PDF ต้องมีขนาดไม่เกิน 50 MB';
    return null;
  }

  function cwDocumentPath(batchId, itemId, kind, version) {
    if (!UUID_PATTERN.test(batchId || '')) throw new Error('Invalid batch UUID');
    if (!BATCH_DOCUMENT_KINDS.has(kind) && !ITEM_DOCUMENT_KINDS.has(kind)) {
      throw new Error('Invalid document kind');
    }
    if (!Number.isInteger(version) || version < 1 || version > 9999) {
      throw new Error('Invalid document version');
    }
    const filename = 'v' + String(version).padStart(4, '0') + '.pdf';
    if (BATCH_DOCUMENT_KINDS.has(kind)) {
      if (itemId != null) throw new Error('Batch document must not have an item UUID');
      return batchId + '/batch/' + kind + '/' + filename;
    }
    if (!UUID_PATTERN.test(itemId || '')) throw new Error('Item document requires a valid item UUID');
    return batchId + '/items/' + itemId + '/' + kind + '/' + filename;
  }

  const CW_TABS = Object.freeze([
    Object.freeze({ key: 'active', label: 'กำลังดำเนินการ' }),
    Object.freeze({ key: 'waiting', label: 'คิวรอดำเนินการ' }),
    Object.freeze({ key: 'completed', label: 'เสร็จสิ้น' }),
    Object.freeze({ key: 'history', label: 'เสร็จสิ้นและยกเลิก' })
  ]);
  const CW_PRIMARY_TABS = Object.freeze(['select', 'batches', 'waiting', 'history']);
  const CW_READ_PAGE_SIZE = 200;
  const cwUiState = {
    model: { batches: [], locks: [], locksReady: false }, tab: 'active', openBatchId: null,
    loadGeneration: 0, notificationFilter: null, registryReturnInstrumentId: null,
    batchReturnFocus: null
  };
  const cwWizardState = {
    mode: 'create', step: 1, title: '', unitCode: '', instrumentType: '', search: '',
    selected: new Map(), batchId: null, expectedUpdatedAt: null, hadAcknowledgement: false,
    currentAcknowledgement: false, submitting: false, returnFocus: null,
    returnPrimaryTab: null, returnDashboardTab: null
  };
  const cwDocumentState = {
    batchId: null, itemId: null, kind: null, file: null, replacementReason: '',
    busy: false, progress: '', returnFocus: null
  };
  const cwDocumentUploads = new Set();
  const cwItemResultState = {
    batchId: null, itemId: null, certNo: '', calibrationDate: '', overdueReason: '',
    busy: false, returnFocus: null, focusId: null
  };
  const cwItemMutations = new Set();
  const calibrationWorkStatusMap = global.calibrationWorkStatusMap || {};
  global.calibrationWorkStatusMap = calibrationWorkStatusMap;
  let cwIntegrationLoadGeneration = 0;
  let cwNotificationState = {
    awaitingAcknowledgement: 0, dueToday: 0, overdueMissingEvidence: 0, awaitingClosure: 0,
    batchIds: { awaiting_acknowledgement: [], due_today: [], overdue_missing_evidence: [], awaiting_closure: [] }
  };

  function cwEscapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cwActor() {
    if (typeof currentUser !== 'undefined' && currentUser) return currentUser;
    return global.currentUser || null;
  }

  function cwRegistry() {
    if (typeof allData !== 'undefined' && Array.isArray(allData)) return allData;
    return Array.isArray(global.allData) ? global.allData : [];
  }

  function cwCanManage() {
    const role = cwActor() && cwActor().role;
    return role === 'admin' || role === 'editor';
  }

  function cwCanCreate() {
    return cwCanManage() && global.registryDataReady === true
      && cwUiState.model.locksReady === true;
  }

  function cwResolveClient(client) {
    if (client) return client;
    if (typeof sb !== 'undefined') return sb;
    return global.sb || null;
  }

  function cwValidISODate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const date = new Date(value + 'T00:00:00.000Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function cwSetCreateAccess() {
    const button = document.getElementById('cwCreateButton');
    const allowed = cwCanCreate();
    if (button) button.hidden = !allowed;
    const selectButton = document.querySelector('#cwPrimaryTabs [data-cw-primary="select"]');
    if (selectButton) {
      selectButton.disabled = !allowed;
      selectButton.setAttribute('aria-disabled', String(!allowed));
    }
  }

  function cwActiveItems(batch) {
    return (Array.isArray(batch && batch.items) ? batch.items : [])
      .filter(item => item && item.is_active !== false);
  }

  function cwBatchStatus(batch) {
    return cwBatchDerivedStatus(batch || {}, cwActiveItems(batch), batch && batch.documents || []);
  }

  function cwProgress(batch) {
    const items = cwActiveItems(batch);
    const completed = items.filter(item => item.result_status === 'completed' || item.result_status === 'skipped').length;
    return {
      completed,
      total: items.length,
      percent: items.length ? Math.round(completed * 100 / items.length) : 0
    };
  }

  function cwCurrentDocument(batch, kind) {
    return (batch.documents || []).find(documentRow =>
      documentRow && documentRow.item_id == null
      && documentRow.document_kind === kind && documentRow.is_current === true) || null;
  }

  function cwTabBatches(key) {
    const batches = cwUiState.model.batches || [];
    return batches.filter(batch => {
      const status = cwBatchStatus(batch);
      if (key === 'active') return status !== 'completed' && status !== 'cancelled';
      if (key === 'waiting') return [
        'awaiting_acknowledgement_pdf', 'awaiting_calibration',
        'partially_completed', 'awaiting_closure_pdf'
      ].includes(status);
      if (key === 'completed') return status === 'completed';
      if (key === 'history') return status === 'completed' || status === 'cancelled';
      return true;
    });
  }

  let cwPrimaryTab = 'batches';

  const CW_PRIMARY_TO_DASHBOARD = Object.freeze({
    batches: 'active', waiting: 'waiting', history: 'history'
  });

  function cwPrimaryForDashboardTab(tab) {
    if (tab === 'waiting') return 'waiting';
    if (tab === 'history' || tab === 'completed') return 'history';
    return 'batches';
  }

  function cwRenderPrimaryTabs() {
    const root = document.getElementById('cwPrimaryTabs');
    if (!root) return;
    [...root.querySelectorAll('[data-cw-primary]')].forEach(tab => {
      const selected = tab.dataset.cwPrimary === cwPrimaryTab;
      tab.setAttribute('aria-pressed', String(selected));
      tab.classList.toggle('is-active', selected);
    });
  }

  function cwSyncPrimaryState(tab, dashboardTab) {
    const next = CW_PRIMARY_TABS.includes(tab) ? tab : 'batches';
    cwPrimaryTab = next;
    if (next !== 'select') {
      cwUiState.tab = CW_TABS.some(item => item.key === dashboardTab)
        ? dashboardTab : CW_PRIMARY_TO_DASHBOARD[next];
    }
    cwRenderPrimaryTabs();
    return next;
  }

  function cwSetPrimaryTab(tab) {
    if (!CW_PRIMARY_TABS.includes(tab)) return false;
    if (tab === 'select') {
      const previousPrimaryTab = cwPrimaryTab;
      const previousDashboardTab = cwUiState.tab;
      if (!cwOpenCreate()) {
        cwPrimaryTab = previousPrimaryTab;
        cwUiState.tab = previousDashboardTab;
        cwRenderPrimaryTabs();
        return false;
      }
      cwWizardState.returnPrimaryTab = previousPrimaryTab;
      cwWizardState.returnDashboardTab = previousDashboardTab;
      cwSyncPrimaryState('select');
      return true;
    }
    cwSyncPrimaryState(tab);
    cwRenderTabs();
    cwRenderBatchList();
    return true;
  }

  function cwHandlePrimaryTabKey(event) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!event || !keys.includes(event.key)) return;
    const currentKey = event.currentTarget && event.currentTarget.dataset.cwPrimary;
    let index = CW_PRIMARY_TABS.indexOf(currentKey);
    if (index < 0) return;
    if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = CW_PRIMARY_TABS.length - 1;
    else if (event.key === 'ArrowRight') index = (index + 1) % CW_PRIMARY_TABS.length;
    else index = (index - 1 + CW_PRIMARY_TABS.length) % CW_PRIMARY_TABS.length;
    event.preventDefault();
    const nextKey = CW_PRIMARY_TABS[index];
    const selected = cwSetPrimaryTab(nextKey);
    const nextTab = document.querySelector('#cwPrimaryTabs [data-cw-primary="' + nextKey + '"]');
    const dialogOpen = nextKey === 'select'
      && document.getElementById('cwCreateDialog')?.classList.contains('open');
    if (selected && nextTab && !dialogOpen) nextTab.focus();
  }

  function cwRenderTabs() {
    const root = document.getElementById('cwTabs');
    if (!root) return;
    root.innerHTML = CW_TABS.map(tab => {
      const selected = cwUiState.tab === tab.key;
      const total = cwTabBatches(tab.key).length;
      return '<button type="button" class="cw-tab' + (selected ? ' is-active' : '') + '"'
        + ' aria-pressed="' + selected + '"'
        + ' data-cw-tab="' + tab.key + '" data-count="' + total + '"'
        + ' onclick="cwSetDashboardTab(this.dataset.cwTab)" onkeydown="cwHandleTabKey(event)">'
        + '<span>' + tab.label + '</span><strong>' + total + '</strong></button>';
    }).join('');
  }

  function cwRenderMetrics() {
    const root = document.getElementById('cwMetrics');
    if (!root) return;
    const active = cwTabBatches('active');
    const items = active.flatMap(cwActiveItems);
    const completed = items.filter(item => item.result_status === 'completed' || item.result_status === 'skipped').length;
    const today = cwTodayISO();
    const overdue = items.filter(item => cwItemDisplayStatus(item, today) === 'overdue').length;
    const awaitingClosure = active.filter(batch => cwBatchStatus(batch) === 'awaiting_closure_pdf').length;
    const metrics = [
      { value: active.length, label: 'ชุดงานกำลังดำเนินการ' },
      { value: completed + ' / ' + items.length, label: 'เครื่องเสร็จ' },
      { value: overdue, label: 'เครื่องเกินแผน' },
      { value: awaitingClosure, label: 'ชุดรอ PDF ปิดแผน' }
    ];
    root.innerHTML = metrics.map(metric => '<article class="cw-metric"><strong>'
      + metric.value + '</strong> <span>' + metric.label + '</span></article>').join('');
  }

  function cwBatchCardMarkup(batch) {
    const progress = cwProgress(batch);
    const status = cwBatchStatus(batch);
    const statusMeta = CW_STATUS[status] || { label: status || 'ไม่ทราบสถานะ', color: '#64748B' };
    const ack = cwCurrentDocument(batch, 'acknowledgement');
    const closure = cwCurrentDocument(batch, 'closure');
    const ackText = ack ? 'รับทราบแล้ว' : 'รอ PDF รับทราบ';
    const closureText = closure ? 'มี PDF ปิดแผน'
      : status === 'awaiting_closure_pdf' ? 'รอ PDF ปิดแผน' : 'ยังไม่ถึงขั้นปิดแผน';
    const body = '<span class="cw-card-top"><span><b>' + cwEscapeHtml(batch.batch_no || '–') + '</b>'
      + '<small>' + cwEscapeHtml(batch.title || 'ไม่มีชื่อชุดงาน') + '</small></span>'
      + '<span class="cw-status" style="--cw-status:' + statusMeta.color + '">' + cwEscapeHtml(statusMeta.label) + '</span></span>'
      + '<span class="cw-card-meta"><span>' + cwEscapeHtml(batch.unit_code || '–') + '</span><span>'
      + cwEscapeHtml(batch.instrument_type || '–') + '</span></span>'
      + '<span class="cw-progress-label"><span>ความคืบหน้า</span><b>' + progress.completed + ' / ' + progress.total + '</b></span>'
      + '<span class="cw-progress" aria-label="ความคืบหน้า ' + progress.percent + '%"><span style="width:' + progress.percent + '%"></span></span>'
      + '<span class="cw-doc-gates"><span>' + ackText + '</span><span>' + closureText + '</span></span>';
    if (!UUID_PATTERN.test(batch.id || '')) return '<article class="cw-batch-card cw-batch-card--invalid">' + body + '</article>';
    return '<button type="button" class="cw-batch-card" data-batch-id="' + batch.id
      + '" onclick="cwOpenBatch(this.dataset.batchId)" aria-label="เปิดชุดงาน '
      + cwEscapeHtml(batch.batch_no || '') + '">' + body + '</button>';
  }

  function cwRenderBatchList() {
    const root = document.getElementById('cwBatchList');
    if (!root) return;
    const batches = cwTabBatches(cwUiState.tab)
      .filter(batch => cwNotificationBatchMatch(batch, cwUiState.notificationFilter));
    if (!batches.length) {
      root.innerHTML = '<div class="cw-state" role="status"><strong>ยังไม่มีชุดงานสอบเทียบ</strong><span>ไม่พบรายการในมุมมองนี้</span></div>';
      return;
    }
    root.innerHTML = batches.map(cwBatchCardMarkup).join('');
  }

  function cwShowDashboardSurface() {
    const notifications = document.getElementById('cwNotifications');
    const tabs = document.getElementById('cwTabs');
    const metrics = document.getElementById('cwMetrics');
    const list = document.getElementById('cwBatchList');
    const detail = document.getElementById('cwBatchDetail');
    if (notifications) notifications.hidden = false;
    if (tabs) tabs.hidden = false;
    if (metrics) metrics.hidden = false;
    if (list) list.hidden = false;
    if (detail) detail.hidden = true;
  }

  function cwRenderDashboard(model, options) {
    const hasLocks = Boolean(model && Array.isArray(model.locks));
    cwUiState.model = model && Array.isArray(model.batches)
      ? { ...model, locks: hasLocks ? model.locks : [], locksReady: hasLocks && model.locksReady !== false }
      : { batches: [], locks: [], locksReady: false };
    cwUiState.notificationFilter = null;
    cwUiState.openBatchId = null;
    cwShowDashboardSurface();
    const primaryTab = options && options.primaryTab;
    cwSyncPrimaryState(primaryTab || 'batches');
    cwSetCreateAccess();
    const list = document.getElementById('cwBatchList');
    if (model && model.error) {
      const tabs = document.getElementById('cwTabs');
      const metrics = document.getElementById('cwMetrics');
      if (tabs) tabs.innerHTML = '';
      if (metrics) metrics.innerHTML = '';
      if (list) list.innerHTML = '<div class="cw-state cw-state--error" role="alert"><strong>โหลดข้อมูลไม่สำเร็จ</strong><span>'
        + cwEscapeHtml(model.error) + '</span></div>';
      return;
    }
    cwRenderTabs();
    cwRenderMetrics();
    cwRenderBatchList();
  }

  function cwSetDashboardTab(tab) {
    if (!CW_TABS.some(item => item.key === tab)) return;
    cwSyncPrimaryState(cwPrimaryForDashboardTab(tab));
    cwUiState.tab = tab;
    cwUiState.notificationFilter = null;
    cwRenderTabs();
    cwRenderBatchList();
  }

  function cwHandleTabKey(event) {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!event || !keys.includes(event.key)) return;
    const currentKey = event.currentTarget && event.currentTarget.dataset.cwTab;
    let index = CW_TABS.findIndex(tab => tab.key === currentKey);
    if (index < 0) return;
    if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = CW_TABS.length - 1;
    else if (event.key === 'ArrowRight') index = (index + 1) % CW_TABS.length;
    else index = (index - 1 + CW_TABS.length) % CW_TABS.length;
    event.preventDefault();
    const nextKey = CW_TABS[index].key;
    cwSetDashboardTab(nextKey);
    const nextTab = document.querySelector('#cwTabs [data-cw-tab="' + nextKey + '"]');
    if (nextTab) nextTab.focus();
  }

  function cwNormalizeReadModel(batches, items, locks, documents, audit) {
    const byBatch = new Map((batches || []).map(batch => [batch.id, {
      ...batch, items: [], documents: [], audit: []
    }]));
    (items || []).forEach(item => { if (byBatch.has(item.batch_id)) byBatch.get(item.batch_id).items.push(item); });
    (documents || []).forEach(documentRow => {
      if (byBatch.has(documentRow.batch_id)) byBatch.get(documentRow.batch_id).documents.push(documentRow);
    });
    (audit || []).forEach(event => { if (byBatch.has(event.batch_id)) byBatch.get(event.batch_id).audit.push(event); });
    return { batches: [...byBatch.values()], locks: Array.isArray(locks) ? locks : [], locksReady: true };
  }

  function cwSortReadRows(rows, orderColumn, ascending) {
    return rows.sort((left, right) => {
      const comparison = String(left[orderColumn] || '').localeCompare(String(right[orderColumn] || ''));
      if (comparison) return ascending ? comparison : -comparison;
      return String(left.id || '').localeCompare(String(right.id || ''));
    });
  }

  async function cwReadTable(client, table, columns, orderColumn, ascending, cursorColumn) {
    const rows = [];
    const cursor = cursorColumn || 'id';
    let afterValue = null;
    while (true) {
      let query = client.from(table).select(columns).order(cursor, { ascending: true });
      if (afterValue != null) query = query.gt(cursor, afterValue);
      const response = await query.limit(CW_READ_PAGE_SIZE);
      if (response.error) throw new Error(response.error.message || 'Supabase query failed');
      const page = response.data || [];
      rows.push(...page);
      if (page.length < CW_READ_PAGE_SIZE) break;
      const nextValue = page[page.length - 1] && page[page.length - 1][cursor];
      if (nextValue == null || nextValue === afterValue) throw new Error('Invalid calibration work pagination cursor');
      afterValue = nextValue;
    }
    return cwSortReadRows(rows, orderColumn, ascending);
  }

  function cwIntegrationModel(batches, items, locks, documents) {
    return cwNormalizeReadModel(batches, items, locks, documents, []);
  }

  async function cwReadIntegrationSnapshot(source) {
    if (!source || typeof source.from !== 'function') throw new Error('ยังไม่พร้อมเชื่อมต่อฐานข้อมูล');
    const [batches, items, locks, documents] = await Promise.all([
      cwReadTable(source, 'calibration_work_batches', '*', 'updated_at', false),
      cwReadTable(source, 'calibration_work_items', '*', 'created_at', true),
      cwReadTable(source, 'calibration_work_instrument_locks', '*', 'instrument_id', true, 'instrument_id'),
      cwReadTable(source, 'calibration_work_documents', '*', 'uploaded_at', false)
    ]);
    return cwIntegrationModel(batches, items, locks, documents);
  }

  function cwBuildCalibrationWorkStatusMap(model, todayISO) {
    const next = {};
    const chosen = {};
    const today = todayISO || cwTodayISO();
    const batches = new Map((model && model.batches || []).map(batch => [batch.id, batch]));
    const locks = new Map((model && model.locks || []).map(lock => [String(lock.instrument_id), lock]));
    batches.forEach(batch => {
      if (!batch || ['draft', 'cancelled'].includes(batch.status)) return;
      const closed = batch.status === 'completed';
      (batch.items || []).forEach(item => {
        const instrumentId = cwInstrumentId(item && item.instrument_id);
        if (instrumentId == null || item.is_active === false || item.result_status === 'skipped') return;
        if (!closed) {
          const lock = locks.get(String(instrumentId));
          if (!lock || lock.batch_id !== batch.id) return;
        }
        let status = null;
        if (item.result_status === 'completed') status = 'completed';
        else if (item.result_status === 'in_progress') {
          const displayStatus = cwItemDisplayStatus(item, today);
          status = displayStatus === 'overdue' ? 'overdue'
            : (batch.status === 'awaiting_acknowledgement_pdf' ? 'awaiting_acknowledgement_pdf' : displayStatus);
        }
        if (!status || (closed && status !== 'completed')) return;
        const candidate = {
          batchId: batch.id,
          batchNo: String(batch.batch_no || ''),
          title: String(batch.title || ''),
          plannedDate: String(item.planned_date || ''),
          status,
          isActive: !closed
        };
        const priority = closed ? 1 : 2;
        const updatedAt = String(batch.updated_at || '');
        const batchId = String(batch.id || '');
        const current = chosen[instrumentId];
        if (!current || priority > current.priority
            || (priority === current.priority && updatedAt > current.updatedAt)
            || (priority === current.priority && updatedAt === current.updatedAt && batchId > current.batchId)) {
          chosen[instrumentId] = { priority, updatedAt, batchId };
          next[instrumentId] = candidate;
        }
      });
    });
    return next;
  }

  function cwReplaceStatusMap(next) {
    Object.keys(calibrationWorkStatusMap).forEach(key => { delete calibrationWorkStatusMap[key]; });
    Object.assign(calibrationWorkStatusMap, next || {});
    global.calibrationWorkStatusMap = calibrationWorkStatusMap;
  }

  function cwNotificationSummary(model, todayISO) {
    const today = todayISO || cwTodayISO();
    const summary = {
      awaitingAcknowledgement: 0, dueToday: 0, overdueMissingEvidence: 0, awaitingClosure: 0,
      batchIds: { awaiting_acknowledgement: [], due_today: [], overdue_missing_evidence: [], awaiting_closure: [] }
    };
    const lockByInstrument = new Map((model && model.locks || []).map(lock => [String(lock.instrument_id), lock]));
    (model && model.batches || []).forEach(batch => {
      if (!batch || ['draft', 'completed', 'cancelled'].includes(batch.status)) return;
      const activeItems = (batch.items || []).filter(item => {
        if (!item || item.is_active === false) return false;
        const lock = lockByInstrument.get(String(item.instrument_id));
        return Boolean(lock && lock.batch_id === batch.id);
      });
      if (!activeItems.length) return;
      if (batch.status === 'awaiting_acknowledgement_pdf') {
        summary.awaitingAcknowledgement += 1;
        summary.batchIds.awaiting_acknowledgement.push(batch.id);
      }
      if (batch.status === 'awaiting_closure_pdf') {
        summary.awaitingClosure += 1;
        summary.batchIds.awaiting_closure.push(batch.id);
      }
      let dueInBatch = false;
      let missingInBatch = false;
      activeItems.forEach(item => {
        if (item.result_status !== 'in_progress') return;
        if (item.planned_date === today) {
          summary.dueToday += 1;
          dueInBatch = true;
        }
        if (cwItemDisplayStatus(item, today) !== 'overdue') return;
        const currentOverdue = (batch.documents || []).some(documentRow => documentRow
          && documentRow.item_id === item.id && documentRow.document_kind === 'overdue'
          && documentRow.is_current === true);
        if (!String(item.overdue_reason || '').trim() || !currentOverdue) {
          summary.overdueMissingEvidence += 1;
          missingInBatch = true;
        }
      });
      if (dueInBatch) summary.batchIds.due_today.push(batch.id);
      if (missingInBatch) summary.batchIds.overdue_missing_evidence.push(batch.id);
    });
    return summary;
  }

  function cwRenderNotifications(summary) {
    const root = document.getElementById('cwNotifications');
    if (!root) return;
    const rows = [
      ['awaiting_acknowledgement', 'รอ PDF รับทราบ', summary.awaitingAcknowledgement],
      ['due_today', 'ครบกำหนดวันนี้', summary.dueToday],
      ['overdue_missing_evidence', 'เกินแผนขาดหลักฐาน', summary.overdueMissingEvidence],
      ['awaiting_closure', 'รอ PDF ปิดแผน', summary.awaitingClosure]
    ];
    root.innerHTML = rows.map(row => '<button type="button" class="cw-notification" data-cw-notification="'
      + row[0] + '" onclick="cwOpenNotification(this.dataset.cwNotification)"><span>'
      + row[1] + '</span><strong>' + row[2] + '</strong></button>').join('');
  }

  function cwPublishPlanBadge(model) {
    const count = (model && model.batches || []).filter(batch => {
      const status = cwBatchStatus(batch);
      return status !== 'completed' && status !== 'cancelled';
    }).length;
    const badge = document.getElementById('navPlanBadge');
    if (badge) {
      badge.textContent = String(count);
      badge.style.display = count > 0 ? '' : 'none';
    }
    if (typeof global.renderDashTodo === 'function') global.renderDashTodo();
    return count;
  }

  async function cwLoadNotifications(sourceOrModel, todayISO) {
    const generation = ++cwIntegrationLoadGeneration;
    if (sourceOrModel && Array.isArray(sourceOrModel.batches) && Array.isArray(sourceOrModel.locks)) {
      if (generation !== cwIntegrationLoadGeneration) return { ...cwNotificationState, available: false };
      cwNotificationState = cwNotificationSummary(sourceOrModel, todayISO);
      cwRenderNotifications(cwNotificationState);
      cwPublishPlanBadge(sourceOrModel);
      return cwNotificationState;
    }
    try {
      const source = cwResolveClient(sourceOrModel);
      const model = await cwReadIntegrationSnapshot(source);
      if (generation !== cwIntegrationLoadGeneration) return { ...cwNotificationState, available: false };
      cwNotificationState = cwNotificationSummary(model, todayISO);
      cwRenderNotifications(cwNotificationState);
      cwPublishPlanBadge(model);
      return cwNotificationState;
    } catch (_error) {
      return { ...cwNotificationState, available: false };
    }
  }

  function cwPublishCalibrationWorkIntegration(model, todayISO, generation) {
    const publicationGeneration = generation == null ? ++cwIntegrationLoadGeneration : generation;
    if (publicationGeneration !== cwIntegrationLoadGeneration) return false;
    cwReplaceStatusMap(cwBuildCalibrationWorkStatusMap(model, todayISO));
    cwNotificationState = cwNotificationSummary(model, todayISO);
    cwRenderNotifications(cwNotificationState);
    cwPublishPlanBadge(model);
    if (typeof global.renderTable === 'function') global.renderTable();
    return true;
  }

  async function loadCalibrationWorkStatusMap(client) {
    const generation = ++cwIntegrationLoadGeneration;
    try {
      const model = await cwReadIntegrationSnapshot(cwResolveClient(client));
      if (generation !== cwIntegrationLoadGeneration) return false;
      return cwPublishCalibrationWorkIntegration(model, null, generation);
    } catch (_error) {
      return false;
    }
  }

  function cwNotificationBatchMatch(batch, filter) {
    if (!filter) return true;
    const ids = cwNotificationState.batchIds && cwNotificationState.batchIds[filter] || [];
    return ids.includes(batch.id);
  }

  async function cwOpenNotification(kind, batchId) {
    const tabs = {
      awaiting_acknowledgement: 'waiting', due_today: 'batches',
      overdue_missing_evidence: 'batches', awaiting_closure: 'waiting'
    };
    if (!Object.prototype.hasOwnProperty.call(tabs, kind)) return false;
    if (typeof global.showPage === 'function') global.showPage('plan');
    const source = cwResolveClient(null);
    if (source && typeof source.from === 'function' && !await loadCalibrationWorkPage(source)) return false;
    cwSyncPrimaryState(tabs[kind]);
    cwUiState.notificationFilter = kind;
    cwRenderTabs();
    cwRenderBatchList();
    if (batchId != null) {
      if (!UUID_PATTERN.test(batchId || '') || !cwNotificationBatchMatch({ id: batchId }, kind)
          || !cwFindBatch(batchId)) return false;
      await cwOpenBatch(batchId);
    }
    const target = batchId == null && document.querySelector('#cwBatchList .cw-batch-card');
    if (target && typeof target.focus === 'function') target.focus();
    return true;
  }

  async function cwOpenBatchFromInstrument(instrumentId, client) {
    const id = cwInstrumentId(instrumentId);
    const mapped = id == null ? null : calibrationWorkStatusMap[id];
    if (!mapped || !UUID_PATTERN.test(mapped.batchId || '')) return false;
    const returnFocus = document.activeElement;
    cwSyncPrimaryState('batches');
    if (typeof global.showPage === 'function') global.showPage('plan');
    const source = cwResolveClient(client);
    if (source && typeof source.from === 'function' && !await loadCalibrationWorkPage(source)) {
      cwReturnToRegistry(id, returnFocus);
      return false;
    }
    const current = calibrationWorkStatusMap[id];
    if (!current || current.batchId !== mapped.batchId || !cwFindBatch(mapped.batchId)) {
      cwReturnToRegistry(id, returnFocus);
      return false;
    }
    cwUiState.registryReturnInstrumentId = id;
    await cwOpenBatch(mapped.batchId);
    return true;
  }

  async function loadCalibrationWorkPage(client) {
    const generation = ++cwUiState.loadGeneration;
    const integrationGeneration = ++cwIntegrationLoadGeneration;
    const requestedPrimaryTab = cwPrimaryTab === 'select' ? 'batches' : cwPrimaryTab;
    const list = document.getElementById('cwBatchList');
    const tabs = document.getElementById('cwTabs');
    const metrics = document.getElementById('cwMetrics');
    cwUiState.openBatchId = null;
    cwUiState.model = { ...cwUiState.model, locksReady: false };
    cwSetCreateAccess();
    cwShowDashboardSurface();
    if (tabs) tabs.innerHTML = '';
    if (metrics) metrics.innerHTML = '';
    if (list) list.innerHTML = '<div class="cw-state" role="status"><strong>กำลังโหลดชุดงานสอบเทียบ...</strong></div>';
    try {
      const source = client || (typeof sb !== 'undefined' ? sb : null);
      if (!source || typeof source.from !== 'function') throw new Error('ยังไม่พร้อมเชื่อมต่อฐานข้อมูล');
      const [batches, items, locks, documents, audit] = await Promise.all([
        cwReadTable(source, 'calibration_work_batches', '*', 'updated_at', false),
        cwReadTable(source, 'calibration_work_items', '*, instruments(id,id_code,instrument_name)', 'created_at', true),
        cwReadTable(source, 'calibration_work_instrument_locks', '*', 'instrument_id', true, 'instrument_id'),
        cwReadTable(source, 'calibration_work_documents', '*', 'uploaded_at', false),
        cwReadTable(source, 'calibration_work_audit', '*', 'occurred_at', false)
      ]);
      if (generation !== cwUiState.loadGeneration) return false;
      const model = cwNormalizeReadModel(batches, items, locks, documents, audit);
      cwRenderDashboard(model, { primaryTab: requestedPrimaryTab });
      cwPublishCalibrationWorkIntegration(model, null, integrationGeneration);
      return true;
    } catch (error) {
      if (generation !== cwUiState.loadGeneration) return false;
      cwRenderDashboard({ batches: [], error: error && error.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล' },
        { primaryTab: requestedPrimaryTab });
      return false;
    }
  }

  function cwFormatBangkokDateTime(value) {
    if (!value) return '–';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short'
    }).format(date);
  }

  function cwItemInstrument(item) {
    const relation = item && (item.instruments || item.instrument);
    return Array.isArray(relation) ? relation[0] || {} : relation || {};
  }

  function cwItemStatusLabel(item) {
    if (item.is_active === false) return 'นำออกแล้ว';
    const status = cwItemDisplayStatus(item, cwTodayISO());
    return ({ completed: 'เสร็จแล้ว', skipped: 'ไม่ได้ดำเนินการ', overdue: 'เกินแผนสอบเทียบ', in_progress: 'กำลังสอบเทียบ' })[status]
      || status || '–';
  }

  function cwHasCurrentAcknowledgement(batch) {
    return Boolean(batch && (batch.documents || []).some(documentRow => documentRow
      && documentRow.item_id == null && documentRow.document_kind === 'acknowledgement'
      && documentRow.is_current === true));
  }

  function cwItemResettable(batch, item) {
    if (!batch || !item || item.is_active === false || ['completed', 'cancelled'].includes(batch.status)) return false;
    if (item.result_status === 'completed' || item.result_status === 'skipped') return true;
    return item.result_status === 'in_progress' && (item.cert_no != null || item.calibration_date != null
      || item.overdue_reason != null || item.skip_reason != null
      || (batch.documents || []).some(documentRow => documentRow && documentRow.item_id === item.id
        && documentRow.is_current === true && ITEM_DOCUMENT_KINDS.has(documentRow.document_kind)));
  }

  function cwItemActionMarkup(batch, item) {
    if (!cwCanManage() || !batch || !item || !UUID_PATTERN.test(batch.id || '')
        || !UUID_PATTERN.test(item.id || '') || item.batch_id !== batch.id || item.is_active === false) return '';
    const eligibleBatch = ['awaiting_calibration', 'partially_completed', 'awaiting_closure_pdf'].includes(batch.status)
      && cwHasCurrentAcknowledgement(batch);
    if (eligibleBatch && item.result_status === 'in_progress') {
      return '<div class="cw-item-actions"><button type="button" data-cw-result-item="' + item.id
        + '" onclick="cwOpenItemResult(this.dataset.cwResultItem)">บันทึกผล</button>'
        + '<button type="button" class="cw-secondary" data-cw-skip-item="' + item.id
        + '" onclick="cwRequestSkipItem(this.dataset.cwSkipItem)">ข้ามรายการ</button>'
        + (cwItemResettable(batch, item) ? '<button type="button" class="cw-secondary" data-cw-reset-item="' + item.id
          + '" onclick="cwRequestResetItem(this.dataset.cwResetItem)">ล้างผล</button>' : '') + '</div>';
    }
    if (cwItemResettable(batch, item)) {
      return '<button type="button" class="cw-secondary" data-cw-reset-item="' + item.id
        + '" onclick="cwRequestResetItem(this.dataset.cwResetItem)">ล้างผล</button>';
    }
    return '';
  }

  function cwRenderItems(batch) {
    const rows = (batch.items || []).map(item => {
      const instrument = cwItemInstrument(item);
      const notes = item.is_active === false ? item.removal_reason
        : item.result_status === 'skipped' ? item.skip_reason : item.overdue_reason;
      return '<tr class="' + (item.is_active === false ? 'is-removed' : '') + '"><td><b>'
        + cwEscapeHtml(instrument.id_code || item.instrument_id || '–') + '</b><span>'
        + cwEscapeHtml(instrument.instrument_name || '–') + '</span></td><td>'
        + cwEscapeHtml(item.planned_date || '–') + '</td><td><span class="cw-item-status">'
        + cwEscapeHtml(cwItemStatusLabel(item)) + '</span></td><td>'
        + cwEscapeHtml(item.cert_no || '–') + '</td><td>'
        + cwEscapeHtml(item.calibration_date || '–') + '</td><td>'
        + cwEscapeHtml(notes || '–') + '</td><td>' + cwItemActionMarkup(batch, item) + '</td></tr>';
    }).join('');
    return '<section class="cw-panel cw-detail-items"><div class="cw-panel-head"><h2>รายการเครื่องมือ</h2><span>'
      + (batch.items || []).length + ' รายการรวมประวัติ</span></div><div class="cw-table-wrap"><table class="cw-item-table">'
      + '<thead><tr><th>เครื่องมือ</th><th>วันที่ตามแผน</th><th>สถานะ</th><th>Cert No.</th><th>วันที่สอบเทียบ</th><th>หมายเหตุ</th><th>การทำงาน</th></tr></thead>'
      + '<tbody>' + (rows || '<tr><td colspan="7">ไม่มีรายการเครื่องมือ</td></tr>') + '</tbody></table></div></section>';
  }

  function cwRenderClosureSummary(batch) {
    const active = cwActiveItems(batch);
    const resolved = active.filter(item => item.result_status === 'completed' || item.result_status === 'skipped');
    if (!resolved.length) return '';
    const allResolved = active.length > 0 && resolved.length === active.length;
    const serverReady = allResolved && batch.status === 'awaiting_closure_pdf';
    const rows = resolved.map(item => {
      const instrument = cwItemInstrument(item);
      const label = instrument.id_code || item.instrument_id || item.id;
      const result = item.result_status === 'skipped'
        ? 'ไม่ได้ดำเนินการ' + (item.skip_reason ? ' · ' + item.skip_reason : '')
        : 'สอบเทียบแล้ว' + (item.cert_no ? ' · ' + item.cert_no : '');
      return '<li><b>' + cwEscapeHtml(label) + '</b><span>' + cwEscapeHtml(result) + '</span></li>';
    }).join('');
    const heading = serverReady ? 'สรุปพร้อมปิดแผน'
      : allResolved ? 'รอสถานะปิดแผนจากเซิร์ฟเวอร์' : 'สรุปผลที่ดำเนินการแล้ว';
    return '<section class="cw-panel cw-closure-summary"><div class="cw-panel-head"><h2>'
      + heading + '</h2><span>' + resolved.length + ' / ' + active.length + '</span></div><ul>' + rows + '</ul></section>';
  }

  function cwDocumentKindLabel(kind) {
    return ({ acknowledgement: 'PDF รับทราบแผน', closure: 'PDF ปิดแผน', certificate: 'ใบ Certificate', overdue: 'หลักฐานเกินแผน' })[kind]
      || kind || 'เอกสาร';
  }

  function cwFormatFileSize(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) return '–';
    if (bytes < 1024) return Math.round(bytes) + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(bytes % 1024 ? 1 : 0) + ' KB';
    return (bytes / 1048576).toFixed(bytes % 1048576 ? 1 : 0) + ' MB';
  }

  function cwDocumentOwnedPath(documentRow, batch) {
    if (!documentRow || !batch || !UUID_PATTERN.test(documentRow.id || '')
        || documentRow.batch_id !== batch.id) return null;
    try {
      const expected = cwDocumentPath(
        documentRow.batch_id,
        documentRow.item_id == null ? null : documentRow.item_id,
        documentRow.document_kind,
        Number(documentRow.version_number)
      );
      return documentRow.storage_path === expected ? expected : null;
    } catch (_) {
      return null;
    }
  }

  function cwDocumentUploadAllowed(batch, itemId, kind, currentDocument) {
    if (!batch || !UUID_PATTERN.test(batch.id || '')) return false;
    const status = cwBatchStatus(batch);
    if (kind === 'acknowledgement') {
      return itemId == null && !['draft', 'completed', 'cancelled'].includes(status);
    }
    if (kind === 'closure') {
      const active = cwActiveItems(batch);
      return itemId == null && batch.status === 'awaiting_closure_pdf' && active.length > 0
        && active.every(item => item.result_status === 'completed' || item.result_status === 'skipped');
    }
    if (!ITEM_DOCUMENT_KINDS.has(kind) || !UUID_PATTERN.test(itemId || '')
        || ['draft', 'awaiting_acknowledgement_pdf', 'completed', 'cancelled'].includes(status)
        || !cwCurrentDocument(batch, 'acknowledgement')) return false;
    return cwActiveItems(batch).some(item => item.id === itemId && item.result_status === 'in_progress');
  }

  function cwDocumentButton(documentRow, batch) {
    if (!cwDocumentOwnedPath(documentRow, batch)) return '';
    return '<button type="button" class="cw-doc-open" data-document-id="' + documentRow.id
      + '" onclick="cwOpenDocument(this.dataset.documentId)">เปิดเอกสาร</button>';
  }

  function cwUploadButton(batch, kind, currentDocument) {
    if (!cwCanManage() || !cwDocumentUploadAllowed(batch, null, kind, currentDocument)) return '';
    return '<button type="button" class="cw-doc-upload" data-batch-id="' + batch.id
      + '" data-cw-upload-kind="' + kind
      + '" onclick="cwOpenDocumentUpload(this.dataset.batchId,null,this.dataset.cwUploadKind)">'
      + (currentDocument ? 'แทนที่ PDF' : 'แนบ PDF') + '</button>';
  }

  function cwRenderCurrentDocuments(batch) {
    const ack = cwCurrentDocument(batch, 'acknowledgement');
    const closure = cwCurrentDocument(batch, 'closure');
    const row = (label, kind, documentRow, missing) => '<article><b>' + label + '</b><span>'
      + (documentRow ? cwEscapeHtml(documentRow.original_filename || documentRow.storage_path || 'มีเอกสาร') : missing)
      + '</span><div class="cw-doc-actions">' + (documentRow ? cwDocumentButton(documentRow, batch) : '')
      + cwUploadButton(batch, kind, documentRow) + '</div></article>';
    return '<section class="cw-panel cw-current-docs"><div class="cw-panel-head"><h2>เอกสารระดับชุดงาน</h2></div>'
      + row('PDF รับทราบแผน', 'acknowledgement', ack, 'ยังไม่มี PDF รับทราบแผน')
      + row('PDF ปิดแผน', 'closure', closure, 'ยังไม่มี PDF ปิดแผน') + '</section>';
  }

  function cwRenderDocumentVersions(documents, batch) {
    const rowsByVersion = [...(documents || [])].sort((a, b) =>
      String(b.uploaded_at || '').localeCompare(String(a.uploaded_at || ''))
      || Number(b.version_number || 0) - Number(a.version_number || 0)
      || String(a.id || '').localeCompare(String(b.id || '')));
    return rowsByVersion.map(documentRow => {
      const item = documentRow.item_id == null ? null
        : (batch && batch.items || []).find(candidate => candidate.id === documentRow.item_id);
      const instrument = cwItemInstrument(item);
      const scope = documentRow.item_id == null ? 'ระดับชุดงาน'
        : item
          ? (instrument.id_code || item.instrument_id || documentRow.item_id) + ' · ' + (instrument.instrument_name || 'ไม่ระบุชื่อเครื่องมือ')
          : documentRow.item_id;
      return '<li><div><b>' + cwEscapeHtml(cwDocumentKindLabel(documentRow.document_kind))
        + ' · เวอร์ชัน ' + cwEscapeHtml(documentRow.version_number || '–') + '</b><span>'
        + cwEscapeHtml(documentRow.original_filename || documentRow.storage_path || '–') + '</span><span>'
        + cwEscapeHtml(scope) + '</span></div><small>'
        + (documentRow.is_current ? 'ฉบับใช้งาน' : 'ประวัติ') + ' · โดย ' + cwEscapeHtml(documentRow.uploaded_by || '–')
        + ' · อัปโหลด ' + cwEscapeHtml(cwFormatBangkokDateTime(documentRow.uploaded_at))
        + ' · ' + cwEscapeHtml(cwFormatFileSize(documentRow.file_size))
        + (documentRow.replacement_reason ? ' · ' + cwEscapeHtml(documentRow.replacement_reason) : '')
        + '</small>' + (batch ? cwDocumentButton(documentRow, batch) : '') + '</li>';
    }).join('');
  }

  function cwRenderDocumentHistory(batch) {
    const rows = cwRenderDocumentVersions(batch.documents || [], batch);
    return '<section class="cw-panel cw-doc-history"><div class="cw-panel-head"><h2>เวอร์ชันเอกสารทั้งหมด</h2></div><ul>'
      + (rows || '<li>ยังไม่มีเอกสาร</li>') + '</ul></section>';
  }

  function cwRenderAudit(batch) {
    const events = [...(batch.audit || [])].sort((a, b) => String(b.occurred_at || '').localeCompare(String(a.occurred_at || '')));
    const rows = events.map(event => '<li><span class="cw-audit-dot"></span><div><b>'
      + cwEscapeHtml(event.action || 'กิจกรรม') + '</b><span>โดย ' + cwEscapeHtml(event.actor || '–')
      + ' · ' + cwEscapeHtml(cwFormatBangkokDateTime(event.occurred_at)) + '</span>'
      + (event.reason ? '<small>' + cwEscapeHtml(event.reason) + '</small>' : '') + '</div></li>').join('');
    return '<section class="cw-panel cw-audit"><div class="cw-panel-head"><h2>ประวัติกิจกรรม</h2></div><ol>'
      + (rows || '<li>ยังไม่มีกิจกรรม</li>') + '</ol></section>';
  }

  function cwShowActionError(message) {
    const root = document.getElementById('cwActionError');
    if (!root) return;
    root.textContent = message || '';
    root.hidden = !message;
  }

  function cwBatchActionMarkup(batch) {
    if (!cwCanManage() || !batch || !UUID_PATTERN.test(batch.id || '')) return '';
    const status = cwBatchStatus(batch);
    if (status === 'completed' || status === 'cancelled') return '';
    const id = batch.id;
    return '<div class="cw-detail-actions">'
      + '<button type="button" data-cw-action="edit" data-batch-id="' + id
      + '" onclick="cwEditBatchItems(this.dataset.batchId)">แก้ไขรายการ</button>'
      + (status === 'draft' ? '<button type="button" data-cw-action="confirm" data-batch-id="' + id
        + '" onclick="cwConfirmBatch(this.dataset.batchId)">ยืนยันรายการแผน</button>' : '')
      + '<button type="button" class="cw-danger" data-cw-action="cancel" data-batch-id="' + id
      + '" onclick="cwRequestCancel(this.dataset.batchId)">ยกเลิกชุดงาน</button></div>';
  }

  async function cwOpenBatch(batchId) {
    if (!UUID_PATTERN.test(batchId || '')) throw new Error('Invalid batch UUID');
    const batch = (cwUiState.model.batches || []).find(row => row.id === batchId);
    if (!batch) throw new Error('Calibration work batch not found');
    const tabs = document.getElementById('cwTabs');
    const notifications = document.getElementById('cwNotifications');
    const metrics = document.getElementById('cwMetrics');
    const list = document.getElementById('cwBatchList');
    const detail = document.getElementById('cwBatchDetail');
    if (!detail) return;
    if (detail.hidden) cwUiState.batchReturnFocus = document.activeElement;
    const progress = cwProgress(batch);
    const status = cwBatchStatus(batch);
    const meta = CW_STATUS[status] || { label: status || '–', color: '#64748B' };
    cwUiState.openBatchId = batchId;
    cwShowActionError('');
    detail.innerHTML = '<header class="cw-detail-head" tabindex="-1"><button type="button" onclick="cwCloseBatch()" aria-label="กลับไปรายการชุดงาน">← กลับ</button>'
      + '<div><span>' + cwEscapeHtml(batch.batch_no || '–') + '</span><h1>' + cwEscapeHtml(batch.title || 'ไม่มีชื่อชุดงาน') + '</h1>'
      + '<p>' + cwEscapeHtml(batch.unit_code || '–') + ' · ' + cwEscapeHtml(batch.instrument_type || '–') + '</p></div>'
      + '<aside class="cw-detail-side"><span class="cw-status" style="--cw-status:' + meta.color + '">' + cwEscapeHtml(meta.label)
      + '</span>' + cwBatchActionMarkup(batch) + '</aside></header>'
      + '<section class="cw-detail-progress"><div><span>ความคืบหน้า</span><b>' + progress.completed + ' / ' + progress.total + '</b></div>'
      + '<span class="cw-progress" aria-label="ความคืบหน้า ' + progress.percent + '%"><span style="width:' + progress.percent + '%"></span></span></section>'
      + '<div class="cw-detail-grid"><div>' + cwRenderItems(batch) + cwRenderClosureSummary(batch) + cwRenderAudit(batch) + '</div><aside>'
      + cwRenderCurrentDocuments(batch) + cwRenderDocumentHistory(batch) + '</aside></div>';
    if (notifications) notifications.hidden = true;
    if (tabs) tabs.hidden = true;
    if (metrics) metrics.hidden = true;
    if (list) list.hidden = true;
    detail.hidden = false;
    const detailHead = detail.querySelector('.cw-detail-head');
    if (detailHead) detailHead.focus();
  }

  function cwCloseBatch() {
    cwUiState.openBatchId = null;
    const registryReturnInstrumentId = cwUiState.registryReturnInstrumentId;
    if (registryReturnInstrumentId) {
      cwUiState.registryReturnInstrumentId = null;
      cwReturnToRegistry(registryReturnInstrumentId);
      return;
    }
    const returnFocus = cwUiState.batchReturnFocus;
    cwUiState.batchReturnFocus = null;
    cwShowDashboardSurface();
    if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') returnFocus.focus();
  }

  function cwReturnToRegistry(instrumentId, fallback) {
    if (typeof global.showPage === 'function') global.showPage('list');
    const selector = '[data-cw-open-batch-instrument="' + String(instrumentId) + '"]';
    const targets = [...document.querySelectorAll(selector)];
    const target = targets.find(candidate => candidate.offsetParent !== null) || targets.find(candidate => {
      if (candidate.closest('[hidden]')) return false;
      const style = typeof global.getComputedStyle === 'function' ? global.getComputedStyle(candidate) : null;
      return !style || (style.display !== 'none' && style.visibility !== 'hidden');
    }) || targets[0];
    if (target && typeof target.focus === 'function') target.focus();
    else if (fallback && fallback.isConnected && typeof fallback.focus === 'function') fallback.focus();
  }

  function cwShowCreateError(message) {
    const root = document.getElementById('cwCreateError');
    if (!root) return;
    root.textContent = message || '';
    root.hidden = !message;
  }

  function cwResetWizard(mode, batch) {
    cwWizardState.mode = mode;
    cwWizardState.step = mode === 'edit' ? 2 : 1;
    cwWizardState.title = batch && batch.title || '';
    cwWizardState.unitCode = batch && batch.unit_code || '';
    cwWizardState.instrumentType = batch && batch.instrument_type || '';
    cwWizardState.search = '';
    cwWizardState.selected = new Map();
    cwWizardState.batchId = batch && batch.id || null;
    cwWizardState.expectedUpdatedAt = batch && batch.updated_at || null;
    cwWizardState.hadAcknowledgement = Boolean(batch && (batch.documents || [])
      .some(documentRow => documentRow && documentRow.item_id == null
        && documentRow.document_kind === 'acknowledgement'));
    cwWizardState.currentAcknowledgement = Boolean(batch && (batch.documents || [])
      .some(documentRow => documentRow && documentRow.item_id == null
        && documentRow.document_kind === 'acknowledgement' && documentRow.is_current === true));
    cwWizardState.reason = '';
    cwWizardState.submitting = false;
    if (batch) {
      cwActiveItems(batch).forEach(item => {
        cwWizardState.selected.set(String(item.instrument_id), {
          instrumentId: Number(item.instrument_id), plannedDate: item.planned_date || '', item
        });
      });
    }
  }

  function cwRegistryGroups() {
    const seen = new Set();
    return cwRegistry().reduce((groups, instrument) => {
      const unit = String(instrument && instrument.department || '');
      const type = String(instrument && instrument.instrument_type || '');
      const key = unit + '\u0000' + type;
      if (unit && type && !seen.has(key)) {
        seen.add(key);
        groups.push({ unit, type });
      }
      return groups;
    }, []).sort((left, right) => left.unit.localeCompare(right.unit) || left.type.localeCompare(right.type));
  }

  function cwInstrumentId(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
  }

  function cwInstrumentCandidates() {
    const byId = new Map();
    const registryById = new Map();
    cwRegistry().forEach(instrument => {
      const id = cwInstrumentId(instrument && instrument.id);
      if (id == null) return;
      registryById.set(String(id), instrument);
      if (instrument.department !== cwWizardState.unitCode
          || instrument.instrument_type !== cwWizardState.instrumentType) return;
      byId.set(String(id), { ...instrument, id });
    });
    if (cwWizardState.mode === 'edit') {
      const batch = (cwUiState.model.batches || []).find(row => row.id === cwWizardState.batchId);
      cwActiveItems(batch).forEach(item => {
        const id = cwInstrumentId(item.instrument_id);
        if (id == null || byId.has(String(id))) return;
        const relation = cwItemInstrument(item);
        const registryRow = registryById.get(String(id));
        byId.set(String(id), {
          id,
          department: registryRow && registryRow.department,
          instrument_type: registryRow && registryRow.instrument_type,
          id_code: registryRow && registryRow.id_code || relation.id_code || id,
          instrument_name: registryRow && registryRow.instrument_name || relation.instrument_name || 'ไม่ระบุชื่อเครื่องมือ',
          staleRegistry: true
        });
      });
    }
    return [...byId.values()].sort((left, right) =>
      String(left.id_code || '').localeCompare(String(right.id_code || '')) || left.id - right.id);
  }

  function cwLockFor(instrumentId) {
    return (cwUiState.model.locks || []).find(lock =>
      String(lock && lock.instrument_id) === String(instrumentId)) || null;
  }

  function cwBlockingLock(instrumentId) {
    const lock = cwLockFor(instrumentId);
    if (!lock) return null;
    if (cwWizardState.mode === 'edit' && lock.batch_id === cwWizardState.batchId) return null;
    return lock;
  }

  function cwLockOwner(lock) {
    if (!lock) return '';
    const batch = (cwUiState.model.batches || []).find(row => row.id === lock.batch_id);
    return batch && batch.batch_no || lock.batch_id || 'ชุดงานอื่น';
  }

  function cwItemHasResults(item) {
    if (!item) return false;
    if (item.result_status !== 'in_progress' || item.cert_no != null || item.calibration_date != null
        || item.overdue_reason != null || item.skip_reason != null) return true;
    const batch = (cwUiState.model.batches || []).find(row => row.id === cwWizardState.batchId);
    return Boolean(batch && (batch.documents || []).some(documentRow =>
      documentRow && documentRow.item_id === item.id && documentRow.is_current === true
      && ITEM_DOCUMENT_KINDS.has(documentRow.document_kind)));
  }

  function cwSelectOptions(values, selected, placeholder) {
    return '<option value="">' + cwEscapeHtml(placeholder) + '</option>' + values.map(value =>
      '<option value="' + cwEscapeHtml(value) + '"' + (value === selected ? ' selected' : '') + '>'
      + cwEscapeHtml(value) + '</option>').join('');
  }

  function cwRenderCreateSteps() {
    const root = document.getElementById('cwCreateSteps');
    if (!root) return;
    if (cwWizardState.mode === 'edit') {
      root.innerHTML = '<span class="cw-step is-active">แก้ไขรายการแบบทั้งชุด</span>';
      return;
    }
    const labels = ['1. กลุ่มชุดงาน', '2. เลือกเครื่องมือ', '3. ตรวจสอบ'];
    root.innerHTML = labels.map((label, index) => '<span class="cw-step'
      + (cwWizardState.step === index + 1 ? ' is-active' : '') + '">' + label + '</span>').join('');
  }

  function cwRenderCreateGroup() {
    const groups = cwRegistryGroups();
    const units = [...new Set(groups.map(group => group.unit))];
    const types = groups.filter(group => group.unit === cwWizardState.unitCode).map(group => group.type);
    return '<div class="cw-form-grid"><label class="cw-field"><span>ชื่อชุดงาน</span><input id="cwCreateTitle" type="text" maxlength="200" value="'
      + cwEscapeHtml(cwWizardState.title) + '" oninput="cwSetCreateTitle(this.value)" required></label>'
      + '<label class="cw-field"><span>หน่วยงาน</span><select id="cwCreateUnit" onchange="cwChooseCreateUnit(this.value)">'
      + cwSelectOptions(units, cwWizardState.unitCode, 'เลือกหน่วยงาน') + '</select></label>'
      + '<label class="cw-field"><span>ประเภทเครื่องมือ</span><select id="cwCreateType" onchange="cwChooseCreateType(this.value)"'
      + (cwWizardState.unitCode ? '' : ' disabled') + '>'
      + cwSelectOptions(types, cwWizardState.instrumentType, 'เลือกประเภท') + '</select></label></div>';
  }

  function cwRenderCreateItems() {
    const query = cwWizardState.search.trim().toLocaleLowerCase();
    const candidates = cwInstrumentCandidates().filter(instrument => {
      if (!query) return true;
      return [instrument.id_code, instrument.instrument_name].some(value =>
        String(value || '').toLocaleLowerCase().includes(query));
    });
    const rows = candidates.map(instrument => {
      const key = String(instrument.id);
      const selection = cwWizardState.selected.get(key);
      const blockingLock = cwBlockingLock(instrument.id);
      const protectedItem = selection && cwItemHasResults(selection.item);
      const disabled = Boolean(blockingLock || protectedItem || instrument.staleRegistry);
      return '<article class="cw-instrument-row' + (disabled ? ' is-locked' : '')
        + '" data-cw-instrument-id="' + instrument.id + '"><label><input type="checkbox" data-instrument-id="'
        + instrument.id + '"' + (selection ? ' checked' : '') + (disabled ? ' disabled' : '')
        + ' onchange="cwToggleCreateItem(Number(this.dataset.instrumentId),this.checked)"><span><b>'
        + cwEscapeHtml(instrument.id_code || instrument.id) + '</b><small>'
        + cwEscapeHtml(instrument.instrument_name || 'ไม่ระบุชื่อ') + '</small>'
        + (blockingLock ? '<em>ถูกล็อกโดย ' + cwEscapeHtml(cwLockOwner(blockingLock)) + '</em>' : '')
        + (instrument.staleRegistry ? '<em>ข้อมูลทะเบียนไม่ตรงกลุ่มชุดงาน กรุณารีเฟรช</em>' : '')
        + (protectedItem ? '<em>มีผล/เอกสาร ต้องรีเซ็ตผลก่อนนำออก</em>' : '')
        + '</span></label><input type="date" aria-label="วันที่ตามแผน '
        + cwEscapeHtml(instrument.id_code || instrument.id) + '" value="' + cwEscapeHtml(selection && selection.plannedDate || '')
        + '" data-instrument-id="' + instrument.id + '"' + (!selection || disabled || protectedItem ? ' disabled' : '')
        + ' onchange="cwSetCreatePlannedDate(Number(this.dataset.instrumentId),this.value)"></article>';
    }).join('');
    const acknowledgement = cwWizardState.mode === 'edit' && cwWizardState.currentAcknowledgement
      ? '<div class="cw-warning" role="note">เอกสารรับทราบปัจจุบันจะเป็นประวัติหลังบันทึกการแก้ไข</div>' : '';
    const reason = cwWizardState.mode === 'edit' && cwWizardState.hadAcknowledgement
      ? '<label class="cw-field"><span>เหตุผลการแก้ไข</span><textarea id="cwEditReason" rows="3" oninput="cwSetEditReason(this.value)" required>'
        + cwEscapeHtml(cwWizardState.reason) + '</textarea></label>' : '';
    return acknowledgement + '<div class="cw-item-tools"><label class="cw-field"><span>ค้นหา</span><input id="cwCreateSearch" type="search" value="'
      + cwEscapeHtml(cwWizardState.search) + '" oninput="cwSetCreateSearch(this.value)" placeholder="รหัสหรือชื่อเครื่องมือ"></label>'
      + '<label class="cw-field"><span>กำหนดวันที่ที่เลือกทั้งหมด</span><input id="cwCreateBulkDate" type="date" onchange="cwSetCreateBulkDate(this.value)"></label></div>'
      + '<div class="cw-instrument-list">' + (rows || '<p class="cw-empty">ไม่พบเครื่องมือที่ตรงกับกลุ่มนี้</p>') + '</div>' + reason;
  }

  function cwRenderCreateReview() {
    const rows = [...cwWizardState.selected.values()].map(selection => {
      const instrument = cwInstrumentCandidates().find(row => row.id === selection.instrumentId) || {};
      return '<li><span><b>' + cwEscapeHtml(instrument.id_code || selection.instrumentId) + '</b><small>'
        + cwEscapeHtml(instrument.instrument_name || '') + '</small></span><time>'
        + cwEscapeHtml(selection.plannedDate) + '</time></li>';
    }).join('');
    return '<section class="cw-review"><h3>' + cwEscapeHtml(cwWizardState.title.trim()) + '</h3><p>'
      + cwEscapeHtml(cwWizardState.unitCode) + ' · ' + cwEscapeHtml(cwWizardState.instrumentType)
      + '</p><ul>' + rows + '</ul></section>';
  }

  function cwRenderCreateFooter() {
    const root = document.getElementById('cwCreateFooter');
    if (!root) return;
    const busy = cwWizardState.submitting ? ' disabled' : '';
    if (cwWizardState.mode === 'edit') {
      root.innerHTML = '<button type="button" class="cw-secondary" onclick="cwCloseCreate()"' + busy + '>ยกเลิก</button>'
        + '<button type="button" class="cw-primary" onclick="cwSubmitEdit()"' + busy + '>บันทึกรายการ</button>';
      return;
    }
    root.innerHTML = (cwWizardState.step > 1 ? '<button type="button" class="cw-secondary" onclick="cwGoCreateStep('
      + (cwWizardState.step - 1) + ')"' + busy + '>← ย้อนกลับ</button>' : '<button type="button" class="cw-secondary" onclick="cwCloseCreate()"' + busy + '>ยกเลิก</button>')
      + (cwWizardState.step < 3 ? '<button type="button" class="cw-primary" onclick="cwGoCreateStep('
        + (cwWizardState.step + 1) + ')"' + busy + '>ถัดไป →</button>'
        : '<button type="button" class="cw-primary" onclick="cwSubmitCreate()"' + busy + '>สร้างชุดงาน</button>');
  }

  function cwRenderCreateDialog() {
    const title = document.getElementById('cwCreateDialogTitle');
    const body = document.getElementById('cwCreateBody');
    if (title) title.textContent = cwWizardState.mode === 'edit' ? 'แก้ไขชุดงานสอบเทียบ' : 'สร้างชุดงานสอบเทียบ';
    cwRenderCreateSteps();
    if (body) body.innerHTML = cwWizardState.step === 1 ? cwRenderCreateGroup()
      : cwWizardState.step === 2 ? cwRenderCreateItems() : cwRenderCreateReview();
    cwRenderCreateFooter();
  }

  function cwRenderCreateDialogWithFocus(selector) {
    cwRenderCreateDialog();
    const target = selector && document.querySelector(selector);
    if (target && !target.disabled && !target.hidden) target.focus();
  }

  function cwOpenDialog() {
    const dialog = document.getElementById('cwCreateDialog');
    if (!dialog) return false;
    dialog.classList.add('open');
    dialog.setAttribute('aria-hidden', 'false');
    dialog.onkeydown = cwHandleCreateDialogKey;
    dialog.onclick = event => { if (event.target === dialog && !cwWizardState.submitting) cwCloseCreate(); };
    cwShowCreateError('');
    cwRenderCreateDialog();
    const focusTarget = document.getElementById(cwWizardState.mode === 'edit' ? 'cwCreateSearch' : 'cwCreateTitle')
      || dialog.querySelector('button,input,select,textarea');
    if (focusTarget) focusTarget.focus();
    return true;
  }

  function cwOpenCreate() {
    if (!cwCanCreate()) return false;
    cwWizardState.returnFocus = document.activeElement;
    cwWizardState.returnPrimaryTab = null;
    cwWizardState.returnDashboardTab = null;
    cwResetWizard('create', null);
    return cwOpenDialog();
  }

  function cwOpenCreateWithInstrument(instrumentId) {
    if (!cwCanCreate()) return false;
    const id = cwInstrumentId(instrumentId);
    const instrument = id == null ? null : cwRegistry().find(row =>
      row && cwInstrumentId(row.id) === id);
    if (!instrument || !instrument.department || !instrument.instrument_type || cwLockFor(id)) return false;
    const previousPrimaryTab = cwPrimaryTab;
    const previousDashboardTab = cwUiState.tab;
    cwWizardState.returnFocus = document.activeElement;
    cwResetWizard('create', null);
    cwWizardState.unitCode = String(instrument.department);
    cwWizardState.instrumentType = String(instrument.instrument_type);
    cwWizardState.step = 2;
    cwWizardState.selected.set(String(id), { instrumentId: id, plannedDate: '', item: null });
    if (!cwOpenDialog()) return false;
    cwWizardState.returnPrimaryTab = previousPrimaryTab;
    cwWizardState.returnDashboardTab = previousDashboardTab;
    cwSyncPrimaryState('select');
    return true;
  }

  async function cwEditBatchItems(batchId) {
    if (!cwCanManage() || cwUiState.model.locksReady !== true || !UUID_PATTERN.test(batchId || '')) return false;
    const batch = (cwUiState.model.batches || []).find(row => row.id === batchId);
    if (!batch || ['completed', 'cancelled'].includes(cwBatchStatus(batch))) return false;
    cwWizardState.returnFocus = document.activeElement;
    cwWizardState.returnPrimaryTab = null;
    cwWizardState.returnDashboardTab = null;
    cwResetWizard('edit', batch);
    return cwOpenDialog();
  }

  function cwCloseCreate() {
    if (cwWizardState.submitting) return false;
    const dialog = document.getElementById('cwCreateDialog');
    if (dialog) {
      dialog.classList.remove('open');
      dialog.setAttribute('aria-hidden', 'true');
    }
    const returnPrimaryTab = cwWizardState.returnPrimaryTab;
    if (returnPrimaryTab && CW_PRIMARY_TABS.includes(returnPrimaryTab)) {
      cwSyncPrimaryState(returnPrimaryTab, cwWizardState.returnDashboardTab);
      cwRenderTabs();
      cwRenderBatchList();
    }
    const restoredPrimary = returnPrimaryTab && CW_PRIMARY_TABS.includes(returnPrimaryTab)
      ? document.querySelector('#cwPrimaryTabs [aria-pressed="true"]') : null;
    const returnFocus = restoredPrimary || cwWizardState.returnFocus;
    if (returnFocus && typeof returnFocus.focus === 'function' && returnFocus.isConnected) returnFocus.focus();
    else {
      const fallback = document.querySelector('#cwPrimaryTabs [aria-pressed="true"]');
      if (fallback && typeof fallback.focus === 'function') fallback.focus();
    }
    cwWizardState.returnPrimaryTab = null;
    cwWizardState.returnDashboardTab = null;
    return true;
  }

  function cwHandleCreateDialogKey(event) {
    if (!event) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      cwCloseCreate();
      return;
    }
    if (event.key !== 'Tab') return;
    const dialog = document.getElementById('cwCreateDialog');
    if (!dialog) return;
    const focusable = [...dialog.querySelectorAll('button,input,select,textarea')]
      .filter(element => !element.disabled && !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  }

  function cwSetCreateTitle(value) {
    cwWizardState.title = String(value == null ? '' : value);
    return true;
  }

  function cwChooseCreateUnit(unitCode) {
    cwWizardState.unitCode = String(unitCode || '');
    cwWizardState.instrumentType = '';
    cwWizardState.selected.clear();
    cwShowCreateError('');
    cwRenderCreateDialogWithFocus('#cwCreateType:not(:disabled), #cwCreateUnit');
  }

  function cwChooseCreateType(instrumentType) {
    return cwSetCreateGroup(cwWizardState.unitCode, instrumentType);
  }

  function cwSetCreateGroup(unitCode, instrumentType) {
    const group = cwRegistryGroups().find(candidate =>
      candidate.unit === unitCode && candidate.type === instrumentType);
    if (!group || cwWizardState.mode !== 'create') {
      cwShowCreateError('กลุ่มหน่วยงานและประเภทเครื่องมือไม่ถูกต้อง');
      return false;
    }
    cwWizardState.unitCode = group.unit;
    cwWizardState.instrumentType = group.type;
    cwWizardState.selected.clear();
    cwShowCreateError('');
    cwRenderCreateDialogWithFocus('#cwCreateType');
    return true;
  }

  function cwToggleCreateItem(instrumentId, selected) {
    const id = cwInstrumentId(instrumentId);
    const candidate = cwInstrumentCandidates().find(instrument => instrument.id === id);
    const existing = id == null ? null : cwWizardState.selected.get(String(id));
    if (id == null || !candidate || candidate.staleRegistry || cwBlockingLock(id)) {
      cwShowCreateError('ไม่สามารถเลือกเครื่องมือที่ไม่ตรงกลุ่มหรือถูกล็อกได้');
      return false;
    }
    if (!selected && existing && cwItemHasResults(existing.item)) {
      cwShowCreateError('รีเซ็ตผลและเอกสารของรายการนี้ก่อนนำออ');
      return false;
    }
    if (selected) {
      cwWizardState.selected.set(String(id), existing || { instrumentId: id, plannedDate: '', item: null });
    } else {
      cwWizardState.selected.delete(String(id));
    }
    cwShowCreateError('');
    cwRenderCreateDialogWithFocus('[data-cw-instrument-id="' + id + '"] input[type="checkbox"]');
    return true;
  }

  function cwSetCreatePlannedDate(instrumentId, date) {
    const id = cwInstrumentId(instrumentId);
    const selection = id == null ? null : cwWizardState.selected.get(String(id));
    const candidate = id == null ? null : cwInstrumentCandidates().find(instrument => instrument.id === id);
    if (!selection || !cwValidISODate(date) || !candidate || candidate.staleRegistry
        || cwBlockingLock(id)) {
      cwShowCreateError('กรุณาระบุวันที่ตามแผนแบบ YYYY-MM-DD');
      return false;
    }
    if (selection.item && date !== selection.item.planned_date && cwItemHasResults(selection.item)) {
      cwShowCreateError('รีเซ็ตผลและเอกสารของรายการนี้ก่อนเปลี่ยนวันที่');
      return false;
    }
    selection.plannedDate = date;
    cwShowCreateError('');
    return true;
  }

  function cwSetCreateBulkDate(date) {
    if (!cwValidISODate(date) || cwWizardState.selected.size === 0) {
      cwShowCreateError('เลือกเครื่องมือและระบุวันที่แบบ YYYY-MM-DD');
      return false;
    }
    let changed = false;
    cwWizardState.selected.forEach(selection => {
      if (!selection.item || !cwItemHasResults(selection.item) || selection.item.planned_date === date) {
        selection.plannedDate = date;
        changed = true;
      }
    });
    if (!changed) {
      cwShowCreateError('รายการที่มีผลต้องรีเซ็ตก่อนเปลี่ยนวันที่');
      return false;
    }
    cwShowCreateError('');
    cwRenderCreateDialogWithFocus('#cwCreateBulkDate');
    return true;
  }

  function cwSetCreateSearch(value) {
    cwWizardState.search = String(value == null ? '' : value);
    cwRenderCreateDialog();
    const input = document.getElementById('cwCreateSearch');
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    return true;
  }

  function cwSetEditReason(value) {
    cwWizardState.reason = String(value == null ? '' : value);
    return true;
  }

  function cwValidateWizardItems() {
    if (cwUiState.model.locksReady !== true) return 'ไม่สามารถยืนยันข้อมูล lock ได้ กรุณารีเฟรช';
    if (!cwWizardState.selected.size) return 'กรุณาเลือกเครื่องมืออย่างน้อย 1 รายการ';
    const candidates = new Map(cwInstrumentCandidates().map(instrument => [String(instrument.id), instrument]));
    for (const [key, selection] of cwWizardState.selected) {
      const candidate = candidates.get(key);
      if (!candidate || candidate.staleRegistry) {
        return 'ข้อมูลทะเบียนของรายการที่เลือกไม่ตรงกลุ่มชุดงาน กรุณารีเฟรช';
      }
      if (cwBlockingLock(selection.instrumentId)) {
        return 'รายการที่เลือกไม่ตรงกลุ่มหรือถูกล็อก กรุณาตรวจสอบใหม่';
      }
      if (!cwValidISODate(selection.plannedDate)) return 'ทุกรายการต้องมีวันที่ตามแผนแบบ YYYY-MM-DD';
      if (selection.item && selection.plannedDate !== selection.item.planned_date && cwItemHasResults(selection.item)) {
        return 'รีเซ็ตผลก่อนเปลี่ยนวันที่ตามแผน';
      }
    }
    return null;
  }

  function cwGoCreateStep(step) {
    if (cwWizardState.mode !== 'create' || ![1, 2, 3].includes(step)) return false;
    if (step > 1) {
      if (!cwWizardState.title.trim()) {
        cwShowCreateError('กรุณาระบุชื่อชุดงาน');
        return false;
      }
      if (!cwRegistryGroups().some(group => group.unit === cwWizardState.unitCode
          && group.type === cwWizardState.instrumentType)) {
        cwShowCreateError('กรุณาเลือกหน่วยงานและประเภทเครื่องมือ');
        return false;
      }
    }
    if (step === 3) {
      const error = cwValidateWizardItems();
      if (error) {
        cwShowCreateError(error);
        return false;
      }
    }
    cwWizardState.step = step;
    cwShowCreateError('');
    cwRenderCreateDialog();
    const focusTarget = step === 3 ? document.querySelector('#cwCreateFooter .cw-primary')
      : document.getElementById(step === 1 ? 'cwCreateTitle' : 'cwCreateSearch');
    if (focusTarget) focusTarget.focus();
    return true;
  }

  function cwItemsPayload() {
    return [...cwWizardState.selected.values()].map(selection => ({
      instrument_id: selection.instrumentId, planned_date: selection.plannedDate
    }));
  }

  async function cwRpc(source, name, payload) {
    if (!source || typeof source.rpc !== 'function') throw new Error('ยังไม่พร้อมเชื่อมต่อฐานข้อมูล');
    const response = await source.rpc(name, payload);
    if (response && response.error) throw new Error(response.error.message || 'การบันทึกไม่สำเร็จ');
    return Array.isArray(response && response.data) ? response.data[0] : response && response.data;
  }

  function cwToast(message, type) {
    if (typeof global.showToast === 'function') global.showToast(message, type);
  }

  async function cwSubmitCreate(client) {
    if (!cwCanManage() || cwWizardState.mode !== 'create' || cwWizardState.step !== 3 || cwWizardState.submitting) return false;
    const itemError = cwValidateWizardItems();
    if (!cwWizardState.title.trim() || itemError) {
      cwShowCreateError(itemError || 'กรุณาระบุชื่อชุดงาน');
      return false;
    }
    const actor = cwActor();
    const source = cwResolveClient(client);
    cwWizardState.submitting = true;
    cwRenderCreateFooter();
    try {
      const result = await cwRpc(source, 'cw_create_batch', {
        p_token: actor && actor.token, p_title: cwWizardState.title.trim(),
        p_unit_code: cwWizardState.unitCode, p_instrument_type: cwWizardState.instrumentType,
        p_items: cwItemsPayload()
      });
      if (!result || !UUID_PATTERN.test(result.id || '')) throw new Error('ฐานข้อมูลไม่ได้ส่งรหัสชุดงานกลับมา');
      if (!await loadCalibrationWorkPage(source)) throw new Error('สร้างชุดงานแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ');
      cwWizardState.submitting = false;
      cwCloseCreate();
      await cwOpenBatch(result.id);
      cwToast('สร้างชุดงานแล้ว', 'success');
      return true;
    } catch (error) {
      cwWizardState.submitting = false;
      cwRenderCreateFooter();
      cwShowCreateError(error && error.message || 'สร้างชุดงานไม่สำเร็จ');
      return false;
    }
  }

  async function cwSubmitEdit(client) {
    if (!cwCanManage() || cwWizardState.mode !== 'edit' || cwWizardState.submitting) return false;
    const itemError = cwValidateWizardItems();
    const reason = cwWizardState.reason.trim();
    if (itemError || (cwWizardState.hadAcknowledgement && !reason)) {
      cwShowCreateError(itemError || 'กรุณาระบุเหตุผลเมื่อชุดงานเคยมีเอกสารรับทราบ');
      return false;
    }
    if (!cwWizardState.expectedUpdatedAt) {
      cwShowCreateError('ไม่พบเวอร์ชันของชุดงาน กรุณารีเฟรช');
      return false;
    }
    const actor = cwActor();
    const source = cwResolveClient(client);
    cwWizardState.submitting = true;
    cwRenderCreateFooter();
    try {
      await cwRpc(source, 'cw_mutate_items', {
        p_token: actor && actor.token, p_batch_id: cwWizardState.batchId,
        p_items: cwItemsPayload(), p_expected_updated_at: cwWizardState.expectedUpdatedAt,
        p_reason: reason || null
      });
      const batchId = cwWizardState.batchId;
      if (!await loadCalibrationWorkPage(source)) throw new Error('บันทึกแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ');
      cwWizardState.submitting = false;
      cwCloseCreate();
      await cwOpenBatch(batchId);
      cwToast('บันทึกรายการแล้ว', 'success');
      return true;
    } catch (error) {
      cwWizardState.submitting = false;
      cwRenderCreateFooter();
      cwShowCreateError(error && error.message || 'บันทึกไม่สำเร็จ');
      return false;
    }
  }

  async function cwConfirmBatch(batchId, client) {
    if (!cwCanManage() || !UUID_PATTERN.test(batchId || '')) return false;
    const batch = (cwUiState.model.batches || []).find(row => row.id === batchId);
    if (!batch || cwBatchStatus(batch) !== 'draft') return false;
    const source = cwResolveClient(client);
    cwShowActionError('');
    try {
      await cwRpc(source, 'cw_confirm_batch', { p_token: cwActor() && cwActor().token, p_batch_id: batchId });
      if (!await loadCalibrationWorkPage(source)) throw new Error('ยืนยันแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ');
      await cwOpenBatch(batchId);
      cwToast('ยืนยันรายการแผนแล้ว', 'success');
      return true;
    } catch (error) {
      cwShowActionError(error && error.message || 'ยืนยันชุดงานไม่สำเร็จ');
      return false;
    }
  }

  async function cwCancelBatch(batchId, reason, client) {
    const cleanReason = String(reason == null ? '' : reason).trim();
    if (!cwCanManage() || !UUID_PATTERN.test(batchId || '') || !cleanReason) {
      if (cwCanManage()) cwShowActionError('กรุณาระบุเหตุผลการยกเลิก');
      return false;
    }
    const batch = (cwUiState.model.batches || []).find(row => row.id === batchId);
    if (!batch || ['completed', 'cancelled'].includes(cwBatchStatus(batch))) return false;
    const source = cwResolveClient(client);
    cwShowActionError('');
    try {
      await cwRpc(source, 'cw_cancel_batch', {
        p_token: cwActor() && cwActor().token, p_batch_id: batchId, p_reason: cleanReason
      });
      if (!await loadCalibrationWorkPage(source)) throw new Error('ยกเลิกแล้ว แต่ไม่สามารถตรวจสอบ lock ได้');
      if ((cwUiState.model.locks || []).some(lock => lock && lock.batch_id === batchId)) {
        throw new Error('ยกเลิกแล้ว แตยังพบ instrument lock ของชุดงาน กรุณารีเฟรชและตรวจสอบ');
      }
      cwToast('ยกเลิกชุดงานและปล่อย lock แล้ว', 'success');
      return true;
    } catch (error) {
      cwShowActionError(error && error.message || 'ยกเลิกชุดงานไม่สำเร็จ');
      return false;
    }
  }

  async function cwRequestCancel(batchId) {
    const reason = typeof global.prompt === 'function' ? global.prompt('ระบุเหตุผลการยกเลิกชุดงาน') : null;
    if (reason == null) return false;
    return cwCancelBatch(batchId, reason);
  }

  function cwFindBatch(batchId) {
    return (cwUiState.model.batches || []).find(batch => batch && batch.id === batchId) || null;
  }

  function cwFindItemRecord(itemId) {
    if (!UUID_PATTERN.test(itemId || '')) return null;
    for (const batch of cwUiState.model.batches || []) {
      const item = (batch.items || []).find(candidate => candidate && candidate.id === itemId);
      if (item && item.batch_id === batch.id) return { batch, item };
    }
    return null;
  }

  function cwItemMutationTarget(itemId, mode) {
    if (!cwCanManage()) return null;
    const actor = cwActor();
    if (!actor || !String(actor.token || '').trim()) return null;
    const known = cwFindItemRecord(itemId);
    if (!known || known.item.is_active === false) return null;
    if (mode === 'reset') return cwItemResettable(known.batch, known.item) ? known : null;
    if (!['awaiting_calibration', 'partially_completed', 'awaiting_closure_pdf'].includes(known.batch.status)
        || !cwHasCurrentAcknowledgement(known.batch) || known.item.result_status !== 'in_progress') return null;
    return known;
  }

  function cwCurrentItemDocument(batch, itemId, kind) {
    return (batch && batch.documents || []).find(documentRow => documentRow
      && documentRow.item_id === itemId && documentRow.document_kind === kind
      && documentRow.is_current === true) || null;
  }

  function cwShowItemResultError(message) {
    const root = document.getElementById('cwItemResultError');
    if (!root) return;
    root.textContent = message || '';
    root.hidden = !message;
  }

  function cwResultDisabledAttr(id) {
    return cwItemResultState.busy && cwItemResultState.focusId !== id ? ' disabled' : '';
  }

  function cwItemEvidenceMarkup(batch, item, kind, label) {
    const current = cwCurrentItemDocument(batch, item.id, kind);
    const open = current ? cwDocumentButton(current, batch) : '';
    const upload = cwDocumentUploadAllowed(batch, item.id, kind, current)
      ? '<button type="button" class="cw-doc-upload" data-batch-id="' + batch.id
        + '" data-item-id="' + item.id + '" data-cw-upload-kind="' + kind
        + '" onclick="cwOpenDocumentUpload(this.dataset.batchId,this.dataset.itemId,this.dataset.cwUploadKind)">'
        + (current ? 'แทนที่ PDF' : 'แนบ PDF') + '</button>' : '';
    return '<section class="cw-item-evidence"><b>' + label + '</b><span>'
      + (current ? cwEscapeHtml(current.original_filename || current.storage_path || 'มีเอกสาร') : 'ยังไม่มีเอกสาร')
      + '</span><div class="cw-doc-actions">' + open + upload + '</div></section>';
  }

  function cwRenderItemResultDialog() {
    const body = document.getElementById('cwItemResultBody');
    const footer = document.getElementById('cwItemResultFooter');
    const known = cwFindItemRecord(cwItemResultState.itemId);
    if (!body || !footer || !known) return;
    const { batch, item } = known;
    const instrument = cwItemInstrument(item);
    const candidate = {
      ...item,
      cert_no: cwItemResultState.certNo,
      calibration_date: cwItemResultState.calibrationDate || null,
      overdue_reason: cwItemResultState.overdueReason
    };
    const requirements = cwItemRequirements(candidate, cwTodayISO(), batch.documents || []);
    const lateSection = requirements.overdueRequired
      ? '<label class="cw-field"><span>เหตุผลเกินแผน</span><textarea id="cwItemOverdueReason" rows="3"'
        + ' oninput="cwSetItemResultField(\'overdueReason\',this.value)"' + cwResultDisabledAttr('cwItemOverdueReason') + '>'
        + cwEscapeHtml(cwItemResultState.overdueReason) + '</textarea></label>'
        + cwItemEvidenceMarkup(batch, item, 'overdue', 'หลักฐานเกินแผน PDF')
      : requirements.displayOverdue
        ? '<p class="cw-result-warning">เลยวันที่ตามแผนแล้ว กรุณาระบุวันที่สอบเทียบจริง</p>' : '';
    body.innerHTML = '<div class="cw-result-immutable"><b>'
      + cwEscapeHtml(instrument.id_code || item.instrument_id || item.id) + '</b><span>'
      + cwEscapeHtml(instrument.instrument_name || 'ไม่ระบุชื่อเครื่องมือ') + '</span><span>วันที่ตามแผน '
      + cwEscapeHtml(item.planned_date || '–') + '</span></div>'
      + '<div class="cw-result-fields"><label class="cw-field"><span>Cert No.</span><input id="cwItemCertNo" type="text" maxlength="200" value="'
      + cwEscapeHtml(cwItemResultState.certNo) + '" oninput="cwSetItemResultField(\'certNo\',this.value)"'
      + cwResultDisabledAttr('cwItemCertNo') + '></label>'
      + '<label class="cw-field"><span>วันที่สอบเทียบ</span><input id="cwItemCalibrationDate" type="date" value="'
      + cwEscapeHtml(cwItemResultState.calibrationDate) + '" onchange="cwSetItemResultField(\'calibrationDate\',this.value)"'
      + cwResultDisabledAttr('cwItemCalibrationDate') + '></label></div>'
      + cwItemEvidenceMarkup(batch, item, 'certificate', 'Certificate PDF') + lateSection;
    footer.innerHTML = '<button type="button" id="cwItemResultCancel" class="cw-secondary" onclick="cwCloseItemResult()"'
      + cwResultDisabledAttr('cwItemResultCancel') + '>ปิด</button>'
      + '<button type="button" class="cw-secondary" id="cwItemResultSave" onclick="cwSaveItemDraft()" aria-disabled="'
      + cwItemResultState.busy + '">บันทึกร่าง</button>'
      + '<button type="button" class="cw-primary" id="cwItemResultComplete" onclick="cwCompleteItem()" aria-disabled="'
      + cwItemResultState.busy + '">ยืนยันผล</button>';
    const focusTarget = cwItemResultState.focusId && document.getElementById(cwItemResultState.focusId);
    if (focusTarget && !focusTarget.disabled && typeof focusTarget.focus === 'function') focusTarget.focus();
  }

  function cwSetItemResultBusy(busy) {
    if (busy) {
      const dialog = document.getElementById('cwItemResultDialog');
      cwItemResultState.focusId = dialog && dialog.contains(document.activeElement)
        ? document.activeElement.id || null : null;
    }
    cwItemResultState.busy = Boolean(busy);
    const dialog = document.getElementById('cwItemResultDialog');
    if (dialog) dialog.setAttribute('aria-busy', String(Boolean(busy)));
    ['cwItemResultClose','cwItemResultCancel','cwItemCertNo','cwItemCalibrationDate','cwItemOverdueReason'].forEach(id => {
      const control = document.getElementById(id);
      if (control) control.disabled = Boolean(busy) && control.id !== cwItemResultState.focusId;
    });
    ['cwItemResultSave','cwItemResultComplete'].forEach(id => {
      const control = document.getElementById(id);
      if (control) control.setAttribute('aria-disabled', String(Boolean(busy)));
    });
  }

  function cwOpenItemResult(itemId) {
    const known = cwItemMutationTarget(itemId, 'edit');
    const dialog = document.getElementById('cwItemResultDialog');
    if (!known || !dialog) return false;
    cwItemResultState.batchId = known.batch.id;
    cwItemResultState.itemId = known.item.id;
    cwItemResultState.certNo = known.item.cert_no || '';
    cwItemResultState.calibrationDate = known.item.calibration_date || '';
    cwItemResultState.overdueReason = known.item.overdue_reason || '';
    cwItemResultState.busy = false;
    cwItemResultState.returnFocus = document.activeElement;
    cwItemResultState.focusId = null;
    cwShowItemResultError('');
    cwRenderItemResultDialog();
    dialog.classList.add('open');
    dialog.setAttribute('aria-hidden', 'false');
    dialog.onkeydown = cwHandleItemResultKey;
    dialog.onclick = event => { if (event.target === dialog && !cwItemResultState.busy) cwCloseItemResult(); };
    const first = document.getElementById('cwItemCertNo');
    if (first) first.focus();
    return true;
  }

  function cwCloseItemResult() {
    if (cwItemResultState.busy) return false;
    const dialog = document.getElementById('cwItemResultDialog');
    if (dialog) {
      dialog.classList.remove('open');
      dialog.setAttribute('aria-hidden', 'true');
    }
    const returnFocus = cwItemResultState.returnFocus;
    if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') returnFocus.focus();
    else {
      const fallback = document.querySelector('[data-cw-result-item="' + cwItemResultState.itemId + '"]')
        || document.querySelector('#cwBatchDetail .cw-detail-head');
      if (fallback && typeof fallback.focus === 'function') fallback.focus();
    }
    return true;
  }

  function cwDismissChangedItemResult(message) {
    cwItemResultState.busy = false;
    cwItemResultState.focusId = null;
    const dialog = document.getElementById('cwItemResultDialog');
    if (dialog) {
      dialog.setAttribute('aria-busy', 'false');
      dialog.classList.remove('open');
      dialog.setAttribute('aria-hidden', 'true');
    }
    cwShowActionError(message || 'สถานะรายการเปลี่ยนไป กรุณาตรวจสอบข้อมูลล่าสุด');
    const fallback = document.querySelector('[data-cw-result-item="' + cwItemResultState.itemId + '"]')
      || document.querySelector('#cwBatchDetail .cw-detail-head');
    if (fallback && typeof fallback.focus === 'function') fallback.focus();
    return false;
  }

  function cwHandleItemResultKey(event) {
    if (!event) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      cwCloseItemResult();
      return;
    }
    if (event.key !== 'Tab') return;
    const dialog = document.getElementById('cwItemResultDialog');
    if (!dialog) return;
    const focusable = [...dialog.querySelectorAll('button,input,textarea')]
      .filter(element => !element.disabled && !element.hidden);
    if (!focusable.length) return;
    if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
      event.preventDefault();
      focusable[0].focus();
    } else if (event.shiftKey && document.activeElement === focusable[0]) {
      event.preventDefault();
      focusable[focusable.length - 1].focus();
    }
  }

  function cwSetItemResultField(field, value) {
    if (cwItemResultState.busy || !['certNo','calibrationDate','overdueReason'].includes(field)) return false;
    cwItemResultState[field] = String(value == null ? '' : value);
    if (field === 'calibrationDate') {
      cwRenderItemResultDialog();
      const input = document.getElementById('cwItemCalibrationDate');
      if (input) input.focus();
    }
    return true;
  }

  function cwItemDraftPayload(itemId) {
    const date = cwItemResultState.calibrationDate;
    if (date && !cwValidISODate(date)) throw new Error('วันที่สอบเทียบไม่ถูกต้อง');
    return {
      p_token: cwActor() && cwActor().token,
      p_item_id: itemId,
      p_cert_no: cwItemResultState.certNo.trim() || null,
      p_calibration_date: date || null,
      p_overdue_reason: cwItemResultState.overdueReason.trim() || null
    };
  }

  async function cwRefreshItemResult(source, batchId, itemId, reopen) {
    if (!await loadCalibrationWorkPage(source)) throw new Error('บันทึกแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ');
    if (!cwFindBatch(batchId)) throw new Error('ไม่พบชุดงานหลังรีเฟรช');
    await cwOpenBatch(batchId);
    if (reopen) {
      const known = cwItemMutationTarget(itemId, 'edit');
      if (!known) return cwDismissChangedItemResult();
      cwItemResultState.certNo = known.item.cert_no || '';
      cwItemResultState.calibrationDate = known.item.calibration_date || '';
      cwItemResultState.overdueReason = known.item.overdue_reason || '';
      cwRenderItemResultDialog();
    }
    return true;
  }

  async function cwSaveItemDraft(client) {
    const known = cwItemMutationTarget(cwItemResultState.itemId, 'edit');
    const key = cwItemResultState.itemId;
    if (!known || cwItemResultState.busy || cwItemMutations.has(key)) return false;
    const source = cwResolveClient(client);
    cwItemMutations.add(key);
    cwSetItemResultBusy(true);
    cwShowItemResultError('');
    try {
      await cwRpc(source, 'cw_save_item_draft', cwItemDraftPayload(known.item.id));
      if (!await cwRefreshItemResult(source, known.batch.id, known.item.id, true)) return false;
      cwSetItemResultBusy(false);
      cwRenderItemResultDialog();
      cwToast('บันทึกร่างผลสอบเทียบแล้ว', 'success');
      return true;
    } catch (error) {
      cwSetItemResultBusy(false);
      cwShowItemResultError(error && error.message || 'บันทึกร่างไม่สำเร็จ');
      return false;
    } finally {
      cwItemMutations.delete(key);
    }
  }

  function cwRequirementMessage(missing) {
    const labels = {
      cert_no: 'Cert No.', calibration_date: 'วันที่สอบเทียบ', certificate: 'Certificate PDF ปัจจุบัน',
      overdue_reason: 'เหตุผลเกินแผน', overdue: 'หลักฐานเกินแผน PDF ปัจจุบัน'
    };
    return 'ข้อมูลยังไม่ครบ: ' + missing.map(key => labels[key] || key).join(', ');
  }

  function cwRegistryProvesItemResult(item, certNo, calibrationDate) {
    const instrumentId = item && item.instrument_id;
    const instrument = cwRegistry().find(row => row && String(row.id) === String(instrumentId));
    return Boolean(instrument
      && String(instrument.cert_no || '') === String(certNo || '')
      && String(instrument.cal_date || '') === String(calibrationDate || ''));
  }

  async function cwReconcileRegistry(item, certNo, calibrationDate) {
    let explicitSuccess = false;
    try {
      if (typeof global.loadData === 'function') explicitSuccess = await global.loadData(true) === true;
    } catch (_error) {
      explicitSuccess = false;
    }
    return explicitSuccess || cwRegistryProvesItemResult(item, certNo, calibrationDate);
  }

  async function cwCompleteItem(client) {
    const known = cwItemMutationTarget(cwItemResultState.itemId, 'edit');
    const key = cwItemResultState.itemId;
    if (!known || cwItemResultState.busy || cwItemMutations.has(key)) return false;
    let draftPayload;
    try { draftPayload = cwItemDraftPayload(known.item.id); }
    catch (error) { cwShowItemResultError(error.message); return false; }
    const candidate = {
      ...known.item, cert_no: draftPayload.p_cert_no,
      calibration_date: draftPayload.p_calibration_date, overdue_reason: draftPayload.p_overdue_reason
    };
    const requirements = cwItemRequirements(candidate, cwTodayISO(), known.batch.documents || []);
    if (requirements.missing.length) {
      cwShowItemResultError(cwRequirementMessage(requirements.missing));
      return false;
    }
    const source = cwResolveClient(client);
    cwItemMutations.add(key);
    cwSetItemResultBusy(true);
    cwShowItemResultError('');
    let mutationError = null;
    let registryVerified = false;
    let batchRefreshed = false;
    try {
      try {
        await cwRpc(source, 'cw_save_item_draft', draftPayload);
        await cwRpc(source, 'cw_complete_item', { p_token: cwActor() && cwActor().token, p_item_id: known.item.id });
      } catch (error) {
        mutationError = error;
      }
      registryVerified = await cwReconcileRegistry(
        known.item, draftPayload.p_cert_no, draftPayload.p_calibration_date
      );
      try {
        batchRefreshed = await loadCalibrationWorkPage(source) === true;
        if (batchRefreshed && cwFindBatch(known.batch.id)) await cwOpenBatch(known.batch.id);
      } catch (_error) {
        batchRefreshed = false;
      }

      const authoritative = batchRefreshed ? cwFindItemRecord(known.item.id) : null;
      if (authoritative && authoritative.item.result_status === 'completed') {
        cwSetItemResultBusy(false);
        cwCloseItemResult();
        if (!registryVerified) {
          cwShowActionError('ยืนยันผลแล้ว แต่ยังตรวจสอบการรีเฟรชทะเบียนไม่ได้ กรุณารีเฟรชทะเบียน');
          return false;
        }
        cwToast('ยืนยันผลสอบเทียบแล้ว', 'success');
        return true;
      }

      cwSetItemResultBusy(false);
      if (batchRefreshed && !cwItemMutationTarget(known.item.id, 'edit')) {
        return cwDismissChangedItemResult();
      }
      if (authoritative) {
        cwItemResultState.certNo = authoritative.item.cert_no || '';
        cwItemResultState.calibrationDate = authoritative.item.calibration_date || '';
        cwItemResultState.overdueReason = authoritative.item.overdue_reason || '';
        cwRenderItemResultDialog();
      }
      cwShowItemResultError(mutationError && mutationError.message
        || (!batchRefreshed ? 'ยังตรวจสอบสถานะการยืนยันผลไม่ได้ กรุณาลองรีเฟรชอีกครั้ง' : 'ยืนยันผลไม่สำเร็จ'));
      return false;
    } finally {
      cwItemMutations.delete(key);
    }
  }

  async function cwSkipItem(itemId, reason, client) {
    const cleanReason = String(reason == null ? '' : reason).trim();
    const known = cwItemMutationTarget(itemId, 'edit');
    if (!known || !cleanReason || cwItemMutations.has(itemId)) return false;
    const source = cwResolveClient(client);
    cwItemMutations.add(itemId);
    try {
      await cwRpc(source, 'cw_skip_item', {
        p_token: cwActor() && cwActor().token, p_item_id: itemId, p_reason: cleanReason
      });
      if (!await loadCalibrationWorkPage(source)) throw new Error('ข้ามรายการแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ');
      await cwOpenBatch(known.batch.id);
      if (cwItemResultState.itemId === itemId) {
        cwItemResultState.busy = false;
        cwCloseItemResult();
      }
      cwToast('บันทึกรายการที่ไม่ได้ดำเนินการแล้ว', 'success');
      return true;
    } catch (error) {
      cwShowActionError(error && error.message || 'ข้ามรายการไม่สำเร็จ');
      return false;
    } finally {
      cwItemMutations.delete(itemId);
    }
  }

  async function cwRequestSkipItem(itemId, client) {
    const reason = typeof global.prompt === 'function' ? global.prompt('ระบุเหตุผลที่ไม่ได้ดำเนินการ') : null;
    if (reason == null) return false;
    return cwSkipItem(itemId, reason, client);
  }

  async function cwResetItemResult(itemId, reason, client) {
    const cleanReason = String(reason == null ? '' : reason).trim();
    const known = cwItemMutationTarget(itemId, 'reset');
    if (!known || !cleanReason || cwItemMutations.has(itemId)) return false;
    const source = cwResolveClient(client);
    cwItemMutations.add(itemId);
    try {
      await cwRpc(source, 'cw_reset_item_result', {
        p_token: cwActor() && cwActor().token, p_item_id: itemId, p_reason: cleanReason
      });
      if (!await loadCalibrationWorkPage(source)) throw new Error('ล้างผลแล้ว แต่รีเฟรชข้อมูลไม่สำเร็จ');
      await cwOpenBatch(known.batch.id);
      cwToast('ล้างผลและเก็บเอกสารเดิมเป็นประวัติแล้ว', 'success');
      return true;
    } catch (error) {
      cwShowActionError(error && error.message || 'ล้างผลไม่สำเร็จ');
      return false;
    } finally {
      cwItemMutations.delete(itemId);
    }
  }

  async function cwRequestResetItem(itemId, client) {
    const message = 'ระบุเหตุผลการล้างผล เอกสาร Certificate/เกินแผนปัจจุบันจะเปลี่ยนเป็นประวัติ';
    const reason = typeof global.prompt === 'function' ? global.prompt(message) : null;
    if (reason == null) return false;
    return cwResetItemResult(itemId, reason, client);
  }

  function cwDocumentTarget(options, requireFile) {
    const input = options || {};
    if (!cwCanManage()) throw new Error('คุณไม่มีสิทธิ์แนบเอกสาร');
    const actor = cwActor();
    if (!actor || !String(actor.token || '').trim()) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    if (!UUID_PATTERN.test(input.batchId || '')) throw new Error('ไม่พบชุดงาน');
    const batch = cwFindBatch(input.batchId);
    if (!batch) throw new Error('ไม่พบชุดงาน');
    const itemId = input.itemId == null ? null : input.itemId;
    if (!BATCH_DOCUMENT_KINDS.has(input.kind) && !ITEM_DOCUMENT_KINDS.has(input.kind)) {
      throw new Error('ชนิดเอกสารไม่ถูกต้อง');
    }
    if ((BATCH_DOCUMENT_KINDS.has(input.kind) && itemId != null)
        || (ITEM_DOCUMENT_KINDS.has(input.kind) && !UUID_PATTERN.test(itemId || ''))) {
      throw new Error('ขอบเขตเอกสารไม่ถูกต้อง');
    }
    const currentDocument = (batch.documents || []).find(documentRow =>
      documentRow && documentRow.item_id === itemId && documentRow.document_kind === input.kind
      && documentRow.is_current === true) || null;
    if (!cwDocumentUploadAllowed(batch, itemId, input.kind, currentDocument)) {
      throw new Error('สถานะชุดงานไม่อนุญาตให้แนบเอกสารชนิดนี้');
    }
    const reason = String(input.replacementReason == null ? '' : input.replacementReason).trim();
    if (currentDocument && !reason) throw new Error('กรุณาระบุเหตุผลการแทนที่เอกสารปัจจุบัน');
    if (requireFile) {
      const fileError = cwValidatePdf(input.file);
      if (fileError) throw new Error(fileError);
      if (typeof input.file.arrayBuffer !== 'function') throw new Error('ไม่สามารถอ่านไฟล์ PDF ได้');
    }
    return { batch, itemId, currentDocument, reason };
  }

  async function cwRefreshAuthoritativeDocuments(source, batchId) {
    if (!source || typeof source.from !== 'function') throw new Error('ยังไม่พร้อมอ่านประวัติเอกสาร');
    const allDocuments = await cwReadTable(source, 'calibration_work_documents', '*', 'uploaded_at', false);
    const documents = allDocuments.filter(documentRow => documentRow && documentRow.batch_id === batchId);
    const batch = cwFindBatch(batchId);
    if (batch) batch.documents = documents;
    return documents;
  }

  async function cwSha256(file) {
    if (!global.crypto || !global.crypto.subtle) throw new Error('เบราว์เซอร์ไม่รองรับ SHA-256');
    const digest = await global.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function cwEvidenceProgress(options, message) {
    if (options && typeof options.onProgress === 'function') options.onProgress(message);
  }

  function cwCollisionError(error) {
    const message = String(error && error.message || '').toLowerCase();
    const code = String(error && (error.statusCode || error.status) || '');
    return code === '409' || /already exists|duplicate|conflict|collision/.test(message);
  }

  async function cwRefreshEvidenceBatch(source, batchId) {
    const dialog = document.getElementById('cwDocumentDialog');
    const dialogFocus = dialog && dialog.classList.contains('open') && dialog.contains(document.activeElement)
      ? document.activeElement : null;
    const refreshed = await loadCalibrationWorkPage(source);
    if (refreshed && cwFindBatch(batchId)) await cwOpenBatch(batchId);
    const resultDialog = document.getElementById('cwItemResultDialog');
    if (refreshed && resultDialog && resultDialog.classList.contains('open')
        && cwItemResultState.batchId === batchId) {
      if (cwItemMutationTarget(cwItemResultState.itemId, 'edit')) cwRenderItemResultDialog();
      else cwDismissChangedItemResult();
    }
    if (dialogFocus && dialogFocus.isConnected && typeof dialogFocus.focus === 'function') dialogFocus.focus();
    return refreshed;
  }

  async function cwUploadDocument(options, client) {
    const target = cwDocumentTarget(options, true);
    const actor = cwActor();
    const source = cwResolveClient(client);
    const scopeKey = options.batchId + '|' + (target.itemId || 'batch') + '|' + options.kind;
    if (cwDocumentUploads.has(scopeKey)) throw new Error('เอกสารขอบเขตนี้กำลังอัปโหลด');
    if (!source || !source.storage || typeof source.storage.from !== 'function') {
      throw new Error('ยังไม่พร้อมเชื่อมต่อ Storage');
    }
    cwDocumentUploads.add(scopeKey);
    try {
      cwEvidenceProgress(options, 'กำลังอ่านประวัติเอกสาร...');
      const documents = await cwRefreshAuthoritativeDocuments(source, options.batchId);
      const scoped = documents.filter(documentRow => documentRow
        && documentRow.item_id === target.itemId && documentRow.document_kind === options.kind);
      const current = scoped.find(documentRow => documentRow.is_current === true) || null;
      if (current && !target.reason) throw new Error('กรุณาระบุเหตุผลการแทนที่เอกสารปัจจุบัน');
      const nextVersion = scoped.reduce((max, documentRow) =>
        Math.max(max, Number(documentRow.version_number) || 0), 0) + 1;
      const storagePath = cwDocumentPath(options.batchId, target.itemId, options.kind, nextVersion);
      cwEvidenceProgress(options, 'กำลังคำนวณ SHA-256...');
      const testDigest = global.CW_TEST_MODE && /^[0-9a-f]{64}$/.test(source.cwTestSha256 || '')
        ? source.cwTestSha256 : null;
      const sha256 = testDigest || await cwSha256(options.file);
      const storage = source.storage.from(CW_DOCUMENT_BUCKET);
      cwEvidenceProgress(options, 'กำลังอัปโหลด PDF...');
      const upload = await storage.upload(storagePath, options.file, {
        upsert: false, contentType: 'application/pdf'
      });
      if (upload && upload.error) {
        if (cwCollisionError(upload.error)) {
          const refreshed = await cwRefreshEvidenceBatch(source, options.batchId);
          throw new Error('พบไฟล์เวอร์ชันชนกัน '
            + (refreshed ? 'รีเฟรชสถานะล่าสุดแล้ว กรุณาตรวจสอบก่อนลองใหม่'
              : 'และรีเฟรชสถานะไม่สำเร็จ'));
        }
        throw new Error(upload.error.message || 'อัปโหลด PDF ไม่สำเร็จ');
      }

      const registrationPayload = {
        p_token: actor && actor.token,
        p_batch_id: options.batchId,
        p_item_id: target.itemId,
        p_document_kind: options.kind,
        p_storage_path: storagePath,
        p_original_filename: String(options.file.name || ''),
        p_mime_type: 'application/pdf',
        p_file_size: options.file.size,
        p_sha256: sha256,
        p_replacement_reason: target.reason || null
      };
      let registered;
      try {
        cwEvidenceProgress(options, 'กำลังลงทะเบียนหลักฐาน...');
        registered = await cwRpc(source, 'cw_register_document', registrationPayload);
        if (!registered) throw new Error('ฐานข้อมูลไม่ได้ส่งรายการเอกสารกลับมา');
      } catch (registrationError) {
        let cleanupClaim = null;
        let cleanupError = null;
        let cleanupConfirmed = false;
        try {
          cleanupClaim = await cwRpc(source, 'cw_request_orphan_cleanup', {
            p_token: actor && actor.token,
            p_bucket_id: CW_DOCUMENT_BUCKET,
            p_storage_path: storagePath,
            p_reason: 'document registration failed: ' + String(registrationError.message || 'unknown').slice(0, 300)
          });
        } catch (error) {
          cleanupError = error;
        }
        if (cleanupClaim) {
          try {
            cwEvidenceProgress(options, 'ลงทะเบียนไม่สำเร็จ กำลังล้างไฟล์ที่อัปโหลด...');
            const removed = await storage.remove([storagePath]);
            if (removed && removed.error) throw new Error(removed.error.message || 'ล้างไฟล์ไม่สำเร็จ');
            await cwRpc(source, 'cw_confirm_orphan_cleanup', {
              p_token: actor && actor.token,
              p_claim_id: cleanupClaim.id
            });
            cleanupConfirmed = true;
          } catch (error) {
            cleanupError = error;
          }
        }
        const refreshed = await cwRefreshEvidenceBatch(source, options.batchId);
        const refreshMessage = refreshed
          ? ' รีเฟรชสถานะล่าสุดแล้ว กรุณาตรวจสอบก่อนลองใหม่'
          : ' แต่รีเฟรชสถานะล่าสุดไม่สำเร็จ';
        if (cleanupConfirmed) {
          const cleaned = new Error('ลงทะเบียนไม่สำเร็จ แต่ล้างไฟล์แล้ว' + refreshMessage);
          cleaned.cleanupCompleted = true;
          cleaned.cleanupClaim = cleanupClaim;
          cleaned.storagePath = storagePath;
          throw cleaned;
        }
        if (cleanupClaim) {
          const pending = new Error('ลงทะเบียนไม่สำเร็จ ส่งคำขอรอล้างไฟล์แล้ว' + refreshMessage);
          pending.cleanupPending = true;
          pending.cleanupClaim = cleanupClaim;
          pending.cleanupError = cleanupError;
          pending.storagePath = storagePath;
          throw pending;
        }
        throw new Error('ไม่สามารถยืนยันการลงทะเบียน และส่งคำขอล้างไฟล์ไม่สำเร็จ: '
          + (cleanupError && cleanupError.message || registrationError.message || 'ไม่ทราบสาเหตุ') + refreshMessage);
      }

      cwEvidenceProgress(options, 'ลงทะเบียนแล้ว กำลังรีเฟรช...');
      if (!await cwRefreshEvidenceBatch(source, options.batchId)) {
        throw new Error('ลงทะเบียนเอกสารแล้ว แต่รีเฟรชสถานะไม่สำเร็จ');
      }
      return registered;
    } finally {
      cwDocumentUploads.delete(scopeKey);
    }
  }

  function cwKnownDocument(documentId) {
    if (!UUID_PATTERN.test(documentId || '')) return null;
    for (const batch of cwUiState.model.batches || []) {
      const documentRow = (batch.documents || []).find(candidate => candidate && candidate.id === documentId);
      if (documentRow) return { batch, documentRow };
    }
    return null;
  }

  function cwStorageAllowedOrigins(source) {
    const origins = new Set();
    const add = value => {
      if (typeof value !== 'string' || !value.trim()) return;
      try {
        const parsed = new URL(value);
        if (parsed.protocol === 'https:') origins.add(parsed.origin);
      } catch (_) {}
    };
    add(source && source.supabaseUrl);
    add(source && source.storageUrl);
    add(source && source.storage && source.storage.url);
    (source && Array.isArray(source.cwStorageAllowedOrigins) ? source.cwStorageAllowedOrigins : []).forEach(add);
    if (typeof SUPABASE_URL !== 'undefined') add(SUPABASE_URL);
    return origins;
  }

  async function cwOpenDocument(documentId, client) {
    const known = cwKnownDocument(documentId);
    if (!known) throw new Error('ไม่พบเอกสาร');
    const path = cwDocumentOwnedPath(known.documentRow, known.batch);
    if (!path) throw new Error('document path ไม่ตรงกับชุดงาน');
    const source = cwResolveClient(client);
    if (!source || !source.storage || typeof source.storage.from !== 'function') {
      throw new Error('ยังไม่พร้อมเชื่อมต่อ Storage');
    }
    const allowedOrigins = cwStorageAllowedOrigins(source);
    if (!allowedOrigins.size) throw new Error('ไม่พบ Storage origin ที่ได้รับอนุญาต');
    const opened = typeof global.open === 'function' ? global.open('', '_blank') : null;
    if (!opened) throw new Error('เบราว์เซอร์บล็อกหน้าต่างเอกสาร');
    opened.opener = null;
    try {
      const response = await source.storage.from(CW_DOCUMENT_BUCKET).createSignedUrl(path, CW_SIGNED_URL_SECONDS);
      if (response && response.error) throw new Error(response.error.message || 'สร้างลิงก์เอกสารไม่สำเร็จ');
      const signedUrl = response && response.data && response.data.signedUrl;
      let parsed;
      try { parsed = new URL(signedUrl); } catch (_) { throw new Error('ลิงก์เอกสารไม่ถูกต้อง'); }
      if (!allowedOrigins.has(parsed.origin)) throw new Error('signed URL origin ไม่ได้รับอนุญาต');
      if (opened.location && typeof opened.location.replace === 'function') opened.location.replace(parsed.href);
      else opened.location = parsed.href;
    } catch (error) {
      if (typeof opened.close === 'function') opened.close();
      throw error;
    }
  }

  function cwShowDocumentError(message) {
    const root = document.getElementById('cwDocumentError');
    if (!root) return;
    root.textContent = message || '';
    root.hidden = !message;
  }

  function cwRenderDocumentDialog() {
    const body = document.getElementById('cwDocumentBody');
    const footer = document.getElementById('cwDocumentFooter');
    const title = document.getElementById('cwDocumentDialogTitle');
    const batch = cwFindBatch(cwDocumentState.batchId);
    const current = batch && (batch.documents || []).find(documentRow => documentRow
      && documentRow.item_id === cwDocumentState.itemId
      && documentRow.document_kind === cwDocumentState.kind && documentRow.is_current === true);
    if (title) title.textContent = (current ? 'แทนที่' : 'แนบ') + ' ' + cwDocumentKindLabel(cwDocumentState.kind);
    if (body) {
      body.innerHTML = '<p class="cw-document-guidance">รองรับเฉพาะ PDF ขนาดไม่เกิน 50 MB · ไฟล์ใหม่จะเป็นเวอร์ชันถัดไปและไม่เขียนทับ</p>'
        + (current ? '<div class="cw-document-current">ฉบับปัจจุบัน: <b>'
          + cwEscapeHtml(current.original_filename || current.storage_path || '–') + '</b></div>' : '')
        + '<label class="cw-field"><span>ไฟล์ PDF</span><input id="cwDocumentFile" type="file" accept="application/pdf,.pdf"'
        + ' onchange="cwSetDocumentFile(this.files&&this.files[0])"' + (cwDocumentState.busy ? ' disabled' : '') + '></label>'
        + (current ? '<label class="cw-field"><span>เหตุผลการแทนที่</span><textarea id="cwDocumentReason" rows="3"'
          + ' oninput="cwSetDocumentReason(this.value)"' + (cwDocumentState.busy ? ' disabled' : '') + '>'
          + cwEscapeHtml(cwDocumentState.replacementReason) + '</textarea></label>' : '')
        + '<div class="cw-document-progress" role="status">' + cwEscapeHtml(cwDocumentState.progress || '') + '</div>';
    }
    if (footer) footer.innerHTML = '<button type="button" id="cwDocumentCancel" class="cw-secondary" onclick="cwCloseDocumentUpload()"'
      + (cwDocumentState.busy ? ' disabled' : '') + '>ยกเลิก</button><button type="button" class="cw-primary" onclick="cwSubmitDocumentUpload()"'
      + ' id="cwDocumentSubmit" aria-disabled="' + cwDocumentState.busy + '">'
      + (cwDocumentState.busy ? 'กำลังอัปโหลด...' : 'อัปโหลด PDF') + '</button>';
  }

  function cwSetDocumentBusy(busy) {
    const dialog = document.getElementById('cwDocumentDialog');
    if (dialog) dialog.setAttribute('aria-busy', String(Boolean(busy)));
    ['cwDocumentClose', 'cwDocumentCancel', 'cwDocumentFile', 'cwDocumentReason'].forEach(id => {
      const control = document.getElementById(id);
      if (control) control.disabled = Boolean(busy);
    });
    const submit = document.getElementById('cwDocumentSubmit');
    if (submit) {
      submit.setAttribute('aria-disabled', String(Boolean(busy)));
      submit.textContent = busy ? 'กำลังอัปโหลด...' : 'อัปโหลด PDF';
    }
  }

  function cwOpenDocumentUpload(batchId, itemId, kind) {
    if (!cwCanManage()) return false;
    const normalizedItemId = itemId == null ? null : itemId;
    try {
      cwDocumentTarget({ batchId, itemId: normalizedItemId, kind, file: null, replacementReason:
        ((cwFindBatch(batchId) || {}).documents || []).some(documentRow => documentRow
          && documentRow.item_id === normalizedItemId && documentRow.document_kind === kind && documentRow.is_current)
          ? 'pending-reason' : null }, false);
    } catch (error) {
      cwShowActionError(error.message);
      return false;
    }
    const dialog = document.getElementById('cwDocumentDialog');
    if (!dialog) return false;
    cwDocumentState.batchId = batchId;
    cwDocumentState.itemId = normalizedItemId;
    cwDocumentState.kind = kind;
    cwDocumentState.file = null;
    cwDocumentState.replacementReason = '';
    cwDocumentState.busy = false;
    cwDocumentState.progress = '';
    cwDocumentState.returnFocus = document.activeElement;
    cwShowDocumentError('');
    cwRenderDocumentDialog();
    dialog.classList.add('open');
    dialog.setAttribute('aria-hidden', 'false');
    dialog.onkeydown = cwHandleDocumentDialogKey;
    dialog.onclick = event => { if (event.target === dialog && !cwDocumentState.busy) cwCloseDocumentUpload(); };
    const fileInput = document.getElementById('cwDocumentFile');
    if (fileInput) fileInput.focus();
    return true;
  }

  function cwCloseDocumentUpload() {
    if (cwDocumentState.busy) return false;
    const dialog = document.getElementById('cwDocumentDialog');
    if (dialog) {
      dialog.classList.remove('open');
      dialog.setAttribute('aria-hidden', 'true');
    }
    const returnFocus = cwDocumentState.returnFocus;
    if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
      returnFocus.focus();
      return true;
    }
    const escapedKind = cwDocumentState.kind && cwEscapeHtml(cwDocumentState.kind);
    const refreshedAction = escapedKind && document.querySelector('[data-cw-upload-kind="' + escapedKind + '"]');
    const fallback = refreshedAction
      || document.querySelector('#cwBatchDetail .cw-detail-head')
      || document.querySelector('#cwBatchList [data-batch-id="' + cwDocumentState.batchId + '"]')
      || document.querySelector('#cwTabs [tabindex="0"]');
    if (fallback && typeof fallback.focus === 'function') fallback.focus();
    return true;
  }

  function cwHandleDocumentDialogKey(event) {
    if (!event) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      cwCloseDocumentUpload();
      return;
    }
    if (event.key !== 'Tab') return;
    const dialog = document.getElementById('cwDocumentDialog');
    if (!dialog) return;
    const focusable = [...dialog.querySelectorAll('button,input,textarea')]
      .filter(element => !element.disabled && !element.hidden);
    if (!focusable.length) return;
    if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
      event.preventDefault();
      focusable[0].focus();
    } else if (event.shiftKey && document.activeElement === focusable[0]) {
      event.preventDefault();
      focusable[focusable.length - 1].focus();
    }
  }

  function cwSetDocumentFile(file) {
    if (cwDocumentState.busy) return false;
    const error = cwValidatePdf(file);
    cwDocumentState.file = error ? null : file;
    cwShowDocumentError(error || '');
    return !error;
  }

  function cwSetDocumentReason(value) {
    if (cwDocumentState.busy) return false;
    cwDocumentState.replacementReason = String(value == null ? '' : value);
    return true;
  }

  async function cwSubmitDocumentUpload(client) {
    if (cwDocumentState.busy) return false;
    cwDocumentState.busy = true;
    cwDocumentState.progress = 'กำลังตรวจสอบ...';
    cwShowDocumentError('');
    cwSetDocumentBusy(true);
    const initialProgress = document.querySelector('#cwDocumentDialog .cw-document-progress');
    if (initialProgress) initialProgress.textContent = cwDocumentState.progress;
    try {
      await cwUploadDocument({
        batchId: cwDocumentState.batchId,
        itemId: cwDocumentState.itemId,
        kind: cwDocumentState.kind,
        file: cwDocumentState.file,
        replacementReason: cwDocumentState.replacementReason,
        onProgress(message) {
          cwDocumentState.progress = message;
          const progress = document.querySelector('#cwDocumentDialog .cw-document-progress');
          if (progress) progress.textContent = message;
        }
      }, client);
      cwDocumentState.busy = false;
      cwSetDocumentBusy(false);
      cwCloseDocumentUpload();
      cwToast('ลงทะเบียน PDF แล้ว', 'success');
      return true;
    } catch (error) {
      cwDocumentState.busy = false;
      cwDocumentState.progress = '';
      cwSetDocumentBusy(false);
      const progress = document.querySelector('#cwDocumentDialog .cw-document-progress');
      if (progress) progress.textContent = '';
      cwShowDocumentError(error && error.message || 'อัปโหลด PDF ไม่สำเร็จ');
      return false;
    }
  }

  global.CW_STATUS = CW_STATUS;
  global.cwTodayISO = cwTodayISO;
  global.cwItemDisplayStatus = cwItemDisplayStatus;
  global.cwItemRequirements = cwItemRequirements;
  global.cwBatchDerivedStatus = cwBatchDerivedStatus;
  global.cwValidatePdf = cwValidatePdf;
  global.cwDocumentPath = cwDocumentPath;
  global.cwBuildCalibrationWorkStatusMap = cwBuildCalibrationWorkStatusMap;
  global.loadCalibrationWorkStatusMap = loadCalibrationWorkStatusMap;
  global.cwLoadNotifications = cwLoadNotifications;
  global.cwOpenNotification = cwOpenNotification;
  global.cwOpenBatchFromInstrument = cwOpenBatchFromInstrument;
  global.loadCalibrationWorkPage = loadCalibrationWorkPage;
  global.cwRenderDashboard = cwRenderDashboard;
  global.cwRenderPrimaryTabs = cwRenderPrimaryTabs;
  global.cwSetPrimaryTab = cwSetPrimaryTab;
  global.cwHandlePrimaryTabKey = cwHandlePrimaryTabKey;
  global.cwSetDashboardTab = cwSetDashboardTab;
  global.cwHandleTabKey = cwHandleTabKey;
  global.cwOpenBatch = cwOpenBatch;
  global.cwCloseBatch = cwCloseBatch;
  global.cwOpenCreate = cwOpenCreate;
  global.cwOpenCreateWithInstrument = cwOpenCreateWithInstrument;
  global.cwCloseCreate = cwCloseCreate;
  global.cwSetCreateTitle = cwSetCreateTitle;
  global.cwChooseCreateUnit = cwChooseCreateUnit;
  global.cwChooseCreateType = cwChooseCreateType;
  global.cwSetCreateGroup = cwSetCreateGroup;
  global.cwGoCreateStep = cwGoCreateStep;
  global.cwToggleCreateItem = cwToggleCreateItem;
  global.cwSetCreatePlannedDate = cwSetCreatePlannedDate;
  global.cwSetCreateBulkDate = cwSetCreateBulkDate;
  global.cwSetCreateSearch = cwSetCreateSearch;
  global.cwSetEditReason = cwSetEditReason;
  global.cwSubmitCreate = cwSubmitCreate;
  global.cwEditBatchItems = cwEditBatchItems;
  global.cwSubmitEdit = cwSubmitEdit;
  global.cwConfirmBatch = cwConfirmBatch;
  global.cwCancelBatch = cwCancelBatch;
  global.cwRequestCancel = cwRequestCancel;
  global.cwOpenItemResult = cwOpenItemResult;
  global.cwCloseItemResult = cwCloseItemResult;
  global.cwSetItemResultField = cwSetItemResultField;
  global.cwSaveItemDraft = cwSaveItemDraft;
  global.cwCompleteItem = cwCompleteItem;
  global.cwSkipItem = cwSkipItem;
  global.cwRequestSkipItem = cwRequestSkipItem;
  global.cwResetItemResult = cwResetItemResult;
  global.cwRequestResetItem = cwRequestResetItem;
  global.cwRenderDocumentVersions = cwRenderDocumentVersions;
  global.cwUploadDocument = cwUploadDocument;
  global.cwOpenDocument = cwOpenDocument;
  global.cwOpenDocumentUpload = cwOpenDocumentUpload;
  global.cwCloseDocumentUpload = cwCloseDocumentUpload;
  global.cwSetDocumentFile = cwSetDocumentFile;
  global.cwSetDocumentReason = cwSetDocumentReason;
  global.cwSubmitDocumentUpload = cwSubmitDocumentUpload;

  if (global.CW_TEST_MODE) return;
})(window);
