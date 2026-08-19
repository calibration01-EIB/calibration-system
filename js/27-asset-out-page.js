/* ============================================================
   27-asset-out-page.js — หน้า "นำของออกนอกสถานที่" (ดีไซน์ Calibration App)
   ต่อยอดจาก 18-asset-out.js ที่มีอยู่แล้ว (ออกใบ/พิมพ์ซ้ำ/ประวัติรายเครื่อง)

   หมายเหตุข้อมูล:
   - asset_out_permits ไม่มีคอลัมน์ "เลขที่ใบ" -> format จาก id (PK เรียงตามการสร้าง จึงนิ่ง)
   - returned_at / returned_by / returned_note เพิ่มเข้ามา 2026-08-19
     (migration: asset_out_permits_add_return_tracking) -> ติดตามการรับกลับได้จริงแล้ว
     returned_at = null คือยังไม่รับกลับ
   ============================================================ */

let assetOutPermits = [];

const AO_PURPOSES = {
  calibration: 'ส่งสอบเทียบ',
  repair: 'ส่งซ่อม',
  service: 'ส่งบำรุงรักษา',
  other: 'อื่น ๆ',
};
function aoPurposeLabel(p) {
  if (!p) return '–';
  return AO_PURPOSES[p] || p;
}

function aoPermitNo(p) {
  return 'AO-' + String(p.id).padStart(5, '0');
}

function aoDueState(p) {
  // รับกลับแล้วเป็นสถานะสูงสุด — ไม่ว่าจะเลยกำหนดหรือไม่ ของกลับมาแล้วก็จบ
  if (p.returned_at) {
    const back = new Date(p.returned_at);
    let note = 'รับกลับ ' + back.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
    if (p.due_date) {
      const due = new Date(p.due_date); due.setHours(0, 0, 0, 0);
      const b = new Date(p.returned_at); b.setHours(0, 0, 0, 0);
      const late = Math.round((b - due) / 86400000);
      if (late > 0) note += ' · ช้ากว่ากำหนด ' + late + ' วัน';
    }
    return { key: 'returned', label: 'รับกลับแล้ว', bg: '#e1f5ee', fg: '#0f6e56', note, noteFg: '#5b7186' };
  }
  if (!p.due_date) {
    return { key: 'nodue', label: 'ไม่ระบุกำหนดกลับ', bg: '#eef0f3', fg: '#5f6b7a', note: '', noteFg: '#7a8fa3' };
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(p.due_date); due.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000);
  if (days < 0) {
    return { key: 'overdue', label: 'เกินกำหนดกลับ', bg: '#fde8e8', fg: '#b91c1c',
      note: 'เกิน ' + Math.abs(days) + ' วัน', noteFg: '#d93a3a' };
  }
  return { key: 'out', label: 'ยังไม่ถึงกำหนดกลับ', bg: '#e6f1fb', fg: '#185fa5',
    note: days === 0 ? 'ครบกำหนดวันนี้' : 'อีก ' + days + ' วัน',
    noteFg: days <= 7 ? '#b45309' : '#5b7186' };
}

/* บันทึกรับกลับ — เขียนตรงได้ RLS asset_out_permits_wr = ALL เมื่อ app_current_role() ไม่ null */
async function assetOutMarkReturned(permitId) {
  const p = assetOutPermits.find(x => x.id === permitId);
  if (!p) return;
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  if (!canEdit) { showToast('เฉพาะ Admin หรือ Editor เท่านั้น', 'error'); return; }
  const note = prompt('บันทึกรับ "' + aoPermitNo(p) + '" กลับเข้าบริษัท\nหมายเหตุ (ไม่ใส่ก็ได้):', '');
  if (note === null) return;   // กดยกเลิก
  try {
    const patch = {
      returned_at: new Date().toISOString(),
      returned_by: currentUser?.name || currentUser?.username || null,
      returned_note: note.trim() || null,
    };
    const { error } = await sb.from('asset_out_permits').update(patch).eq('id', permitId);
    if (error) throw error;
    Object.assign(p, patch);
    renderAssetOutTable();
    showToast('บันทึกรับกลับแล้ว', 'success');
  } catch (e) {
    showToast('บันทึกไม่สำเร็จ: ' + (e.message || ''), 'error');
  }
}

async function assetOutUndoReturned(permitId) {
  const p = assetOutPermits.find(x => x.id === permitId);
  if (!p) return;
  if (!(currentUser && currentUser.role === 'admin')) { showToast('เฉพาะ Admin เท่านั้น', 'error'); return; }
  if (!confirm('ยกเลิกการรับกลับของ ' + aoPermitNo(p) + ' ?')) return;
  try {
    const patch = { returned_at: null, returned_by: null, returned_note: null };
    const { error } = await sb.from('asset_out_permits').update(patch).eq('id', permitId);
    if (error) throw error;
    Object.assign(p, patch);
    renderAssetOutTable();
    showToast('ยกเลิกการรับกลับแล้ว', 'success');
  } catch (e) {
    showToast('ยกเลิกไม่สำเร็จ: ' + (e.message || ''), 'error');
  }
}

async function loadAssetOutPage() {
  const tbody = document.getElementById('gateTableBody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="no-data">กำลังโหลด...</td></tr>';
  try {
    const { data, error } = await sb.from('asset_out_permits')
      .select('*').order('permit_date', { ascending: false }).order('id', { ascending: false });
    if (error) throw error;
    assetOutPermits = data || [];
  } catch (e) {
    assetOutPermits = [];
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="no-data" style="color:var(--red)">โหลดไม่สำเร็จ: '
      + escapeHtmlText(e.message || '') + '</td></tr>';
    return;
  }
  renderAssetOutTable();
}

function resetGateFilters() {
  ['gateSearch', 'gateStatusFilter', 'gatePurposeFilter']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  renderAssetOutTable();
}

function setGateStatusFilter(v) {
  const sel = document.getElementById('gateStatusFilter');
  if (sel) sel.value = sel.value === v ? '' : v;
  renderAssetOutTable();
}

function renderGateKpis() {
  const host = document.getElementById('gateKpis');
  if (!host) return;
  const now = new Date();
  const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  let out = 0, overdue = 0, returned = 0;
  assetOutPermits.forEach(p => {
    const k = aoDueState(p).key;
    if (k === 'overdue') overdue++;
    else if (k === 'returned') returned++;
    if (k !== 'returned') out++;          // ยังอยู่ข้างนอก (รวมที่เลยกำหนดและที่ไม่ระบุกำหนด)
  });
  const active = document.getElementById('gateStatusFilter')?.value || '';
  const card = (label, val, unit, fg, bar, filterVal) =>
    '<button type="button" class="ax-rp-kpi' + (filterVal && active === filterVal ? ' is-on' : '') + '" '
    + (filterVal ? 'onclick="setGateStatusFilter(\'' + filterVal + '\')"' : 'style="cursor:default"') + '>'
    + '<span class="ax-rp-bar" style="background:' + bar + '"></span>'
    + '<span class="ax-rp-val"><b style="color:' + fg + '">' + val + '</b><span>' + unit + '</span></span>'
    + '<span class="ax-rp-lb">' + label + '</span></button>';
  host.innerHTML =
    card('ใบนำออกทั้งหมด', assetOutPermits.length.toLocaleString(), 'ใบ', '#0c4a5e', '#0c4a5e', '') +
    card('ยังอยู่ข้างนอก', out, 'ใบ', '#185fa5', '#185fa5', 'open') +
    card('เกินกำหนดกลับ', overdue, 'ใบ', '#b91c1c', '#e03b3b', 'overdue') +
    card('รับกลับแล้ว', returned, 'ใบ', '#0b7a44', '#12a186', 'returned');
}

function renderGatePurposeOptions() {
  const sel = document.getElementById('gatePurposeFilter');
  if (!sel) return;
  const cur = sel.value;
  const vals = [...new Set(assetOutPermits.map(p => p.purpose).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">ทุกวัตถุประสงค์</option>' +
    vals.map(v => '<option value="' + escapeHtmlAttr(v) + '">' + escapeHtmlText(aoPurposeLabel(v)) + '</option>').join('');
  sel.value = vals.includes(cur) ? cur : '';
}

function renderAssetOutTable() {
  const tbody = document.getElementById('gateTableBody');
  if (!tbody) return;
  renderGateKpis();
  renderGatePurposeOptions();

  const q = (document.getElementById('gateSearch')?.value || '').trim().toLowerCase();
  const stF = document.getElementById('gateStatusFilter')?.value || '';
  const puF = document.getElementById('gatePurposeFilter')?.value || '';
  const instOf = id => (typeof allData !== 'undefined' ? (allData || []) : []).find(x => x.id === id) || null;

  const rows = assetOutPermits.filter(p => {
    const k = aoDueState(p).key;
    if (stF === 'open') { if (k === 'returned') return false; }   // ยังอยู่ข้างนอก = ทุกอันที่ยังไม่รับกลับ
    else if (stF && k !== stF) return false;
    if (puF && p.purpose !== puF) return false;
    if (!q) return true;
    const d = instOf(p.instrument_id);
    return [aoPermitNo(p), p.job_order_no, p.vendor_name, p.vendor_contact, p.detail,
      d && d.id_code, d && d.instrument_name]
      .some(v => String(v || '').toLowerCase().includes(q));
  });

  const empty = document.getElementById('gateEmpty');
  if (empty) empty.style.display = rows.length ? 'none' : 'flex';
  const card = tbody.closest('.ax-tablecard');
  const wrap = card && card.querySelector('.table-wrap');
  if (wrap) wrap.style.display = rows.length ? '' : 'none';
  const countLabel = document.getElementById('gateCountLabel');
  if (countLabel) {
    countLabel.textContent = rows.length
      ? 'แสดง ' + rows.length.toLocaleString() + ' จาก ' + assetOutPermits.length.toLocaleString() + ' ใบ'
      : '';
  }
  if (!rows.length) { tbody.innerHTML = ''; return; }

  const fmt = s => s ? new Date(s).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }) : '–';
  const canEdit = currentUser && (currentUser.role === 'admin' || currentUser.role === 'editor');
  const isAdmin = currentUser && currentUser.role === 'admin';

  tbody.innerHTML = rows.map(p => {
    const d = instOf(p.instrument_id);
    const st = aoDueState(p);
    const displayType = d && typeof getDisplayInstrumentType === 'function' ? getDisplayInstrumentType(d) : '';
    const meta = typeof regTypeMeta === 'function' ? regTypeMeta(displayType, d) : ['-', '', '#52667d'];
    const letter = meta[0], color = meta[2];
    const deptText = p.dept_name ? ' · ' + escapeHtmlText(p.dept_name)
      : (d && d.department ? ' · ' + escapeHtmlText(d.department) : '');
    return '<tr>'
      + '<td class="c-no"><span class="ax-rp-when"><b class="ax-mono">' + aoPermitNo(p) + '</b>'
      + (p.job_order_no ? '<span>Job ' + escapeHtmlText(p.job_order_no) + '</span>' : '') + '</span></td>'
      + '<td class="c-inst"><span class="ax-namecell">'
      + '<span class="ax-tletter" style="background:' + color + '1a;color:' + color + ';width:34px;height:34px;border-radius:10px;font-size:15px">'
      + escapeHtmlText(letter) + '</span><span class="ax-nametx">'
      + '<span class="ax-rp-name">' + escapeHtmlText(d ? (d.instrument_name || '–') : 'ไม่พบเครื่องในทะเบียน') + '</span>'
      + '<span class="ax-rp-id">ID: ' + escapeHtmlText(d ? (d.id_code || '?') : '?') + deptText + '</span>'
      + '</span></span></td>'
      + '<td class="c-purpose"><span class="ax-rp-when"><b style="font-weight:400">' + escapeHtmlText(aoPurposeLabel(p.purpose)) + '</b>'
      + (p.detail ? '<span>' + escapeHtmlText(p.detail) + '</span>' : '') + '</span></td>'
      + '<td class="c-vendor"><span class="ax-rp-when"><b style="font-weight:400">' + escapeHtmlText(p.vendor_name || '–') + '</b>'
      + (p.vendor_contact ? '<span>ผู้ติดต่อ ' + escapeHtmlText(p.vendor_contact) + '</span>' : '') + '</span></td>'
      + '<td class="c-out">' + fmt(p.permit_date) + '</td>'
      + '<td class="c-due"><span class="ax-rp-when"><b>' + fmt(p.due_date) + '</b>'
      + (st.note ? '<span style="color:' + st.noteFg + '">' + st.note + '</span>' : '') + '</span></td>'
      + '<td class="c-status"><span class="ax-rp-status" style="background:' + st.bg + ';color:' + st.fg + '">' + st.label + '</span></td>'
      + '<td class="c-by"><span class="ax-rp-when"><b style="font-weight:400">' + escapeHtmlText(p.created_by || '–') + '</b>'
      + (p.returned_by ? '<span>รับกลับโดย ' + escapeHtmlText(p.returned_by) + '</span>' : '') + '</span></td>'
      + '<td class="c-act"><span class="ax-user-acts">'
      + (p.returned_at
          ? (isAdmin ? '<button type="button" class="ax-crc-act" onclick="assetOutUndoReturned(' + p.id + ')" title="ยกเลิกการรับกลับ">↩️</button>' : '')
          : (canEdit ? '<button type="button" class="ax-crc-act is-primary" onclick="assetOutMarkReturned(' + p.id + ')">📥 รับกลับ</button>' : ''))
      + '<button type="button" class="ax-crc-act" onclick="assetOutReprint(' + p.id + ')" title="พิมพ์ใบซ้ำ">🖨️</button>'
      + '</span></td>'
      + '</tr>';
  }).join('');
}
