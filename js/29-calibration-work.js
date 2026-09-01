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
    awaiting_acknowledgement_pdf: Object.freeze({ label: 'รอแนบแผนรับทราบ', color: '#B45309' }),
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
  const cwUiState = { model: { batches: [] }, tab: 'active', openBatchId: null, loadGeneration: 0 };

  function cwEscapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
    cwUiState.model = model && Array.isArray(model.batches) ? model : { batches: [] };
    cwUiState.tab = 'active';
    cwUiState.openBatchId = null;
    cwShowDashboardSurface();
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

  function cwNormalizeReadModel(batches, items, documents, audit) {
    const byBatch = new Map((batches || []).map(batch => [batch.id, {
      ...batch, items: [], documents: [], audit: []
    }]));
    (items || []).forEach(item => { if (byBatch.has(item.batch_id)) byBatch.get(item.batch_id).items.push(item); });
    (documents || []).forEach(documentRow => {
      if (byBatch.has(documentRow.batch_id)) byBatch.get(documentRow.batch_id).documents.push(documentRow);
    });
    (audit || []).forEach(event => { if (byBatch.has(event.batch_id)) byBatch.get(event.batch_id).audit.push(event); });
    return { batches: [...byBatch.values()] };
  }

  function cwSortReadRows(rows, orderColumn, ascending) {
    return rows.sort((left, right) => {
      const comparison = String(left[orderColumn] || '').localeCompare(String(right[orderColumn] || ''));
      if (comparison) return ascending ? comparison : -comparison;
      return String(left.id || '').localeCompare(String(right.id || ''));
    });
  }

  async function cwReadTable(client, table, columns, orderColumn, ascending) {
    const rows = [];
    let afterId = null;
    while (true) {
      let query = client.from(table).select(columns).order('id', { ascending: true });
      if (afterId) query = query.gt('id', afterId);
      const response = await query.limit(CW_READ_PAGE_SIZE);
      if (response.error) throw new Error(response.error.message || 'Supabase query failed');
      const page = response.data || [];
      rows.push(...page);
      if (page.length < CW_READ_PAGE_SIZE) break;
      const nextId = page[page.length - 1] && page[page.length - 1].id;
      if (!nextId || nextId === afterId) throw new Error('Invalid calibration work pagination cursor');
      afterId = nextId;
    }
    return cwSortReadRows(rows, orderColumn, ascending);
  }

  async function loadCalibrationWorkPage(client) {
    const generation = ++cwUiState.loadGeneration;
    const list = document.getElementById('cwBatchList');
    const tabs = document.getElementById('cwTabs');
    const metrics = document.getElementById('cwMetrics');
    cwUiState.openBatchId = null;
    cwShowDashboardSurface();
    if (tabs) tabs.innerHTML = '';
    if (metrics) metrics.innerHTML = '';
    if (list) list.innerHTML = '<div class="cw-state" role="status"><strong>กำลังโหลดชุดงานสอบเทียบ...</strong></div>';
    try {
      const source = client || (typeof sb !== 'undefined' ? sb : null);
      if (!source || typeof source.from !== 'function') throw new Error('ยังไม่พร้อมเชื่อมต่อฐานข้อมูล');
      const [batches, items, documents, audit] = await Promise.all([
        cwReadTable(source, 'calibration_work_batches', '*', 'updated_at', false),
        cwReadTable(source, 'calibration_work_items', '*, instruments(id,id_code,instrument_name)', 'created_at', true),
        cwReadTable(source, 'calibration_work_documents', '*', 'uploaded_at', false),
        cwReadTable(source, 'calibration_work_audit', '*', 'occurred_at', false)
      ]);
      if (generation !== cwUiState.loadGeneration) return;
      cwRenderDashboard(cwNormalizeReadModel(batches, items, documents, audit));
    } catch (error) {
      if (generation !== cwUiState.loadGeneration) return;
      cwRenderDashboard({ batches: [], error: error && error.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล' });
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
    detail.innerHTML = '<header class="cw-detail-head"><button type="button" onclick="cwCloseBatch()" aria-label="กลับไปรายการชุดงาน">← กลับ</button>'
      + '<div><span>' + cwEscapeHtml(batch.batch_no || '–') + '</span><h1>' + cwEscapeHtml(batch.title || 'ไม่มีชื่อชุดงาน') + '</h1>'
      + '<p>' + cwEscapeHtml(batch.unit_code || '–') + ' · ' + cwEscapeHtml(batch.instrument_type || '–') + '</p></div>'
      + '<span class="cw-status" style="--cw-status:' + meta.color + '">' + cwEscapeHtml(meta.label) + '</span></header>'
      + '<section class="cw-detail-progress"><div><span>ความคืบหน้า</span><b>' + progress.completed + ' / ' + progress.total + '</b></div>'
      + '<span class="cw-progress" aria-label="ความคืบหน้า ' + progress.percent + '%"><span style="width:' + progress.percent + '%"></span></span></section>'
      + '<div class="cw-detail-grid"><div>' + cwRenderItems(batch) + cwRenderAudit(batch) + '</div><aside>'
      + cwRenderCurrentDocuments(batch) + cwRenderDocumentHistory(batch) + '</aside></div>';
    if (tabs) tabs.hidden = true;
    if (metrics) metrics.hidden = true;
    if (list) list.hidden = true;
    detail.hidden = false;
  }

  function cwCloseBatch() {
    cwUiState.openBatchId = null;
    cwShowDashboardSurface();
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

  if (global.CW_TEST_MODE) return;
})(window);
