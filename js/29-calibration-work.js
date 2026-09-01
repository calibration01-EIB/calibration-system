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

  global.CW_STATUS = CW_STATUS;
  global.cwTodayISO = cwTodayISO;
  global.cwItemDisplayStatus = cwItemDisplayStatus;
  global.cwBatchDerivedStatus = cwBatchDerivedStatus;
  global.cwValidatePdf = cwValidatePdf;
  global.cwDocumentPath = cwDocumentPath;

  if (global.CW_TEST_MODE) return;
})(window);
