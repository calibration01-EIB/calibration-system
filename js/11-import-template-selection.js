/* ===== 11-import-template-selection.js ===== */
(function installImportTemplateSelectionTools() {
  if (window.__importTemplateSelectionToolsInstalled) return;
  window.__importTemplateSelectionToolsInstalled = true;

  const TEMPLATE_HEADERS = [
    'ประเภทเครื่องมือ', 'ชื่อเครื่องจักร', 'สถานที่ใช้งาน', 'ชื่อเครื่องมือ',
    'ยี่ห้อ/รุ่น', 'Range', 'Tolerance (±)', 'S/N', 'หน่วยงาน', 'ID Code', 'CERT.',
    'วันที่สอบเทียบ', 'วันครบกำหนด', 'ความถี่สอบเทียบ', 'ภายใน/ภายนอก', 'Remark'
  ];

  const TEMPLATE_EXAMPLE = [
    'มวล/น้ำหนัก (Mass/Weight)', 'MIX 1000L', 'ตึก 5/1', 'Electronic Balance',
    'AND/GF-3000', '30 kg', '0.01 g', 'A1234567', 'PMP1', 'PMP1BB01-WI01', '25B001-0',
    '2025-01-15', '2026-01-15', '1 ครั้ง/ปี', 'ภายนอก', ''
  ];

  const selectedIds = window.selectedInstrumentIds instanceof Set ? window.selectedInstrumentIds : new Set();
  window.selectedInstrumentIds = selectedIds;

  function toast(message, type) {
    if (typeof showToast === 'function') showToast(message, type || 'success');
    else console.log(message);
  }

  function getAllRows() {
    return typeof allData !== 'undefined' && Array.isArray(allData) ? allData : [];
  }

  function getFilteredRows() {
    return typeof filteredData !== 'undefined' && Array.isArray(filteredData) ? filteredData : [];
  }

  function getPageSize() {
    return typeof pageSize === 'number' && pageSize > 0 ? pageSize : 100;
  }

  function getCurrentPage() {
    return typeof currentPage === 'number' && currentPage > 0 ? currentPage : 1;
  }

  function getCurrentPageRows() {
    const size = getPageSize();
    const start = (getCurrentPage() - 1) * size;
    return getFilteredRows().slice(start, start + size);
  }

  function getCurrentPageStartIndex() {
    return (getCurrentPage() - 1) * getPageSize();
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

    const names = {
      selected: 'import_template_selected_',
      filtered: 'import_template_filtered_',
      page: 'import_template_page_',
    };
    const fileName = mode && names[mode]
      ? names[mode] + dateCode() + '.xlsx'
      : 'import_template.xlsx';
    XLSX.writeFile(wb, fileName);

    if (actualRows.length) toast('สร้าง Template ' + actualRows.length.toLocaleString() + ' รายการแล้ว', 'success');
    return true;
  }

  function getSelectedInstruments() {
    const byId = new Map(getAllRows().map(row => [String(row.id), row]));
    return Array.from(selectedIds).map(id => byId.get(String(id))).filter(Boolean);
  }

  function updateSelectedCount() {
    const count = selectedIds.size;
    document.querySelectorAll('[data-selected-instrument-count]').forEach(el => {
      el.textContent = count.toLocaleString();
    });
    document.querySelectorAll('[data-requires-selection]').forEach(btn => {
      btn.disabled = count === 0;
      btn.style.opacity = count === 0 ? '.55' : '';
      btn.style.cursor = count === 0 ? 'not-allowed' : '';
    });
    document.querySelectorAll('.instrument-select-checkbox').forEach(input => {
      input.checked = selectedIds.has(String(input.dataset.instrumentId));
    });
  }

  function syncSelectionToolbarVisibility() {
    const toolbar = document.getElementById('importSelectionToolbar');
    if (!toolbar) return;
    const importBtn = document.getElementById('btnImportExcel');
    let hidden = true;
    if (importBtn) {
      const style = getComputedStyle(importBtn);
      const rect = importBtn.getBoundingClientRect();
      hidden = style.display === 'none' || style.visibility === 'hidden' || rect.width <= 0 || rect.height <= 0;
    }
    toolbar.style.display = hidden ? 'none' : 'flex';
  }

  function ensureStyle() {
    if (document.getElementById('import-template-selection-style')) return;
    const style = document.createElement('style');
    style.id = 'import-template-selection-style';
    style.textContent = `
      .instrument-select-cell{display:flex;align-items:center;gap:6px;min-width:54px}
      .instrument-select-checkbox{width:14px;height:14px;accent-color:#00897B;cursor:pointer;flex:none}
      #dataTable tr.instrument-selected-row td{background:#ecfdf5!important}
      .import-selection-toolbar{align-items:center;gap:6px;flex-wrap:wrap}
      .import-selection-toolbar button,.import-template-actions button{border:1.5px solid var(--border);background:var(--surface);color:var(--text2);border-radius:8px;padding:8px 10px;font-family:var(--font);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap}
      .import-selection-toolbar button:hover,.import-template-actions button:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-light)}
      .import-selection-toolbar .primary,.import-template-actions .primary{background:var(--accent);border-color:var(--accent);color:white}
      .import-selection-toolbar .primary:hover,.import-template-actions .primary:hover{background:var(--accent2);color:white}
      .selected-instrument-chip{border:1px solid var(--border);border-radius:999px;padding:6px 10px;background:var(--surface2);font-size:12px;color:var(--text2);white-space:nowrap}
      .import-template-actions{display:flex;gap:8px;flex-wrap:wrap;margin:-4px 0 14px}
    `;
    document.head.appendChild(style);
  }

  function decorateRows() {
    ensureStyle();
    const tbody = document.getElementById('dataTable');
    if (!tbody) return;
    const pageRows = getCurrentPageRows();
    const startIndex = getCurrentPageStartIndex();

    Array.from(tbody.querySelectorAll('tr')).forEach((tr, index) => {
      if (tr.querySelector('.no-data')) return;
      const item = pageRows[index];
      if (!item || item.id == null || !tr.cells || !tr.cells.length) return;
      const id = String(item.id);
      const cell = tr.cells[0];
      if (cell.dataset.selectionInstrumentId !== id || !cell.querySelector('.instrument-select-checkbox')) {
        cell.dataset.selectionInstrumentId = id;
        cell.innerHTML = '';
        const label = document.createElement('label');
        label.className = 'instrument-select-cell';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'instrument-select-checkbox';
        input.dataset.instrumentId = id;
        input.addEventListener('click', event => event.stopPropagation());
        input.addEventListener('change', () => window.toggleInstrumentSelection(id, input.checked));
        const rowNumber = document.createElement('span');
        rowNumber.textContent = String(startIndex + index + 1);
        label.appendChild(input);
        label.appendChild(rowNumber);
        cell.appendChild(label);
      }
      const checked = selectedIds.has(id);
      const input = cell.querySelector('.instrument-select-checkbox');
      if (input) input.checked = checked;
      tr.classList.toggle('instrument-selected-row', checked);
    });
    updateSelectedCount();
  }

  function ensureSelectionToolbar() {
    ensureStyle();
    const controls = document.querySelector('#pageList .controls-bar') || document.querySelector('.controls-bar');
    const importBtn = document.getElementById('btnImportExcel');
    if (!controls || !importBtn || document.getElementById('importSelectionToolbar')) {
      syncSelectionToolbarVisibility();
      updateSelectedCount();
      return;
    }

    const toolbar = document.createElement('div');
    toolbar.id = 'importSelectionToolbar';
    toolbar.className = 'import-selection-toolbar';
    toolbar.innerHTML = `
      <button type="button" data-action="select-page">เลือกหน้านี้</button>
      <button type="button" data-action="select-filtered">เลือกทั้งหมดที่กรอง</button>
      <button type="button" data-action="clear-selection">ล้างที่เลือก</button>
      <button type="button" class="primary" data-action="download-selected" data-requires-selection>Template ที่เลือก</button>
      <span class="selected-instrument-chip">เลือก <strong data-selected-instrument-count>0</strong></span>
    `;
    if (importBtn.parentNode === controls) controls.insertBefore(toolbar, importBtn);
    else controls.appendChild(toolbar);

    toolbar.querySelector('[data-action="select-page"]').addEventListener('click', window.selectCurrentPageInstruments);
    toolbar.querySelector('[data-action="select-filtered"]').addEventListener('click', window.selectFilteredInstruments);
    toolbar.querySelector('[data-action="clear-selection"]').addEventListener('click', window.clearInstrumentSelection);
    toolbar.querySelector('[data-action="download-selected"]').addEventListener('click', window.downloadTemplateFromSelected);
    syncSelectionToolbarVisibility();
    updateSelectedCount();
  }

  function ensureImportTemplateActions() {
    ensureStyle();
    const step = document.getElementById('importStep1');
    if (!step || document.getElementById('importTemplateSelectionActions')) return;
    const anchor = step.querySelector('button[onclick="downloadTemplate()"]');
    const actions = document.createElement('div');
    actions.id = 'importTemplateSelectionActions';
    actions.className = 'import-template-actions';
    actions.innerHTML = `
      <button type="button" class="primary" data-action="modal-selected" data-requires-selection>Template จากที่เลือก (<span data-selected-instrument-count>0</span>)</button>
      <button type="button" data-action="modal-page">Template จากหน้านี้</button>
      <button type="button" data-action="modal-filtered">Template จากรายการที่กรองอยู่</button>
    `;
    if (anchor) anchor.insertAdjacentElement('afterend', actions);
    else step.insertBefore(actions, step.firstChild);
    actions.querySelector('[data-action="modal-selected"]').addEventListener('click', window.downloadTemplateFromSelected);
    actions.querySelector('[data-action="modal-page"]').addEventListener('click', window.downloadTemplateFromCurrentPage);
    actions.querySelector('[data-action="modal-filtered"]').addEventListener('click', window.downloadTemplateFromFiltered);
    updateSelectedCount();
  }

  function refreshSelectionUI() {
    ensureSelectionToolbar();
    ensureImportTemplateActions();
    decorateRows();
    syncSelectionToolbarVisibility();
  }

  window.toggleInstrumentSelection = function toggleInstrumentSelection(id, checked) {
    if (!id) return;
    if (checked) selectedIds.add(String(id));
    else selectedIds.delete(String(id));
    decorateRows();
  };

  window.selectCurrentPageInstruments = function selectCurrentPageInstruments() {
    const rows = getCurrentPageRows();
    rows.forEach(row => { if (row && row.id != null) selectedIds.add(String(row.id)); });
    decorateRows();
    toast('เลือกเครื่องมือในหน้านี้ ' + rows.length.toLocaleString() + ' รายการแล้ว', 'success');
  };

  window.selectFilteredInstruments = function selectFilteredInstruments() {
    const rows = getFilteredRows();
    rows.forEach(row => { if (row && row.id != null) selectedIds.add(String(row.id)); });
    decorateRows();
    toast('เลือกเครื่องมือตาม filter ' + rows.length.toLocaleString() + ' รายการแล้ว', 'success');
  };

  window.clearInstrumentSelection = function clearInstrumentSelection() {
    selectedIds.clear();
    decorateRows();
    toast('ล้างรายการที่เลือกแล้ว', 'success');
  };

  window.getSelectedInstruments = getSelectedInstruments;

  window.downloadTemplateFromSelected = function downloadTemplateFromSelected() {
    const rows = getSelectedInstruments();
    if (!rows.length) {
      toast('ยังไม่ได้เลือกเครื่องมือ ให้ติ๊กเลือกในตารางก่อน', 'error');
      return;
    }
    writeImportTemplate(rows, 'selected');
  };

  window.downloadTemplateFromFiltered = function downloadTemplateFromFiltered() {
    const rows = getFilteredRows();
    if (!rows.length) {
      toast('ไม่มีรายการตาม filter ปัจจุบัน', 'error');
      return;
    }
    writeImportTemplate(rows, 'filtered');
  };

  window.downloadTemplateFromCurrentPage = function downloadTemplateFromCurrentPage() {
    const rows = getCurrentPageRows();
    if (!rows.length) {
      toast('ไม่มีรายการในหน้านี้', 'error');
      return;
    }
    writeImportTemplate(rows, 'page');
  };

  const originalRenderTable = typeof renderTable === 'function' ? renderTable : null;
  if (originalRenderTable) {
    renderTable = window.renderTable = function renderTableWithSelection(...args) {
      const result = originalRenderTable.apply(this, args);
      refreshSelectionUI();
      return result;
    };
  }

  const originalOpenImportModal = typeof openImportModal === 'function' ? openImportModal : null;
  if (originalOpenImportModal) {
    openImportModal = window.openImportModal = function openImportModalWithTemplates(...args) {
      const result = originalOpenImportModal.apply(this, args);
      ensureImportTemplateActions();
      updateSelectedCount();
      return result;
    };
  }

  const originalToggleManageColumns = typeof toggleManageColumns === 'function' ? toggleManageColumns : null;
  if (originalToggleManageColumns) {
    toggleManageColumns = window.toggleManageColumns = function toggleManageColumnsWithSelection(...args) {
      const result = originalToggleManageColumns.apply(this, args);
      setTimeout(refreshSelectionUI, 0);
      return result;
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshSelectionUI);
  } else {
    setTimeout(refreshSelectionUI, 0);
    setTimeout(refreshSelectionUI, 800);
  }
})();
