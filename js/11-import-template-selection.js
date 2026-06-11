/* ===== 11-import-template-selection.js ===== */
(function installImportTemplateModalTools() {
  if (window.__importTemplateModalToolsInstalled) return;
  window.__importTemplateModalToolsInstalled = true;

  const TEMPLATE_HEADERS = [
    'ประเภทเครื่องมือ', 'ชื่อเครื่องจักร', 'สถานที่ใช้งาน', 'ชื่อเครื่องมือ',
    'ยี่ห้อ/รุ่น', 'Range', 'Tolerance (±)', 'S/N', 'หน่วยงาน', 'ID Code', 'CERT.',
    'วันที่สอบเทียบ', 'วันครบกำหนด', 'ความถี่สอบเทียบ', 'ภายใน/ภายนอก', 'Remark'
  ];

  const TEMPLATE_EXAMPLE = [
    'เครื่องชั่ง (Balance)', 'MIX 1000L', 'ตึก 5/1', 'Electronic Balance',
    'AND/GF-3000', '30 kg', '0.01 g', 'A1234567', 'PMP1', 'PMP1BB01-WI01', '25B001-0',
    '2025-01-15', '2026-01-15', '1 ครั้ง/ปี', 'ภายนอก', ''
  ];

  function toast(message, type) {
    if (typeof showToast === 'function') showToast(message, type || 'success');
    else console.log(message);
  }

  function getFilteredRows() {
    return typeof filteredData !== 'undefined' && Array.isArray(filteredData) ? filteredData : [];
  }

  function getCurrentPageRows() {
    const size = typeof pageSize === 'number' && pageSize > 0 ? pageSize : 100;
    const page = typeof currentPage === 'number' && currentPage > 0 ? currentPage : 1;
    const start = (page - 1) * size;
    return getFilteredRows().slice(start, start + size);
  }

  function toText(value) {
    return value == null ? '' : String(value).trim();
  }

  function cleanTolerance(value) {
    return toText(value).replace(/^±\s*/, '');
  }

  function cleanRemark(value) {
    const raw = toText(value);
    return typeof window.stripCalibrationCancelMarker === 'function'
      ? window.stripCalibrationCancelMarker(raw)
      : raw;
  }

  function rowToTemplate(row) {
    return [
      row.instrument_type,
      row.machine_name,
      row.location,
      row.instrument_name,
      row.brand,
      row.range_val,
      cleanTolerance(row.tolerance),
      row.serial_no,
      row.department,
      row.id_code,
      row.cert_no,
      row.cal_date,
      row.due_date,
      row.cal_frequency,
      row.cal_type,
      cleanRemark(row.remark)
    ].map(toText);
  }

  function dateCode() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }

  function writeImportTemplate(rows, mode) {
    if (typeof XLSX === 'undefined') {
      toast('โหลด SheetJS ไม่สำเร็จ', 'error');
      return false;
    }

    const actualRows = Array.isArray(rows) ? rows.filter(row => row && row.id_code) : [];
    const dataRows = actualRows.length ? actualRows.map(rowToTemplate) : [TEMPLATE_EXAMPLE];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...dataRows]);
    ws['!cols'] = [32, 22, 18, 24, 22, 14, 16, 18, 14, 20, 16, 16, 16, 20, 16, 28].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, 'Template');

    const fileName = mode === 'filtered'
      ? 'import_template_filtered_' + dateCode() + '.xlsx'
      : mode === 'page'
        ? 'import_template_page_' + dateCode() + '.xlsx'
        : 'import_template.xlsx';
    XLSX.writeFile(wb, fileName);

    if (actualRows.length) toast('สร้าง Template ' + actualRows.length.toLocaleString() + ' รายการแล้ว', 'success');
    return true;
  }

  function ensureStyle() {
    if (document.getElementById('import-template-modal-style')) return;
    const style = document.createElement('style');
    style.id = 'import-template-modal-style';
    style.textContent = `
      .import-template-actions{display:flex;gap:8px;flex-wrap:wrap;margin:-4px 0 14px}
      .import-template-actions button{border:1.5px solid var(--border);background:var(--surface);color:var(--text2);border-radius:8px;padding:8px 12px;font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}
      .import-template-actions button:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-light)}
      .import-template-actions .primary{background:var(--accent);border-color:var(--accent);color:white}
      .import-template-actions .primary:hover{background:var(--accent2);color:white}
    `;
    document.head.appendChild(style);
  }

  function removeLegacySelectionUi() {
    document.getElementById('importSelectionToolbar')?.remove();
    if (document.querySelector('.instrument-select-checkbox') && typeof renderTable === 'function') {
      renderTable();
    }
  }

  function ensureImportTemplateActions() {
    ensureStyle();
    removeLegacySelectionUi();

    const step = document.getElementById('importStep1');
    if (!step) return;

    const oldActions = document.getElementById('importTemplateSelectionActions');
    if (oldActions) oldActions.remove();

    const anchor = step.querySelector('button[onclick="downloadTemplate()"]');
    const actions = document.createElement('div');
    actions.id = 'importTemplateSelectionActions';
    actions.className = 'import-template-actions';
    actions.innerHTML = `
      <button type="button" class="primary" data-action="modal-page">Template จากหน้านี้</button>
      <button type="button" data-action="modal-filtered">Template จากรายการที่กรองอยู่</button>
    `;
    if (anchor) anchor.insertAdjacentElement('afterend', actions);
    else step.insertBefore(actions, step.firstChild);

    actions.querySelector('[data-action="modal-page"]').addEventListener('click', window.downloadTemplateFromCurrentPage);
    actions.querySelector('[data-action="modal-filtered"]').addEventListener('click', window.downloadTemplateFromFiltered);
  }

  window.downloadTemplateFromCurrentPage = function downloadTemplateFromCurrentPage() {
    const rows = getCurrentPageRows();
    if (!rows.length) {
      toast('ไม่มีรายการในหน้านี้', 'error');
      return;
    }
    writeImportTemplate(rows, 'page');
  };

  window.downloadTemplateFromFiltered = function downloadTemplateFromFiltered() {
    const rows = getFilteredRows();
    if (!rows.length) {
      toast('ไม่มีรายการตาม filter ปัจจุบัน', 'error');
      return;
    }
    writeImportTemplate(rows, 'filtered');
  };

  const originalOpenImportModal = typeof openImportModal === 'function' ? openImportModal : null;
  if (originalOpenImportModal) {
    openImportModal = window.openImportModal = function openImportModalWithTemplateButtons(...args) {
      const result = originalOpenImportModal.apply(this, args);
      ensureImportTemplateActions();
      return result;
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      removeLegacySelectionUi();
      ensureImportTemplateActions();
    });
  } else {
    setTimeout(() => {
      removeLegacySelectionUi();
      ensureImportTemplateActions();
    }, 0);
  }
})();
