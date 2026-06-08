/* ===== 12-import-template-selection-visibility.js ===== */
(function installImportTemplateSelectionVisibilityPatch() {
  if (window.__importTemplateSelectionVisibilityPatchInstalled) return;
  window.__importTemplateSelectionVisibilityPatchInstalled = true;

  function isActuallyVisible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function syncToolbarVisibility() {
    const toolbar = document.getElementById('importSelectionToolbar');
    if (!toolbar) return;
    toolbar.style.display = isActuallyVisible(document.getElementById('btnImportExcel')) ? 'flex' : 'none';
  }

  function scheduleSync() {
    setTimeout(syncToolbarVisibility, 0);
    setTimeout(syncToolbarVisibility, 80);
  }

  const currentRenderTable = typeof renderTable === 'function' ? renderTable : null;
  if (currentRenderTable && !currentRenderTable.__importSelectionVisibilityPatched) {
    const wrappedRenderTable = function renderTableWithSelectionVisibility(...args) {
      const result = currentRenderTable.apply(this, args);
      scheduleSync();
      return result;
    };
    wrappedRenderTable.__importSelectionVisibilityPatched = true;
    renderTable = window.renderTable = wrappedRenderTable;
  }

  const currentShowPage = typeof showPage === 'function' ? showPage : null;
  if (currentShowPage && !currentShowPage.__importSelectionVisibilityPatched) {
    const wrappedShowPage = function showPageWithSelectionVisibility(...args) {
      const result = currentShowPage.apply(this, args);
      scheduleSync();
      return result;
    };
    wrappedShowPage.__importSelectionVisibilityPatched = true;
    showPage = window.showPage = wrappedShowPage;
  }

  const currentToggleManageColumns = typeof toggleManageColumns === 'function' ? toggleManageColumns : null;
  if (currentToggleManageColumns && !currentToggleManageColumns.__importSelectionVisibilityPatched) {
    const wrappedToggleManageColumns = function toggleManageColumnsWithSelectionVisibility(...args) {
      const result = currentToggleManageColumns.apply(this, args);
      scheduleSync();
      return result;
    };
    wrappedToggleManageColumns.__importSelectionVisibilityPatched = true;
    toggleManageColumns = window.toggleManageColumns = wrappedToggleManageColumns;
  }

  document.addEventListener('click', scheduleSync, true);
  window.addEventListener('resize', scheduleSync);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleSync);
  else scheduleSync();
  setTimeout(scheduleSync, 1000);
  setTimeout(scheduleSync, 2500);
})();
