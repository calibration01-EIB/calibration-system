/* ============================================================
   29-calibration-work.js — pure calibration work-batch helpers
   ============================================================ */
(function exposeCalibrationWorkHelpers(global) {
  'use strict';

  const PDF_MAX_BYTES = 52428800;
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
    Object.freeze({ key: 'waiting', label: 'รอเอกสาร' }),
    Object.freeze({ key: 'completed', label: 'เสร็จสิ้น' }),
    Object.freeze({ key: 'history', label: 'ประวัติทั้งหมด' })
  ]);
  const CW_READ_PAGE_SIZE = 200;
  const cwUiState = { model: { batches: [], locks: [], locksReady: false }, tab: 'active', openBatchId: null, loadGeneration: 0 };
  const cwWizardState = {
    mode: 'create', step: 1, title: '', unitCode: '', instrumentType: '', search: '',
    selected: new Map(), batchId: null, expectedUpdatedAt: null, hadAcknowledgement: false,
    currentAcknowledgement: false, submitting: false, returnFocus: null
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
    if (button) button.hidden = !cwCanManage() || cwUiState.model.locksReady !== true;
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
      if (key === 'waiting') return status === 'awaiting_acknowledgement_pdf' || status === 'awaiting_closure_pdf';
      if (key === 'completed') return status === 'completed';
      return true;
    });
  }

  function cwRenderTabs() {
    const root = document.getElementById('cwTabs');
    if (!root) return;
    root.innerHTML = CW_TABS.map(tab => {
      const selected = cwUiState.tab === tab.key;
      const total = cwTabBatches(tab.key).length;
      return '<button type="button" class="cw-tab' + (selected ? ' is-active' : '') + '" role="tab"'
        + ' aria-selected="' + selected + '" tabindex="' + (selected ? '0' : '-1') + '"'
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
    const batches = cwTabBatches(cwUiState.tab);
    if (!batches.length) {
      root.innerHTML = '<div class="cw-state" role="status"><strong>ยังไม่มีชุดงานสอบเทียบ</strong><span>ไม่พบรายการในมุมมองนี้</span></div>';
      return;
    }
    root.innerHTML = batches.map(cwBatchCardMarkup).join('');
  }

  function cwShowDashboardSurface() {
    const tabs = document.getElementById('cwTabs');
    const metrics = document.getElementById('cwMetrics');
    const list = document.getElementById('cwBatchList');
    const detail = document.getElementById('cwBatchDetail');
    if (tabs) tabs.hidden = false;
    if (metrics) metrics.hidden = false;
    if (list) list.hidden = false;
    if (detail) detail.hidden = true;
  }

  function cwRenderDashboard(model) {
    const hasLocks = Boolean(model && Array.isArray(model.locks));
    cwUiState.model = model && Array.isArray(model.batches)
      ? { ...model, locks: hasLocks ? model.locks : [], locksReady: hasLocks && model.locksReady !== false }
      : { batches: [], locks: [], locksReady: false };
    cwUiState.tab = 'active';
    cwUiState.openBatchId = null;
    cwShowDashboardSurface();
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
    cwUiState.tab = tab;
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

  async function loadCalibrationWorkPage(client) {
    const generation = ++cwUiState.loadGeneration;
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
      cwRenderDashboard(cwNormalizeReadModel(batches, items, locks, documents, audit));
      return true;
    } catch (error) {
      if (generation !== cwUiState.loadGeneration) return false;
      cwRenderDashboard({ batches: [], error: error && error.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล' });
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
        + cwEscapeHtml(notes || '–') + '</td></tr>';
    }).join('');
    return '<section class="cw-panel cw-detail-items"><div class="cw-panel-head"><h2>รายการเครื่องมือ</h2><span>'
      + (batch.items || []).length + ' รายการรวมประวัติ</span></div><div class="cw-table-wrap"><table class="cw-item-table">'
      + '<thead><tr><th>เครื่องมือ</th><th>วันที่ตามแผน</th><th>สถานะ</th><th>Cert No.</th><th>วันที่สอบเทียบ</th><th>หมายเหตุ</th></tr></thead>'
      + '<tbody>' + (rows || '<tr><td colspan="6">ไม่มีรายการเครื่องมือ</td></tr>') + '</tbody></table></div></section>';
  }

  function cwDocumentKindLabel(kind) {
    return ({ acknowledgement: 'PDF รับทราบแผน', closure: 'PDF ปิดแผน', certificate: 'ใบ Certificate', overdue: 'หลักฐานเกินแผน' })[kind]
      || kind || 'เอกสาร';
  }

  function cwRenderCurrentDocuments(batch) {
    const ack = cwCurrentDocument(batch, 'acknowledgement');
    const closure = cwCurrentDocument(batch, 'closure');
    const row = (label, documentRow, missing) => '<article><b>' + label + '</b><span>'
      + (documentRow ? cwEscapeHtml(documentRow.original_filename || documentRow.storage_path || 'มีเอกสาร') : missing)
      + '</span></article>';
    return '<section class="cw-panel cw-current-docs"><div class="cw-panel-head"><h2>เอกสารระดับชุดงาน</h2></div>'
      + row('PDF รับทราบแผน', ack, 'ยังไม่มี PDF รับทราบแผน')
      + row('PDF ปิดแผน', closure, 'ยังไม่มี PDF ปิดแผน') + '</section>';
  }

  function cwRenderDocumentHistory(batch) {
    const documents = [...(batch.documents || [])].sort((a, b) => Number(b.version_number || 0) - Number(a.version_number || 0));
    const rows = documents.map(documentRow => {
      const item = documentRow.item_id == null ? null
        : (batch.items || []).find(candidate => candidate.id === documentRow.item_id);
      const instrument = cwItemInstrument(item);
      const scope = item
        ? (instrument.id_code || item.instrument_id || documentRow.item_id) + ' · ' + (instrument.instrument_name || 'ไม่ระบุชื่อเครื่องมือ')
        : 'ระดับชุดงาน';
      return '<li><div><b>' + cwEscapeHtml(cwDocumentKindLabel(documentRow.document_kind))
        + ' · เวอร์ชัน ' + cwEscapeHtml(documentRow.version_number || '–') + '</b><span>'
        + cwEscapeHtml(documentRow.original_filename || documentRow.storage_path || '–') + '</span><span>'
        + cwEscapeHtml(scope) + '</span></div><small>'
        + (documentRow.is_current ? 'ฉบับใช้งาน' : 'ประวัติ') + ' · โดย ' + cwEscapeHtml(documentRow.uploaded_by || '–')
        + ' · อัปโหลด ' + cwEscapeHtml(cwFormatBangkokDateTime(documentRow.uploaded_at))
        + (documentRow.replacement_reason ? ' · ' + cwEscapeHtml(documentRow.replacement_reason) : '') + '</small></li>';
    }).join('');
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
    const metrics = document.getElementById('cwMetrics');
    const list = document.getElementById('cwBatchList');
    const detail = document.getElementById('cwBatchDetail');
    if (!detail) return;
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
      + '<div class="cw-detail-grid"><div>' + cwRenderItems(batch) + cwRenderAudit(batch) + '</div><aside>'
      + cwRenderCurrentDocuments(batch) + cwRenderDocumentHistory(batch) + '</aside></div>';
    if (tabs) tabs.hidden = true;
    if (metrics) metrics.hidden = true;
    if (list) list.hidden = true;
    detail.hidden = false;
    const detailHead = detail.querySelector('.cw-detail-head');
    if (detailHead) detailHead.focus();
  }

  function cwCloseBatch() {
    cwUiState.openBatchId = null;
    cwShowDashboardSurface();
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
    if (!cwCanManage() || cwUiState.model.locksReady !== true) return false;
    cwWizardState.returnFocus = document.activeElement;
    cwResetWizard('create', null);
    return cwOpenDialog();
  }

  async function cwEditBatchItems(batchId) {
    if (!cwCanManage() || cwUiState.model.locksReady !== true || !UUID_PATTERN.test(batchId || '')) return false;
    const batch = (cwUiState.model.batches || []).find(row => row.id === batchId);
    if (!batch || ['completed', 'cancelled'].includes(cwBatchStatus(batch))) return false;
    cwWizardState.returnFocus = document.activeElement;
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
    const returnFocus = cwWizardState.returnFocus;
    if (returnFocus && typeof returnFocus.focus === 'function' && returnFocus.isConnected) returnFocus.focus();
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

  global.CW_STATUS = CW_STATUS;
  global.cwTodayISO = cwTodayISO;
  global.cwItemDisplayStatus = cwItemDisplayStatus;
  global.cwBatchDerivedStatus = cwBatchDerivedStatus;
  global.cwValidatePdf = cwValidatePdf;
  global.cwDocumentPath = cwDocumentPath;
  global.loadCalibrationWorkPage = loadCalibrationWorkPage;
  global.cwRenderDashboard = cwRenderDashboard;
  global.cwSetDashboardTab = cwSetDashboardTab;
  global.cwHandleTabKey = cwHandleTabKey;
  global.cwOpenBatch = cwOpenBatch;
  global.cwCloseBatch = cwCloseBatch;
  global.cwOpenCreate = cwOpenCreate;
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

  if (global.CW_TEST_MODE) return;
})(window);
