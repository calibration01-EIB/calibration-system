/* ============================================================
   26-list-ui.js — หน้า "รายการเครื่องมือ" ตามดีไซน์ Calibration App
   2 มุมมอง: สเปก / บัญชีรายการ + ชิปสถานะ + pager แบบใหม่
   (จอมือถือไม่ใช้ตารางเลย — ใช้ #mobileCardList ของเดิมแทน)
   แทน renderTable() เดิม (02-dashboard.js) แต่ยังใช้ตัวกรอง/pagination เดิมทั้งหมด
   ต้องโหลดหลัง 02-dashboard.js / 04-reports.js / 10-router.js
   ============================================================ */

/* มุมมองการ์ดเป็นของฝั่งมือถือเท่านั้น (#mobileCardList + renderMobileCards ใน 02-dashboard.js)
   จอใหญ่จึงมีแค่ 2 มุมมองนี้ — อย่าเพิ่ม 'card' กลับเข้ามาเป็นแท็บ */
const LIST_VIEWS = [
  { k: 'spec', label: 'มุมมองสเปก',      sub: 'ย่าน · ความละเอียด · ค่ายอมรับ' },
  { k: 'full', label: 'บัญชีรายการ',      sub: 'ทุกคอลัมน์ตามฟอร์ม' }
];

let listView = (() => {
  // ต้องกรองค่าเก่าใน localStorage ด้วย ('card' ที่เคยเลือกไว้จะทำให้ไม่มีตารางไหนโชว์เลย)
  let v = 'spec';
  try { v = localStorage.getItem('axListView') || 'spec'; } catch (e) {}
  return LIST_VIEWS.some(x => x.k === v) ? v : 'spec';
})();

const LIST_STATUS_CHIPS = [
  { v: '',          emoji: '📋', label: 'ทั้งหมด',    bg: '#eef4f9', fg: '#0c4a5e', bd: '#d5e1ea' },
  { v: 'overdue',   emoji: '🔴', label: 'เลยกำหนด',   bg: '#fde8e8', fg: '#d93a3a', bd: '#f6cfcf' },
  { v: 'warning',   emoji: '🟡', label: 'ใกล้ครบ',    bg: '#fdf3dd', fg: '#b45309', bd: '#f3e0b6' },
  { v: 'ok',        emoji: '🟢', label: 'ปกติ',       bg: '#e1f5ee', fg: '#0f6e56', bd: '#c4e8dc' },
  { v: 'cancelled', emoji: '⛔', label: 'ยกเลิกสอบเทียบ', bg: '#eef0f3', fg: '#5f6b7a', bd: '#dfe4ea' }
];

let listAdvancedFiltersOpen = false;

function listControlValue(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

function listGetActiveFilterLabels() {
  const labels = [];
  const type = listControlValue('typeFilter');
  const status = listControlValue('statusFilter');
  if (type) labels.push(type.split(' (')[0]);
  if (status) {
    const chip = LIST_STATUS_CHIPS.find(item => item.v === status);
    if (chip) labels.push(chip.label);
  }
  return labels;
}

function listHasActiveFilters() {
  return ['searchInput', 'typeFilter', 'unitFilter', 'monthFilter', 'statusFilter']
    .some(id => listControlValue(id) !== '');
}

function syncListFilterUi() {
  const panel = document.getElementById('listAdvancedPanel');
  const toggle = document.getElementById('listAdvancedToggle');
  const summary = document.getElementById('listFilterSummary');
  const reset = document.getElementById('listResetButton');
  const labels = listGetActiveFilterLabels();

  if (panel) panel.hidden = !listAdvancedFiltersOpen;
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(listAdvancedFiltersOpen));
    const label = toggle.querySelector('span');
    if (label) label.textContent = listAdvancedFiltersOpen ? 'ซ่อนหมวดและสถานะ' : 'เปิดหมวดและสถานะ';
  }
  if (summary) {
    summary.textContent = labels.length ? `กำลังกรอง: ${labels.join(' · ')}` : '';
    summary.hidden = listAdvancedFiltersOpen || labels.length === 0;
  }
  if (reset) reset.hidden = !listHasActiveFilters();
}

function listToggleAdvancedFilters(force) {
  listAdvancedFiltersOpen = typeof force === 'boolean' ? force : !listAdvancedFiltersOpen;
  syncListFilterUi();
}

/* ---------- helper ---------- */

function listLines(value) {
  // แยกหลายย่านจาก newline หรือสแลชที่คั่นระหว่างค่าวัด (มี/ไม่มีช่องว่างก็ได้)
  // เงื่อนไข: หลังสแลชต้องขึ้นต้นด้วยตัวเลข หรือเครื่องหมาย ± + - < > ~ แล้วตามด้วยตัวเลข
  // → แยก "0.01mg/0.1mg", "0.01 mg / 0.1 mg", "± 0.05 mg/± 0.2 mg"
  // → ไม่แยกหน่วยที่มีสแลชในตัว: mg/L, kg/cm2, N/A, 0.5 mg/kg, 10 °C/min
  // ต้องแปลง "+/-" เป็น "±" ก่อนแยก ไม่งั้นสแลชในเครื่องหมายบวกลบจะถูกนับเป็นตัวคั่นย่าน
  // ("+/- 0.01 kg" -> "+" กับ "- 0.01 kg") — ทะเบียนเขียนปนกัน 2 แบบ ±1,188 / +/-366 เครื่อง
  const parts = String(value == null ? '' : value)
    .replace(/\+\s*\/\s*-/g, '±')
    .split(/\r?\n|\s*\/\s*(?=[±+\-<>~]?\s*\d)/)
    .map(s => s.trim()).filter(Boolean);
  return parts.length ? parts : ['–'];
}

function listMultiHtml(value) {
  return '<span class="ax-ml">' + listLines(value)
    .map(t => `<span>${escapeHtmlText(t)}</span>`).join('') + '</span>';
}

function listRangeText(d) {
  if (d.range_val) return d.range_val;
  if (d.capacity != null && d.capacity !== '') return `${d.capacity} ${d.capacity_unit || 'g'}`;
  return '';
}

function listStatusPill(d) {
  const cancelled = d.calibration_cancelled === true
    || (typeof window.isCalibrationCancelled === 'function' && window.isCalibrationCancelled(d));
  const days = d.days_left;
  if (cancelled) return { bg: '#eef0f3', fg: '#5f6b7a', emoji: '⛔', text: 'ยกเลิกสอบเทียบ', days: 'ยกเลิกสอบเทียบ', cancelled: true };
  if (days === null || days === undefined) return { bg: '#eef0f3', fg: '#5f6b7a', emoji: '⚪', text: 'ไม่ระบุ', days: '–', cancelled: false };
  if (days < 0)  return { bg: '#fde8e8', fg: '#d93a3a', emoji: '🔴', text: 'เลยกำหนด', days: 'เกิน ' + Math.abs(days) + ' วัน', cancelled: false };
  if (days <= 30) return { bg: '#fdf3dd', fg: '#b45309', emoji: '🟡', text: 'ใกล้ครบ', days: days === 0 ? 'วันนี้' : 'อีก ' + days + ' วัน', cancelled: false };
  return { bg: '#e1f5ee', fg: '#0f6e56', emoji: '🟢', text: 'ปกติ', days: 'อีก ' + days + ' วัน', cancelled: false };
}

function cwRegistryShortcutHtml(instrumentId) {
  const id = Number(instrumentId);
  const map = typeof calibrationWorkStatusMap !== 'undefined' && calibrationWorkStatusMap
    ? calibrationWorkStatusMap : window.calibrationWorkStatusMap || {};
  const work = Number.isSafeInteger(id) && id > 0 ? map[id] : null;
  if (!work) return '';
  const labels = {
    completed: 'เสร็จแล้ว', overdue: 'เกินแผน', in_progress: 'กำลังสอบเทียบ',
    awaiting_acknowledgement_pdf: 'รอรับทราบ'
  };
  const label = labels[work.status] || work.status || '–';
  const title = [work.title, work.batchNo, work.plannedDate, label].filter(Boolean).join(' · ');
  return '<button type="button" class="cw-registry-shortcut" data-cw-work-status="' + escapeHtmlAttr(work.status || 'unknown')
    + '" data-cw-open-batch-instrument="' + id + '" title="' + escapeHtmlAttr(title) + '"><span>ชุดงาน</span><b>'
    + escapeHtmlText(work.batchNo || '–') + '</b><small>' + escapeHtmlText(work.plannedDate || '–')
    + ' · ' + escapeHtmlText(label) + '</small></button>';
}
window.cwRegistryShortcutHtml = cwRegistryShortcutHtml;

/* ปุ่มงานท้ายแถว (ไฟล์ / วางแผน / ลบ) — ดีไซน์ไม่มีคอลัมน์นี้
   แต่ระบบใช้งานจริงอยู่ จึงคงไว้เป็นคอลัมน์เดียวรวบท้ายตาราง */
function listActionCell(d) {
  const id = Number(d.id) || 0;
  const cancelled = d.calibration_cancelled === true
    || (typeof window.isCalibrationCancelled === 'function' && window.isCalibrationCancelled(d));
  const cnt = typeof fileCountCache !== 'undefined' ? fileCountCache[d.id] : undefined;
  const openCertCall = `openCertModal(${id},'${escapeJsSingle(d.id_code)}','${escapeJsSingle(d.cert_no)}','${escapeJsSingle(d.instrument_name)}')`;
  const fileBtn = `<button type="button" id="certbtn-${id}" class="btn-cert ${cnt > 0 ? 'btn-cert-has' : 'btn-cert-empty'}" onclick="${openCertCall}">📎 ${cnt > 0 ? cnt + ' ไฟล์' : 'ไฟล์'}</button>`;

  let planBtn;
  const workMap = typeof calibrationWorkStatusMap !== 'undefined' && calibrationWorkStatusMap
    ? calibrationWorkStatusMap : window.calibrationWorkStatusMap || {};
  const work = workMap[d.id] || null;
  const activeWork = work && work.isActive !== false;
  if (cancelled) {
    planBtn = '<span class="ax-act-mute">ไม่ต้องวางแผน</span>';
  } else if (!activeWork) {
    planBtn = `<button type="button" class="ax-act-plan" onclick="goToPlanWithItem(${id})">📋 วางแผน</button>`;
  } else {
    planBtn = '';
  }

  const canEdit = typeof currentUser !== 'undefined'
    && (currentUser?.role === 'admin' || currentUser?.role === 'editor');
  const delBtn = canEdit
    ? `<button type="button" class="btn-del" onclick="deleteInstrument(${id},'${escapeJsSingle(d.instrument_name || '')}')">🗑️</button>`
    : '';

  return `<span class="ax-actcell">${fileBtn}${planBtn}${cwRegistryShortcutHtml(id)}${delBtn}</span>`;
}

/* ---------- ชิปสถานะ ---------- */

function renderListStatusChips() {
  const host = document.getElementById('listStatusChips');
  if (!host) return;
  const rows = typeof allData !== 'undefined' ? (allData || []) : [];
  const counts = { '': rows.length, overdue: 0, warning: 0, ok: 0, cancelled: 0 };
  rows.forEach(d => {
    const s = typeof window.getListRowStatus === 'function' ? window.getListRowStatus(d) : null;
    if (s && counts[s] !== undefined) counts[s]++;
  });
  const active = document.getElementById('statusFilter')?.value || '';
  host.innerHTML = LIST_STATUS_CHIPS.map(c => {
    const on = active === c.v;
    const style = on
      ? `background:${c.bg};border-color:${c.fg}66;color:${c.fg}`
      : 'background:#fff;border-color:#d7e3ec;color:#4a6377';
    return `<button type="button" class="ax-chip${on ? ' is-on' : ''}" style="${style}" onclick="listSetStatus('${c.v}')">
      <span class="ax-chip-e">${c.emoji}</span><span>${c.label}</span><b>${(counts[c.v] || 0).toLocaleString()}</b>
    </button>`;
  }).join('');
}

function listSetStatus(value) {
  const sel = document.getElementById('statusFilter');
  if (sel) sel.value = sel.value === value ? '' : value;
  if (typeof filterData === 'function') filterData();
}

/* ---------- พิลหมวดเครื่องมือ (ทับของเดิมเพื่อใส่ชิปตัวอักษรตามดีไซน์) ---------- */

renderListCategoryPills = window.renderListCategoryPills = function () {
  const strip = document.getElementById('listCategoryStrip');
  if (!strip) return;
  const rows = typeof allData !== 'undefined' ? (allData || []) : [];
  const totals = {};
  rows.forEach(d => {
    const type = typeof getDisplayInstrumentType === 'function' ? getDisplayInstrumentType(d) : d.instrument_type;
    if (type) totals[type] = (totals[type] || 0) + 1;
  });
  const current = document.getElementById('typeFilter')?.value || '';

  const pill = (active, onclick, letter, color, label, count) => `
    <button type="button" class="reg-pill${active ? ' active' : ''}" onclick="${onclick}">
      <span class="ax-pill-letter" style="background:${color}1a;color:${color}">${escapeHtmlText(letter)}</span>
      <span>${escapeHtmlText(label)}</span>
      <strong>${count.toLocaleString()}</strong>
    </button>`;

  strip.innerHTML = pill(!current, "setListCategory('')", '★', '#0f8f7d', 'ทั้งหมด', rows.length)
    + Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
      const [letter, , color] = regTypeMeta(type);
      return pill(current === type, `setListCategory('${escapeJsSingle(type)}')`, letter, color, type.split(' (')[0], count);
    }).join('');
};

/* ---------- แท็บมุมมอง ---------- */

function renderListViewTabs() {
  const host = document.getElementById('listViewTabs');
  if (!host) return;
  host.innerHTML = LIST_VIEWS.map(v => `
    <button type="button" class="ax-vtab${listView === v.k ? ' is-on' : ''}" onclick="listSetView('${v.k}')">
      <b>${v.label}</b><span>${v.sub}</span>
    </button>`).join('');
}

function listSetView(view) {
  listView = view;
  try { localStorage.setItem('axListView', view); } catch (e) {}
  renderListViewTabs();
  if (typeof renderTable === 'function') renderTable();
}

/* ---------- มุมมองสเปก ---------- */

const LIST_PHOTO_CACHE = new Map();
const LIST_PHOTO_GENERATION = new Map();
const LIST_PHOTO_TTL_MS = 600000;
const LIST_PHOTO_REFRESH_MARGIN_MS = 60000;
const LIST_PHOTO_EMPTY_TTL_MS = 300000;
const LIST_PHOTO_ERROR_TTL_MS = 30000;
let listPhotoObserver = null;

function listSpecCardHtml(d) {
  const id = Number(d.id) || 0;
  const p = listStatusPill(d);
  const idCode = escapeHtmlText(d.id_code || '–');
  const cert = escapeHtmlText(d.cert_no || '–');
  const due = p.cancelled ? '–' : formatDate(d.due_date);
  return `<article class="ax-spec-card${p.cancelled ? ' is-cancelled' : ''}" data-instrument-id="${id}"
      onclick="if(!event.target.closest('button'))openInstrumentDetail(${id})">
    <div class="ax-spec-media is-loading" data-list-photo-id="${id}" aria-label="กำลังโหลดรูปเครื่องมือ">
      <span class="ax-spec-photo-message">กำลังโหลดรูป...</span>
      <span class="ax-spec-status" style="background:${p.bg};color:${p.fg}">${p.emoji} ${escapeHtmlText(p.text)}</span>
    </div>
    <div class="ax-spec-body">
      <strong class="ax-spec-id" title="${escapeHtmlAttr(d.id_code || '–')}">${idCode}</strong>
      <span class="ax-spec-cert" title="${escapeHtmlAttr(d.cert_no || '–')}">Cert: ${cert}</span>
      <span class="ax-spec-due" style="color:${p.fg}">Due: ${escapeHtmlText(due)}</span>
      ${cwRegistryShortcutHtml(id)}
      <button type="button" class="ax-spec-detail" aria-label="ดูรายละเอียดเครื่องมือ ${idCode}" onclick="event.stopPropagation();openInstrumentDetail(${id})">ดูรายละเอียด</button>
    </div>
  </article>`;
}

function listPhotoFallbackResult(id, state, generation) {
  const ttl = state === 'error' ? LIST_PHOTO_ERROR_TTL_MS : LIST_PHOTO_EMPTY_TTL_MS;
  const result = { state, expiresAt: Date.now() + ttl };
  if ((LIST_PHOTO_GENERATION.get(Number(id)) || 0) === generation) LIST_PHOTO_CACHE.set(Number(id), result);
  return result;
}

async function loadListSpecPhoto(d, forceRefresh = false) {
  const id = Number(d.id) || 0;
  const generation = LIST_PHOTO_GENERATION.get(id) || 0;
  const cached = LIST_PHOTO_CACHE.get(id);
  const cacheFresh = cached && (cached.state === 'ready'
    ? cached.expiresAt - LIST_PHOTO_REFRESH_MARGIN_MS > Date.now()
    : cached.expiresAt > Date.now());
  if (!forceRefresh && cacheFresh) return cached;
  try {
    const folder = instPhotoFolder(d);
    const { data, error } = await sb.storage.from('certificates').list(folder);
    if (error) throw error;
    const imgs = (data || []).filter(f => f.name !== '.emptyFolderPlaceholder' && /\.(jpe?g|png|webp|gif)$/i.test(f.name)).slice(0, INST_PHOTO_MAX);
    if ((LIST_PHOTO_GENERATION.get(id) || 0) !== generation) return { state: 'stale' };
    if (!imgs.length) return listPhotoFallbackResult(id, 'empty', generation);
    const { bySlot } = instPhotoArrange(imgs.map(f => ({ name: f.name })));
    const cover = bySlot.overview || imgs[0];
    const { data: signed, error: signError } = await sb.storage.from('certificates').createSignedUrl(`${folder}/${cover.name}`, 600);
    if (signError || !signed?.signedUrl) throw (signError || new Error('no signed url'));
    if ((LIST_PHOTO_GENERATION.get(id) || 0) !== generation) return { state: 'stale' };
    const result = { state: 'ready', name: cover.name, url: signed.signedUrl, expiresAt: Date.now() + LIST_PHOTO_TTL_MS };
    LIST_PHOTO_CACHE.set(id, result);
    return result;
  } catch (e) {
    if ((LIST_PHOTO_GENERATION.get(id) || 0) !== generation) return { state: 'stale' };
    return listPhotoFallbackResult(id, 'error', generation);
  }
}

function listSpecPhotoEmpty(media) {
  if (!media) return;
  media.classList.remove('is-loading');
  media.classList.add('is-empty');
  media.setAttribute('aria-label', 'ยังไม่มีรูปเครื่องมือ');
  media.querySelectorAll('img').forEach(img => img.remove());
  let message = media.querySelector('.ax-spec-photo-message');
  if (!message) {
    message = document.createElement('span');
    message.className = 'ax-spec-photo-message';
    media.insertBefore(message, media.querySelector('.ax-spec-status'));
  }
  message.textContent = 'ยังไม่มีรูปเครื่องมือ';
}

function renderListSpecPhoto(id, result, refreshed = false) {
  const media = document.querySelector(`[data-list-photo-id="${Number(id)}"]`);
  if (!media) return;
  if (result?.state === 'stale') return;
  if (!result || result.state !== 'ready') { listSpecPhotoEmpty(media); return; }
  media.classList.remove('is-loading', 'is-empty');
  media.setAttribute('aria-label', 'รูปเครื่องมือ');
  const old = media.querySelector('img');
  if (old) old.remove();
  const img = document.createElement('img');
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = '';
  img.src = result.url;
  img.addEventListener('load', () => { const message = media.querySelector('.ax-spec-photo-message'); if (message) message.remove(); });
  img.addEventListener('error', async () => {
    img.remove();
    LIST_PHOTO_CACHE.delete(Number(id));
    if (refreshed) { listSpecPhotoEmpty(media); return; }
    const d = (typeof filteredData !== 'undefined' ? filteredData : []).find(row => Number(row.id) === Number(id));
    if (!d) { listSpecPhotoEmpty(media); return; }
    renderListSpecPhoto(id, await loadListSpecPhoto(d, true), true);
  });
  media.insertBefore(img, media.firstChild);
}

function observeListSpecPhotos(root) {
  if (listPhotoObserver) listPhotoObserver.disconnect();
  const nodes = [...root.querySelectorAll('[data-list-photo-id]')];
  const loadNode = async node => {
    const id = Number(node.dataset.listPhotoId) || 0;
    const d = (typeof filteredData !== 'undefined' ? filteredData : []).find(row => Number(row.id) === id);
    if (d) renderListSpecPhoto(id, await loadListSpecPhoto(d));
  };
  if (!('IntersectionObserver' in window)) { nodes.forEach(loadNode); return; }
  listPhotoObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    listPhotoObserver.unobserve(entry.target);
    loadNode(entry.target);
  }), { rootMargin: '240px 0px' });
  nodes.forEach(node => listPhotoObserver.observe(node));
}

function invalidateListPhotoCache(id) {
  const key = Number(id) || 0;
  LIST_PHOTO_GENERATION.set(key, (LIST_PHOTO_GENERATION.get(key) || 0) + 1);
  LIST_PHOTO_CACHE.delete(key);
  const media = document.querySelector(`[data-list-photo-id="${key}"]`);
  if (!media) return;
  media.classList.remove('is-empty');
  media.classList.add('is-loading');
  let message = media.querySelector('.ax-spec-photo-message');
  if (!message) {
    message = document.createElement('span');
    message.className = 'ax-spec-photo-message';
    media.insertBefore(message, media.querySelector('.ax-spec-status'));
  }
  message.textContent = 'กำลังโหลดรูป...';
  observeListSpecPhotos(document.getElementById('listSpecGrid'));
}
window.invalidateListPhotoCache = invalidateListPhotoCache;

function renderListSpec(rows) {
  const grid = document.getElementById('listSpecGrid');
  if (!grid) return;
  grid.innerHTML = rows.map(listSpecCardHtml).join('');
  observeListSpecPhotos(grid);
}

/* ---------- มุมมองบัญชีรายการ ---------- */

function renderListFull(rows, start) {
  const tbody = document.getElementById('dataTableFull');
  if (!tbody) return;
  tbody.innerHTML = rows.map((d, i) => {
    const id = Number(d.id) || 0;
    const displayType = typeof getDisplayInstrumentType === 'function' ? getDisplayInstrumentType(d) : d.instrument_type;
    const [letter, , color] = regTypeMeta(displayType, d);
    const p = listStatusPill(d);
    const internal = d.cal_type === 'ภายใน' ? '✓' : '';
    const external = d.cal_type === 'ภายนอก' ? '✓' : '';
    return `<tr class="${p.cancelled ? 'reg-cancelled' : ''}" onclick="if(!event.target.closest('button'))openInstrumentDetail(${id})" title="คลิกเพื่อดูรายละเอียด">
      <td class="c-no">${start + i + 1}</td>
      <td class="c-name">
        <div class="ax-namecell">
          <span class="ax-tletter" style="background:${color}1a;color:${color}">${escapeHtmlText(letter)}</span>
          <span class="ax-nametx">${listMultiHtml(d.instrument_name)}</span>
        </div>
      </td>
      <td class="ax-mono">${escapeHtmlText(d.machine_name || '–')}</td>
      <td>${listMultiHtml(d.id_code)}</td>
      <td>${escapeHtmlText(d.brand || '–')}</td>
      <td class="ax-mono">${escapeHtmlText(d.model || '–')}</td>
      <td class="ax-mono">${escapeHtmlText(d.serial_no || '–')}</td>
      <td>${listMultiHtml(d.resolution_text || d.resolution)}</td>
      <td>${listMultiHtml(d.tolerance)}</td>
      <td>${listMultiHtml(listRangeText(d))}</td>
      <td>${listMultiHtml(d.usage_min)}</td>
      <td>${listMultiHtml(d.usage_max)}</td>
      <td>${escapeHtmlText(d.usage_frequency || '–')}</td>
      <td>${escapeHtmlText(d.cal_frequency || '–')}</td>
      <td class="c-loc">${escapeHtmlText([d.department, d.division, d.location].filter(Boolean).join(' · ') || '–')}</td>
      <td class="ax-mark">${internal}</td>
      <td class="ax-mark">${external}</td>
      <td class="ax-usp">${escapeHtmlText(d.usp_type || '–')}</td>
      <td class="c-status"><span class="ax-pill" style="background:${p.bg};color:${p.fg}">${p.emoji} ${escapeHtmlText(p.text)}</span>${cwRegistryShortcutHtml(id)}</td>
    </tr>`;
  }).join('');
}

/* ---------- ตัววาดหลัก (แทน renderTable เดิม) ---------- */

function renderListPage() {
  if (typeof window.normalizeListRows === 'function') {
    window.normalizeListRows(typeof allData !== 'undefined' ? allData : []);
    window.normalizeListRows(typeof filteredData !== 'undefined' ? filteredData : []);
  }

  const rowsAll = typeof filteredData !== 'undefined' ? (filteredData || []) : [];
  const size = typeof pageSize === 'number' && pageSize > 0 ? pageSize : 100;
  const totalPages = Math.max(1, Math.ceil(rowsAll.length / size));
  if (typeof currentPage !== 'number' || currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * size;
  const pageRows = rowsAll.slice(start, start + size);

  const empty = rowsAll.length === 0;
  const show = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
  show('listSpecCard', !empty && listView === 'spec');
  show('listFullCard', !empty && listView === 'full');
  show('listEmpty', empty);

  if (empty) {
    const grid = document.getElementById('listSpecGrid');
    if (grid) grid.innerHTML = '';
    const tf = document.getElementById('dataTableFull');
    if (tf) tf.innerHTML = '<tr><td colspan="19" class="no-data">ไม่พบข้อมูล</td></tr>';
  } else if (listView === 'full') {
    renderListFull(pageRows, start);
  } else {
    renderListSpec(pageRows, start);
  }

  const label = document.getElementById('listResultLabel');
  if (label) {
    const total = typeof allData !== 'undefined' ? (allData || []).length : 0;
    label.textContent = rowsAll.length === total
      ? `ทั้งหมด ${total.toLocaleString()} รายการ`
      : `พบ ${rowsAll.length.toLocaleString()} รายการ จากทั้งหมด ${total.toLocaleString()} รายการ`;
  }

  renderListStatusChips();
  syncListFilterUi();
  if (typeof updatePaginationUI === 'function') updatePaginationUI();
  if (typeof updateFileCounts === 'function' && listView === 'spec') updateFileCounts(pageRows);
  if (typeof renderMobileCards === 'function') renderMobileCards();
}

/* แทนที่ renderTable เดิม (10-router ห่อไว้เพื่อ normalize — เราทำเองแล้ว) */
renderTable = window.renderTable = renderListPage;

document.addEventListener('click', event => {
  const shortcut = event.target && event.target.closest && event.target.closest('[data-cw-open-batch-instrument]');
  if (!shortcut) return;
  event.preventDefault();
  event.stopPropagation();
  const instrumentId = Number(shortcut.dataset.cwOpenBatchInstrument);
  if (Number.isSafeInteger(instrumentId) && instrumentId > 0
      && typeof window.cwOpenBatchFromInstrument === 'function') {
    void window.cwOpenBatchFromInstrument(instrumentId);
  }
}, true);

/* หมายเหตุ: toggleManageColumns ถูกทำให้ null-safe ที่ต้นทาง (03-instruments.js) แล้ว
   ห้าม override ที่นี่ เพราะ enterApp() เรียกมันตั้งแต่ตอนโหลด 10-router.js
   ซึ่งเร็วกว่าไฟล์นี้ — ตัวที่ทำงานจริงคือของ 03-instruments.js เสมอ */

document.addEventListener('DOMContentLoaded', () => {
  listAdvancedFiltersOpen = false;
  renderListViewTabs();
  renderListStatusChips();
  syncListFilterUi();
});
