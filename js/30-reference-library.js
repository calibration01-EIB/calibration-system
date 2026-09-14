/* Cert Reference library: presentation only; source records and editors stay separate. */
const REF_CATEGORIES = [
  ['all', 'ทั้งหมด', '▦'], ['mass', 'มวลและน้ำหนัก', '⚖'],
  ['temperature', 'อุณหภูมิ', '°C'], ['pressure', 'ความดัน', 'Pa'],
  ['length', 'ความยาวและมิติ', '↔'], ['electrical', 'ไฟฟ้า', 'Ω'], ['other', 'อื่น ๆ', '…']
];
const REF_TYPES = [
  ['weights', 'ตุ้มน้ำหนักมาตรฐาน', 'mass'], ['balance', 'เครื่องชั่ง', 'mass'],
  ['temperature', 'อุณหภูมิ', 'temperature'], ['pressure', 'ความดัน', 'pressure'],
  ['length', 'ความยาว/มิติ', 'length'], ['electrical', 'ไฟฟ้า', 'electrical']
];
const REF_STATES = {
  ok: ['ยังไม่ครบกำหนด', 'ok'], warn: ['ใกล้ครบกำหนด', 'warn'], expired: ['หมดอายุ', 'expired'],
  superseded: ['มีใบใหม่แทน', 'muted'], nodue: ['ไม่ระบุวันครบกำหนด', 'muted']
};
let refCategory = 'all', refEntries = [], refPage = 1, refWeightSet = null, refWeightTab = 'current';
const refSources = { weights: 'idle', certs: 'idle' };
const REF_PAGE_SIZE = 20;
const refUnique = values => [...new Set(values.filter(v => v != null && String(v).trim() !== '').map(String))];
const refCanEdit = () => typeof currentUser !== 'undefined' && ['admin', 'editor'].includes(currentUser?.role);
const refIsAdmin = () => typeof currentUser !== 'undefined' && currentUser?.role === 'admin';
const refText = value => escapeHtmlText(String(value == null ? '' : value));

function refType(category) {
  if (category === 'มวล/น้ำหนัก') return REF_TYPES[0];
  return REF_TYPES.find(t => t[1] === category) || [category || 'uncategorized', category || 'ไม่ระบุประเภท', 'other'];
}

function refDateState(date, now = new Date()) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'nodue';
  const due = new Date(date + 'T00:00:00');
  if (!Number.isFinite(due.getTime())) return 'nodue';
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000);
  return days < 0 ? 'expired' : days <= 60 ? 'warn' : 'ok';
}

function refBuildEntries(weights, certs, now = new Date()) {
  const groups = new Map();
  weights.forEach(w => {
    const key = w.set_code || '— ไม่ระบุชุด —';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(w);
  });
  const entries = [...groups].map(([set, rows]) => {
    const dues = refUnique(rows.map(w => w.due_date)).sort();
    const states = rows.map(w => refDateState(w.due_date, now));
    const state = ['expired', 'warn', 'nodue', 'ok'].find(s => states.includes(s));
    const grades = refUnique(rows.map(w => w.class_grade));
    return {
      source: 'weights', id: set, title: set, set, category: 'mass', type: 'weights', typeLabel: 'ตุ้มน้ำหนักมาตรฐาน',
      certNo: refUnique(rows.map(w => w.cert_no)).join(', ') || 'ไม่ระบุเลข Cert',
      grade: grades.join(', '), grades, due: dues[0] || '', state,
      pending: rows.filter(w => w.status !== 'approved').length, count: rows.length, rows,
      search: rows.flatMap(w => [set, w.id_code, w.serial_no, w.cert_no, w.prev_cert_no, w.brand, w.model,
        w.class_grade, String(w.nominal_value) + (w.unit || '')]).join(' ').toLowerCase()
    };
  });
  certs.forEach(c => {
    const [type, typeLabel, category] = refType(c.category);
    const superseded = (c.set_code || c.serial_no) && certs.some(o => o.id !== c.id
      && refType(o.category)[0] === type && o.set_code === c.set_code && o.serial_no === c.serial_no
      && o.measurement_date && c.measurement_date && o.measurement_date > c.measurement_date);
    entries.push({ source: 'certs', id: c.id, title: c.item || c.set_code || c.cert_no || 'ใบรับรอง',
      set: c.set_code || '', category, type, typeLabel, certNo: c.cert_no || 'ไม่ระบุเลข Cert',
      grade: c.class_grade || '', grades: c.class_grade ? [c.class_grade] : [], due: c.due_date || '',
      state: superseded ? 'superseded' : refDateState(c.due_date, now), pending: 0,
      count: (c.values || []).length, record: c,
      search: [c.cert_no, c.set_code, c.item, c.serial_no, c.lab, c.manufacturer, c.category, c.class_grade].join(' ').toLowerCase()
    });
  });
  return entries;
}

function refFilterEntries(entries, filters = {}) {
  const query = (filters.query || '').trim().toLowerCase();
  return entries.filter(e => (!filters.category || filters.category === 'all' || e.category === filters.category)
    && (!filters.type || e.type === filters.type) && (!filters.grade || e.grades.includes(filters.grade))
    && (!filters.status || (filters.status === 'pending' ? e.pending > 0 : e.state === filters.status))
    && (!query || e.search.includes(query) || e.typeLabel.toLowerCase().includes(query)));
}

function refSourceStatus(source, status) {
  refSources[source] = status;
  renderReferenceLibrary();
  if (refWeightSet !== null && source === 'weights' && status === 'ready') renderReferenceWeightDetail();
}

async function loadReferencePage() {
  const refresh = document.getElementById('refRefresh');
  if (refresh) refresh.disabled = true;
  try { await Promise.all([loadStandardWeights(), loadStandardCerts()]); }
  finally { if (refresh) refresh.disabled = false; }
}

function refSetCategory(category) {
  refCategory = REF_CATEGORIES.some(c => c[0] === category) ? category : 'all';
  ['refType', 'refGrade'].forEach(id => { document.getElementById(id).value = ''; });
  refPage = 1; renderReferenceLibrary();
}
function refApplyFilters() { refPage = 1; renderReferenceLibrary(); }
function refResetFilters() {
  ['refSearch', 'refType', 'refGrade', 'refStatus'].forEach(id => { document.getElementById(id).value = ''; });
  refCategory = 'all'; refPage = 1; renderReferenceLibrary();
}
function refGoPage(delta) { refPage += delta; renderReferenceLibrary(); }
function refStatFilter(status) {
  const el = document.getElementById('refStatus');
  el.value = el.value === status ? '' : status;
  refApplyFilters();
}
function refOptions(id, choices, placeholder) {
  const el = document.getElementById(id), previous = el.value;
  el.innerHTML = '<option value="">' + placeholder + '</option>' + choices.map(([value, label]) =>
    '<option value="' + escapeHtmlAttr(value) + '">' + refText(label) + '</option>').join('');
  el.value = choices.some(c => c[0] === previous) ? previous : '';
}

function renderReferenceLibrary() {
  const host = document.getElementById('refResults');
  if (!host) return;
  refEntries = refBuildEntries(typeof swData !== 'undefined' ? swData : [], typeof scData !== 'undefined' ? scData : []);
  const s = id => document.getElementById(id);
  s('refAddMenu').hidden = !refCanEdit();
  s('refCategories').innerHTML = REF_CATEGORIES.map(([id, label, icon]) => {
    const count = refEntries.filter(e => id === 'all' || e.category === id).length;
    return `<button type="button" class="ref-category ${refCategory === id ? 'is-active' : ''}" aria-pressed="${refCategory === id}" onclick="refSetCategory('${id}')">
      <span class="ref-category-icon" aria-hidden="true">${icon}</span><span>${label}</span><b>${count}</b></button>`;
  }).join('');
  const categoryRows = refEntries.filter(e => refCategory === 'all' || e.category === refCategory);
  const types = new Map(REF_TYPES.filter(t => refCategory === 'all' || t[2] === refCategory).map(t => [t[0], t[1]]));
  categoryRows.forEach(e => types.set(e.type, e.typeLabel));
  refOptions('refType', [...types], 'ทุกประเภท');
  const type = s('refType').value;
  const grades = refUnique(categoryRows.filter(e => !type || e.type === type).flatMap(e => e.grades)).sort();
  refOptions('refGrade', grades.map(g => [g, 'Class / Grade ' + g]), 'ทุก Class / Grade');
  s('refGradeField').hidden = !grades.length;
  const filtered = refFilterEntries(refEntries, { category: refCategory, type, grade: s('refGrade').value,
    status: s('refStatus').value, query: s('refSearch').value });
  const rank = { expired: 0, warn: 1, nodue: 2, ok: 3, superseded: 4 };
  filtered.sort((a, b) => rank[a.state] - rank[b.state] || a.title.localeCompare(b.title, 'th', { numeric: true }));
  const pages = Math.max(1, Math.ceil(filtered.length / REF_PAGE_SIZE));
  refPage = Math.max(1, Math.min(refPage, pages));
  const offset = (refPage - 1) * REF_PAGE_SIZE;
  s('refHeading').textContent = (REF_CATEGORIES.find(c => c[0] === refCategory) || REF_CATEGORIES[0])[1];
  s('refCount').textContent = filtered.length + ' รายการ';
  s('refTotal').textContent = refEntries.length;
  s('refExpiring').textContent = refEntries.filter(e => e.state === 'warn').length;
  s('refExpired').textContent = refEntries.filter(e => e.state === 'expired').length;
  s('refPending').textContent = refEntries.filter(e => e.pending > 0).length;
  s('refCountsNote').textContent = 'นับตุ้มน้ำหนักเป็นชุด และเครื่องมือประเภทอื่นเป็นใบ Cert';
  const loading = Object.values(refSources).some(v => v === 'loading' || v === 'idle');
  const failed = Object.entries(refSources).filter(([, v]) => v === 'error').map(([k]) => k === 'weights' ? 'ชุดตุ้มน้ำหนัก' : 'ใบรับรองเครื่องมือ');
  s('refLoadNote').hidden = !loading && !failed.length;
  s('refLoadNote').textContent = failed.length ? 'โหลด' + failed.join(' และ ') + 'ไม่สำเร็จ ข้อมูลอาจไม่ครบ กรุณากดรีเฟรช'
    : 'กำลังโหลดรายการอ้างอิง…';
  host.innerHTML = filtered.length ? filtered.slice(offset, offset + REF_PAGE_SIZE).map(e => {
    const index = refEntries.indexOf(e), [stateLabel, stateClass] = REF_STATES[e.state];
    const icon = REF_CATEGORIES.find(c => c[0] === e.category)[2];
    return `<article class="ref-row">
      <div class="ref-item"><span class="ref-item-icon ref-${e.category}" aria-hidden="true">${icon}</span><div>
        <button type="button" class="ref-title" onclick="refOpenEntry(${index})">${refText(e.title)}</button>
        <span class="ref-sub">Cert ${refText(e.certNo)}</span>
        <span class="ref-sub">${e.source === 'weights' ? e.count + ' ลูกในชุด' : refText(e.set || 'ไม่ระบุชุด') + ' · ' + e.count + ' จุดวัด'}${e.grade ? ' · Class ' + refText(e.grade) : ''}</span>
      </div></div>
      <div class="ref-type-cell"><span class="ref-mobile-label">ประเภท</span>${refText(e.typeLabel)}</div>
      <div class="ref-due"><span class="ref-mobile-label">ครบกำหนด</span><b>${fmtDateTH(e.due)}</b>${e.source === 'weights' && refUnique(e.rows.map(w => w.due_date)).length > 1 ? '<small>วันแรกของชุด</small>' : ''}</div>
      <div class="ref-state-cell"><span class="ref-status ${stateClass}">${stateLabel}</span>${e.pending ? '<small class="ref-pending">รออนุมัติ ' + e.pending + ' ลูก</small>' : ''}</div>
      <button type="button" class="ref-open" onclick="refOpenEntry(${index})" aria-label="ดูรายละเอียด ${escapeHtmlAttr(e.title)}">ดูรายละเอียด <span aria-hidden="true">↗</span></button>
    </article>`;
  }).join('') : `<div class="ref-empty"><span aria-hidden="true">▤</span><h3>${loading ? 'กำลังโหลดข้อมูล' : failed.length ? 'ข้อมูลยังไม่พร้อม' : 'ไม่พบรายการในหมวดนี้'}</h3><p>${loading ? 'รอสักครู่' : failed.length ? 'กดรีเฟรชเพื่อลองโหลดอีกครั้ง' : 'ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง'}</p>${!loading && !failed.length ? '<button type="button" class="ax-ghost-btn" onclick="refResetFilters()">ล้างตัวกรอง</button>' : ''}</div>`;
  s('refPageLabel').textContent = filtered.length ? (offset + 1) + '–' + Math.min(offset + REF_PAGE_SIZE, filtered.length) + ' จาก ' + filtered.length + ' รายการ' : '0 รายการ';
  s('refPrev').disabled = refPage <= 1; s('refNext').disabled = refPage >= pages;
  s('refPagerButtons').hidden = pages <= 1;
}

function refOpenEntry(index) {
  const entry = refEntries[index]; if (!entry) return;
  if (entry.source === 'certs') { openSCDetail(entry.id); return; }
  refWeightSet = entry.set; refWeightTab = 'current';
  renderReferenceWeightDetail();
  document.getElementById('refWeightModal').classList.add('open');
  document.getElementById('refWeightClose').focus();
}
function refCloseWeightDetail() {
  document.getElementById('refWeightModal').classList.remove('open'); refWeightSet = null;
}
function refWeightRows() {
  return (typeof swData !== 'undefined' ? swData : []).filter(w => (w.set_code || '— ไม่ระบุชุด —') === refWeightSet)
    .slice().sort((a, b) => a.nominal_value * (SW_MASS_MG[a.unit] || 1) - b.nominal_value * (SW_MASS_MG[b.unit] || 1));
}
function refWeightSelectTab(tab) { refWeightTab = tab; renderReferenceWeightDetail(); }
function refEditWeight() {
  if (!refCanEdit()) return;
  const set = refWeightSet; refCloseWeightDetail(); openSWSetModal(set);
}
function refDeleteWeight() { if (refCanEdit() && refWeightSet !== null) deleteSWSet(refWeightSet); }
function refApproveWeightSet() { if (refIsAdmin() && refWeightSet !== null) approveSWSet(refWeightSet); }
function refOpenWeightFile(index, previous) {
  const row = refWeightRows()[index];
  const path = row && (previous ? row.prev_cert_file_path : row.cert_file_path);
  if (path) openCertFile(path);
}

function renderReferenceWeightDetail() {
  const rows = refWeightRows();
  if (!rows.length) { refCloseWeightDetail(); return; }
  const pending = rows.filter(w => w.status !== 'approved').length;
  document.getElementById('refWeightTitle').textContent = refWeightSet;
  const tabs = [['current', 'ค่าปัจจุบัน'], ['comparison', 'เปรียบเทียบครั้งก่อน'], ['files', 'ไฟล์ใบ Cert']];
  const nominal = w => refText(w.nominal_value) + (w.marking ? '<sup>' + refText(w.marking) + '</sup>' : '') + ' ' + refText(w.unit);
  let content;
  if (refWeightTab === 'files') {
    const seen = new Set();
    content = '<div class="ref-detail-scroll"><table class="ref-detail-table"><thead><tr><th>ค่าพิกัด / ID</th><th>Cert ปัจจุบัน</th><th>วันที่สอบเทียบ</th><th>ครบกำหนด</th><th>Cert ครั้งก่อน</th></tr></thead><tbody>'
      + rows.map(w => '<tr><td><b>' + nominal(w) + '</b><small>' + refText(w.id_code || '–') + '</small></td><td>' + refText(w.cert_no || '–')
        + '</td><td>' + fmtDateTH(w.cal_date) + '</td><td>' + fmtDateTH(w.due_date) + '</td><td>' + refText(w.prev_cert_no || '–') + '</td></tr>').join('')
      + '</tbody></table></div><div class="ref-files">' + rows.flatMap((w, index) => [false, true].map(previous => {
      const path = previous ? w.prev_cert_file_path : w.cert_file_path;
      if (!path || seen.has(path)) return ''; seen.add(path);
      return `<button type="button" class="ref-file" onclick="refOpenWeightFile(${index},${previous})"><span>PDF</span><div><b>${refText((previous ? w.prev_cert_no : w.cert_no) || 'ใบรับรอง')}</b><small>${previous ? 'ครั้งก่อน' : 'ปัจจุบัน'}</small></div><span aria-hidden="true">↗</span></button>`;
    })).join('') + (seen.size ? '' : '<p class="ref-empty-note">ยังไม่มีไฟล์แนบ สามารถเพิ่มได้ที่ “แก้ไขชุด”</p>') + '</div>';
  } else {
    const comparison = refWeightTab === 'comparison';
    const headers = comparison ? ['ค่าพิกัด / ID', 'ค่าแก้ครั้งก่อน (g)', 'ค่าแก้ปัจจุบัน (g)', 'Drift (mg)', 'Dₛ (mg)']
      : ['ค่าพิกัด / ID', 'S/N · Class', 'ค่าแก้ (g)', 'ค่าจริง', 'U (mg)', 'สถานะ / อนุมัติ'];
    content = '<div class="ref-detail-scroll"><table class="ref-detail-table"><thead><tr>' + headers.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + rows.map(w => {
      const dr = swDrift(w), actual = swActual(w), approved = w.status === 'approved';
      return '<tr><td><b>' + nominal(w) + '</b><small>' + refText(w.id_code || '–') + '</small></td>' + (comparison
        ? '<td>' + swFmtG(w.prev_correction) + '</td><td>' + swFmtG(w.correction) + '</td><td>' + (dr.has ? swTrim(dr.drift, 4) : '–') + '</td><td><b>' + swTrim(dr.Ds, 4) + '</b><small>' + (dr.has ? 'max(U, Drift)' : 'ใช้ U · ไม่มีค่าครั้งก่อน') + '</small></td>'
        : '<td>' + refText(w.serial_no || '–') + '<small>Class ' + refText(w.class_grade || '–') + '</small></td><td>' + swFmtG(w.correction) + '</td><td><b>' + swTrim(actual, 7) + ' ' + refText(w.unit) + '</b></td><td>' + refText(w.uncertainty ?? '–') + '</td><td><span class="ref-status ' + (approved ? 'ok' : 'warn') + '">' + (approved ? 'อนุมัติแล้ว' : 'รออนุมัติ') + '</span>'
          + (refIsAdmin() ? `<button type="button" class="ref-inline-action" onclick="${approved ? 'unapproveSW' : 'approveSW'}(${Number(w.id)})">${approved ? 'ยกเลิกอนุมัติ' : 'อนุมัติ'}</button>` : '') + '</td>') + '</tr>';
    }).join('') + '</tbody></table></div>';
  }
  document.getElementById('refWeightBody').innerHTML = `<div class="ref-detail-summary"><div><b>ตุ้มน้ำหนักมาตรฐาน</b><p>${rows.length} ลูก · ${pending ? 'รออนุมัติ ' + pending + ' ลูก' : 'อนุมัติครบชุด'}</p></div><div class="ref-detail-actions">
    ${refIsAdmin() && pending ? '<button type="button" class="ax-primary-btn" onclick="refApproveWeightSet()">อนุมัติทั้งชุด</button>' : ''}
    ${refCanEdit() ? '<button type="button" class="ax-ghost-btn" onclick="refEditWeight()">แก้ไขชุด</button>' : ''}</div></div>
    <nav class="ref-detail-tabs" aria-label="รายละเอียดชุดตุ้ม">${tabs.map(([id, title]) => `<button type="button" aria-pressed="${refWeightTab === id}" class="${refWeightTab === id ? 'is-active' : ''}" onclick="refWeightSelectTab('${id}')">${title}</button>`).join('')}</nav>
    ${content}<div class="ref-detail-foot"><span>ค่ารายลูกคงหน่วยตามข้อมูลในใบรับรอง</span>${refCanEdit() ? '<button type="button" class="ref-delete" onclick="refDeleteWeight()">ลบชุดนี้</button>' : ''}</div>`;
}

function refAdd(type) {
  if (!refCanEdit()) return;
  document.getElementById('refAddMenu').open = false;
  if (type === 'weights') { openSWSetModal(null); return; }
  const info = REF_TYPES.find(t => t[0] === type);
  openSCEdit(null);
  document.getElementById('scCategory').value = info ? info[1] : 'อื่นๆ';
}
