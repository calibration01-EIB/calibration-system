/* ===== 09-cert.js ===== (generated from index.html inline app script) */
// CERT PAGE
// ====================================================
const CERT_COLORS = { C:'#D85A30',D:'#3B6D11',L:'#185FA5',Q:'#993556',R:'#0F6E56',G:'#BA7517',T:'#D85A30',H:'#185FA5',W:'#888780',P:'#534AB7',B:'#00897B',M:'#639922',F:'#BA7517' };
const CERT_LABELS = {
  C:'pH Meter / Viscometer / DO Meter',
  D:'Digital / Vernier Caliper',
  L:'Thickness / Micrometer / Depth / Height / Penetrometer / Profile / Linear Scale',
  Q:'Flow Meter',
  R:'Steel Ruler / Tape Measure',
  G:'Moisture Tester',
  T:'Temperature',
  H:'Tachometer',
  W:'Timer',
  P:'Pressure',
  B:'Balance',
  M:'Mass',
  F:'Force / Torque',
};
const CERT_CARD_LABELS = {
  C:'pH / Visco / DO',
  D:'Calipers',
  L:'Length Tools',
  Q:'Flow Meter',
  R:'Ruler / Tape',
  G:'Moisture',
  T:'Temperature',
  H:'Tachometer',
  W:'Timer',
  P:'Pressure',
  B:'Balance',
  M:'Mass',
  F:'Force / Torque',
};
const CERT_TYPE_CODES = ['C','D','L','Q','R','G','T','H','W','P','B','M','F'];

function certTypeOptionHtml() {
  return CERT_TYPE_CODES
    .map(code => `<option value="${code}">${code} — ${escapeHtmlText(CERT_CARD_LABELS[code] || CERT_LABELS[code] || code)}</option>`)
    .join('');
}

function renderCertTypeSelectOptions() {
  const historyType = document.getElementById('certHistoryType');
  const issueType = document.getElementById('icTypeCode');
  if (historyType) {
    const value = historyType.value;
    historyType.innerHTML = '<option value="">ทุกประเภท</option>' + certTypeOptionHtml();
    historyType.value = CERT_TYPE_CODES.includes(value) ? value : '';
  }
  if (issueType) {
    const value = issueType.value;
    issueType.innerHTML = '<option value="">-- เลือกประเภท --</option>' + certTypeOptionHtml();
    issueType.value = CERT_TYPE_CODES.includes(value) ? value : '';
  }
}

function normalizeCertNo(value) {
  return String(value || '').trim().toUpperCase();
}

function sortByCertNo(a, b) {
  return normalizeCertNo(a.cert_no).localeCompare(normalizeCertNo(b.cert_no), undefined, { numeric: true, sensitivity: 'base' });
}

async function loadCertPage() {
  renderCertTypeSelectOptions();
  const fmt = s => s ? new Date(s).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}) : '–';
  const fmtDt = s => s ? new Date(s).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
  const yearSel = document.getElementById('certHistoryYear');
  const typeSel = document.getElementById('certHistoryType');
  const limitSel = document.getElementById('certHistoryLimit');
  const yearCode = yearSel ? yearSel.value : '26';
  const typeCode = typeSel ? typeSel.value : '';
  const displayLimit = limitSel ? Number(limitSel.value || 50) : 50;
  const isAdmin = (currentUser && currentUser.role === 'admin');

  const certRowsByType = CERT_TYPE_CODES.reduce((acc, code) => {
    acc[code] = (allData || [])
      .filter(d => normalizeCertNo(d.cert_no).startsWith(`${yearCode}${code}`))
      .sort(sortByCertNo);
    return acc;
  }, {});

  // Type Cards
  const cards = document.getElementById('certTypeCards');
  if (cards) {
    cards.innerHTML = CERT_TYPE_CODES.map(c => {
      const rows = certRowsByType[c] || [];
      const n = rows.length;
      const col = CERT_COLORS[c] || '#888';
      const first = n > 0 ? normalizeCertNo(rows[0].cert_no) : '—';
      const last  = n > 0 ? normalizeCertNo(rows[n - 1].cert_no) : '—';
      const fullLabel = CERT_LABELS[c] || c;
      const cardLabel = CERT_CARD_LABELS[c] || fullLabel;
      return `<div title="${escapeHtmlAttr(`${c} — ${fullLabel}`)}" style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 12px;text-align:center;cursor:default;min-height:78px">
        <div style="font-size:20px;font-weight:700;color:${col};line-height:1">${n}</div>
        <div style="font-size:12px;font-weight:600;color:var(--text);margin-top:4px;line-height:1.25">${c} — ${escapeHtmlText(cardLabel)}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">${first}${n>1?` – ${last}`:''}</div>
      </div>`;
    }).join('');
  }

  // ประวัติ Cert
  const prefix = typeCode ? `${yearCode}${typeCode}` : String(yearCode);
  const history = (allData || []).filter(d => normalizeCertNo(d.cert_no).startsWith(prefix));
  history.sort(sortByCertNo);
  const visibleHistory = history.slice(0, displayLimit);
  const pendingCount = history.filter(d => !d.approved_by).length;
  const countEl = document.getElementById('certHistoryCount');
  if (countEl) {
    countEl.textContent = history.length
      ? `แสดง ${visibleHistory.length} จาก ${history.length} รายการ`
      : '';
  }

  const histBody = document.getElementById('certHistoryBody');
  if (histBody) {
    histBody.innerHTML = history.length === 0
      ? '<tr><td colspan="10" style="padding:16px;text-align:center;color:var(--text3)">ไม่มีข้อมูล</td></tr>'
      : visibleHistory.map((d, i) => {
        const approved = !!d.approved_by;
        const rowBg = approved
          ? (i%2===0?'background:#f0faf5':'background:#e8f5f0')
          : (i%2===0?'':'background:var(--surface2)');
        const certNo = escapeHtmlText(d.cert_no || '–');
        const issueDate = escapeHtmlText(fmt(d.cal_date));
        const instrumentName = escapeHtmlText(d.instrument_name || '–');
        const idCode = escapeHtmlText(d.id_code || '–');
        const requestNo = escapeHtmlText(d.request_no || '–');
        const jobNo = escapeHtmlText(d.job_no || '–');
        const issuedBy = escapeHtmlText(d.issued_by || '–');
        const responsibleBy = escapeHtmlText(d.responsible_by || '–');
        const approvedBy = escapeHtmlText(d.approved_by || '');
        const approvedAt = escapeHtmlText(fmtDt(d.approved_at));
        const approveBtn = isAdmin && !approved
          ? `<button class="cert-action-btn cert-action-approve" onclick="approveCertEntry(${d.id})" title="อนุมัติ">✅</button>`
          : '';
        const editBtn = !approved
          ? `<button class="cert-action-btn cert-action-edit" onclick="openEditCertModal(${d.id})" title="แก้ไข">✏️</button>`
          : `<span class="cert-lock" title="อนุมัติแล้ว ไม่สามารถแก้ไขได้">🔒</span>`;
        const delBtn = isAdmin
          ? `<button class="cert-action-btn cert-action-delete" onclick="deleteCertEntry(${d.id},'${(d.cert_no||'').replace(/'/g,'')}',${approved})" title="ลบ">🗑️</button>`
          : (!approved ? `<button class="cert-action-btn cert-action-delete" onclick="deleteCertEntry(${d.id},'${(d.cert_no||'').replace(/'/g,'')}',false)" title="ลบ">🗑️</button>` : '');
        return `
        <tr style="${rowBg}">
          <td class="cert-index">${i+1}</td>
          <td class="cert-number">${certNo}</td>
          <td class="cert-date">${issueDate}</td>
          <td class="cert-instrument"><strong>${instrumentName}</strong><span class="cert-sub">ID Code: <span class="cert-code">${idCode}</span></span></td>
          <td class="cert-short">${requestNo}</td>
          <td class="cert-short">${jobNo}</td>
          <td class="cert-short">${issuedBy}</td>
          <td class="cert-short">${responsibleBy}</td>
          <td>
            ${approved
              ? `<span class="cert-status approved">อนุมัติแล้ว</span><span class="cert-approved-at">${approvedBy}${approvedAt ? ` · ${approvedAt}` : ''}</span>`
              : `<span class="cert-status pending">รออนุมัติ</span>`}
          </td>
          <td>
            <span class="cert-actions">${approveBtn}${editBtn}${delBtn}</span>
          </td>
        </tr>`;
      }).join('');
  }

  // อัพเดท badge รออนุมัติ
  const badge = document.getElementById('certPendingBadge');
  if (badge) badge.textContent = pendingCount > 0 ? pendingCount : '';

  // แสดง/ซ่อนปุ่ม approve all และ print
  const approveAllBtn = document.getElementById('certApproveAllBtn');
  if (approveAllBtn) approveAllBtn.style.display = (isAdmin && pendingCount > 0) ? 'inline-flex' : 'none';
}

async function approveCertEntry(instrumentId) {
  if (!currentUser || currentUser.role !== 'admin') { showToast('เฉพาะ Admin เท่านั้น', 'error'); return; }
  const d = allData.find(x => x.id === instrumentId);
  if (!d) return;
  if (!confirm(`อนุมัติ Cert: ${d.cert_no}?
ผู้อนุมัติ: ${currentUser.name}`)) return;
  const { error } = await sb.from('instruments').update({
    approved_by: currentUser.name,
    approved_at: new Date().toISOString()
  }).eq('id', instrumentId);
  if (error) { showToast('อนุมัติไม่สำเร็จ: '+error.message, 'error'); return; }
  showToast(`✅ อนุมัติ ${d.cert_no} แล้ว`, 'success');
  await loadData(true);
}

async function approveAllCerts() {
  if (!currentUser || currentUser.role !== 'admin') { showToast('เฉพาะ Admin เท่านั้น', 'error'); return; }
  const yearSel = document.getElementById('certHistoryYear');
  const typeSel = document.getElementById('certHistoryType');
  const yearCode = yearSel ? yearSel.value : '26';
  const typeCode = typeSel ? typeSel.value : '';
  const prefix = typeCode ? `${yearCode}${typeCode}` : String(yearCode);
  const pending = allData.filter(d => d.cert_no && d.cert_no.startsWith(prefix) && !d.approved_by);
  if (!pending.length) { showToast('ไม่มีรายการรออนุมัติ', 'error'); return; }
  if (!confirm(`อนุมัติทั้งหมด ${pending.length} รายการ?
ผู้อนุมัติ: ${currentUser.name}`)) return;
  const ids = pending.map(d => d.id);
  const { error } = await sb.from('instruments').update({
    approved_by: currentUser.name,
    approved_at: new Date().toISOString()
  }).in('id', ids);
  if (error) { showToast('อนุมัติไม่สำเร็จ: '+error.message, 'error'); return; }
  showToast(`✅ อนุมัติ ${pending.length} รายการแล้ว`, 'success');
  await loadData(true);
}

function printCertPage() {
  const yearSel = document.getElementById('certHistoryYear');
  const typeSel = document.getElementById('certHistoryType');
  const yearCode = yearSel ? yearSel.value : '26';
  const typeCode = typeSel ? typeSel.value : '';
  const prefix = typeCode ? `${yearCode}${typeCode}` : String(yearCode);
  const history = allData.filter(d => d.cert_no && d.cert_no.startsWith(prefix));
  history.sort((a,b) => (a.cert_no||'').localeCompare(b.cert_no||''));
  const fmt = s => s ? new Date(s).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}) : '–';

  const rows = history.map((d,i) => `
    <tr>
      <td>${i+1}</td>
      <td style="font-weight:600">${d.cert_no||'–'}</td>
      <td>${fmt(d.cal_date)}</td>
      <td style="text-align:left">${d.instrument_name||'–'} / ${d.id_code||'–'}</td>
      <td>${d.request_no||'–'}</td>
      <td>${d.job_no||'–'}</td>
      <td>${d.issued_by||'–'}</td>
      <td>${d.approved_by||''}</td>
    </tr>`).join('');

  const typeLabel = typeCode ? `${typeCode} — ${CERT_LABELS[typeCode]||typeCode}` : 'ทุกประเภท';
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
  <title>FRM-CAL95</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 9pt; color: #000; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 4px; }
    .logo { width: 40px; height: 40px; }
    .company { font-size: 10pt; font-weight: bold; }
    .company-en { font-size: 8pt; }
    .title { text-align: center; font-size: 11pt; font-weight: bold; margin: 6px 0 2px; }
    .subtitle { text-align: center; font-size: 8pt; margin-bottom: 6px; }
    .type-row { font-size: 9pt; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    th { background: #1a5276; color: white; padding: 4px 6px; text-align: center; border: 0.5px solid #999; font-weight: 500; }
    td { padding: 3px 6px; border: 0.5px solid #ccc; text-align: center; vertical-align: middle; }
    td:nth-child(4) { text-align: left; }
    tr:nth-child(even) { background: #f5f5f5; }
    .footer { margin-top: 8px; font-size: 8pt; color: #555; text-align: right; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head><body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:40px;height:30px;background:#1a5276;border-radius:3px;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:10pt">iLC</div>
      <div>
        <div class="company">บริษัท อินเตอร์เนชั่นแนล แลบบอราทอรีส์ จำกัด</div>
        <div class="company-en">International Laboratories Corp., Ltd.</div>
      </div>
    </div>
    <div style="font-size:8pt">Page 1 of 1</div>
  </div>
  <div class="title">ใบบันทึกการออกหมายเลขลำดับที่ใบรับรองผลการสอบเทียบและการแก้ไข</div>
  <div class="subtitle">( Calibration and correction certificate number issuance sheet )</div>
  <div class="type-row">ประเภทของอุปกรณ์เครื่องมือวัด ( Types of measuring equipment ) ${typeLabel}</div>
  <table>
    <thead>
      <tr>
        <th style="width:4%">ลำดับ</th>
        <th style="width:13%">หมายเลขใบรับรอง</th>
        <th style="width:11%">วันที่ออก</th>
        <th style="width:28%">ชื่ออุปกรณ์ / ID Code</th>
        <th style="width:12%">ใบขอรับบริการ</th>
        <th style="width:9%">เลขที่งาน</th>
        <th style="width:10%">ผู้ออกเอกสาร</th>
        <th style="width:10%">ผู้อนุมัติ</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">FRM-CAL95-01-0967</div>
  <script>window.onload = function(){ window.print(); }<\/script>
  </body></html>`);
  win.document.close();
}

let _editCertId = null;

function openIssueCertModal() {
  _editCertId = null;
  renderCertTypeSelectOptions();
  document.getElementById('icTypeCode').value = '';
  document.getElementById('icIssueDate').value = new Date().toISOString().slice(0,10);
  document.getElementById('icIdCode').value = '';
  document.getElementById('icRequestNo').value = '';
  document.getElementById('icJobNo').value = '';
  document.getElementById('icIssuedBy').value = currentUser ? currentUser.name : '';
  document.getElementById('icResponsibleBy').value = currentUser ? currentUser.name : '';
  document.getElementById('icRemark').value = '';
  document.getElementById('issueCertNo').textContent = '—';
  // populate datalist
  const dl = document.getElementById('icIdCodeList');
  if (dl) dl.innerHTML = allData.filter(d => d.cal_type==='ภายใน').map(d => `<option value="${d.id_code||''}">`).join('');
  document.getElementById('issueCertModal').classList.add('open');
}

function openEditCertModal(instrumentId) {
  const d = allData.find(x => x.id === instrumentId);
  if (!d) return;
  _editCertId = instrumentId;
  renderCertTypeSelectOptions();
  document.getElementById('icTypeCode').value = getCertTypeCode(d.instrument_type, d.instrument_name) || '';
  document.getElementById('icIssueDate').value = d.cal_date || new Date().toISOString().slice(0,10);
  document.getElementById('icIdCode').value = d.id_code || '';
  document.getElementById('icRequestNo').value = d.request_no || '';
  document.getElementById('icJobNo').value = d.job_no || '';
  document.getElementById('icIssuedBy').value = d.issued_by || '';
  document.getElementById('icResponsibleBy').value = d.responsible_by || '';
  document.getElementById('icRemark').value = d.remark || '';
  document.getElementById('issueCertNo').textContent = d.cert_no || '—';
  document.getElementById('issueCertModal').classList.add('open');
}

function closeIssueCertModal() {
  document.getElementById('issueCertModal').classList.remove('open');
  _editCertId = null;
}

function previewCertNo() {
  const typeCode = document.getElementById('icTypeCode')?.value || '';
  const issueDate = document.getElementById('icIssueDate')?.value || '';
  if (!typeCode) { document.getElementById('issueCertNo').textContent = '—'; return; }
  const yr = issueDate ? new Date(issueDate).getFullYear() % 100 : new Date().getFullYear() % 100;
  document.getElementById('issueCertNo').textContent = `${yr}${typeCode}???-0 (รันอัตโนมัติ)`;
}

async function confirmIssueCert() {
  const typeCodeSel = document.getElementById('icTypeCode').value.trim();
  if (!typeCodeSel) { showToast('กรุณาเลือกประเภท (Type)', 'error'); return; }
  const issueDate = document.getElementById('icIssueDate').value.trim();
  if (!issueDate) { showToast('กรุณาระบุวันที่ออกเอกสาร', 'error'); return; }
  const idCode = document.getElementById('icIdCode').value.trim();
  const d = idCode ? allData.find(x => x.id_code === idCode) : null;

  const requestNo = document.getElementById('icRequestNo').value.trim();
  const jobNo = document.getElementById('icJobNo').value.trim();
  const issuedBy = document.getElementById('icIssuedBy').value.trim();
  const responsibleBy = document.getElementById('icResponsibleBy').value.trim();
  const remark = document.getElementById('icRemark').value.trim();

  if (_editCertId) {
    // แก้ไข — ไม่รันเลขใหม่
    const { error } = await sb.from('instruments').update({
      request_no: requestNo||null, job_no: jobNo||null,
      issued_by: issuedBy||null, responsible_by: responsibleBy||null,
      remark: remark||null, cal_date: issueDate||null
    }).eq('id', _editCertId);
    if (error) { showToast('แก้ไขไม่สำเร็จ: '+error.message,'error'); return; }
    showToast('✅ แก้ไขข้อมูล Cert แล้ว','success');
  } else {
    // ออก Cert ใหม่
    const typeCode = typeCodeSel;
    const yearCode = issueDate ? new Date(issueDate).getFullYear() % 100 : new Date().getFullYear() % 100;
    const { data: seqData, error: seqErr } = await sb.from('cert_sequences')
      .select('id,last_number').eq('year_code', yearCode).eq('type_code', typeCode).single();
    let newNumber, seqId;
    if (seqErr || !seqData) {
      const { data: ins } = await sb.from('cert_sequences').insert({ year_code: yearCode, type_code: typeCode, last_number: 1 }).select().single();
      if (!ins) { showToast('ไม่สามารถรันเลข Cert ได้','error'); return; }
      newNumber = 1; seqId = ins.id;
    } else {
      newNumber = seqData.last_number + 1; seqId = seqData.id;
      await sb.from('cert_sequences').update({ last_number: newNumber, updated_at: new Date().toISOString() }).eq('id', seqId);
    }
    const certNo = `${yearCode}${typeCode}${String(newNumber).padStart(3,'0')}-0`;
    if (!d) { showToast('กรุณาระบุ ID Code ที่ถูกต้อง', 'error'); return; }
    const { error } = await sb.from('instruments').update({
      cert_no: certNo, request_no: requestNo||null, job_no: jobNo||null,
      issued_by: issuedBy||null, responsible_by: responsibleBy||null,
      remark: remark||null, cal_date: issueDate||null
    }).eq('id', d.id);
    if (error) {
      await sb.from('cert_sequences').update({ last_number: newNumber-1 }).eq('id', seqId);
      showToast('บันทึก Cert ไม่สำเร็จ: '+error.message,'error'); return;
    }
    await logAudit('แก้ไข', { id_code: d.id_code, cert_no: certNo }, { cert_no: { before: d.cert_no, after: certNo } });
    showToast(`✅ ออก Cert สำเร็จ: ${certNo}`,'success');
  }
  closeIssueCertModal();
  await loadData(true);
  loadCertPage();
}

async function deleteCertEntry(instrumentId, certNo, isApproved) {
  if (!currentUser) return;
  if (isApproved && currentUser.role !== 'admin') {
    showToast('รายการที่อนุมัติแล้ว เฉพาะ Admin เท่านั้นที่ลบได้', 'error'); return;
  }
  const msg = isApproved
    ? `⚠️ รายการนี้อนุมัติแล้ว
ยืนยันลบ Cert: ${certNo}?
(เลขจะถูกล้างออก แต่ข้อมูลเครื่องมือยังอยู่)`
    : `ลบเลข Cert: ${certNo} ออกจากรายการนี้?
(เลขจะถูกล้างออก แต่ข้อมูลเครื่องมือยังอยู่)`;
  if (!confirm(msg)) return;
  const { error } = await sb.from('instruments').update({
    cert_no: null, request_no: null, job_no: null,
    issued_by: null, responsible_by: null,
    approved_by: null, approved_at: null
  }).eq('id', instrumentId);
  if (error) { showToast('ลบไม่สำเร็จ: '+error.message,'error'); return; }
  showToast('✅ ลบเลข Cert แล้ว','success');
  await loadData(true);
  loadCertPage();
}

function exportFrmCal95() {
  const yearSel = document.getElementById('certHistoryYear');
  const typeSel = document.getElementById('certHistoryType');
  const yearCode = yearSel ? yearSel.value : '26';
  const typeCode = typeSel ? typeSel.value : '';
  const prefix = typeCode ? `${yearCode}${typeCode}` : String(yearCode);
  const fmt = s => s ? new Date(s).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}) : '–';
  const rows = allData.filter(d => d.cert_no && d.cert_no.startsWith(prefix));
  rows.sort((a, b) => (a.cert_no||'').localeCompare(b.cert_no||''));
  const wb = XLSX.utils.book_new();
  const header = [
    ['ใบบันทึกการออกหมายเลขลำดับที่ใบรับรองผลการสอบเทียบและการแก้ไข'],
    ['FRM-CAL95'],
    ['ประเภทของอุปกรณ์เครื่องมือวัด: ' + (typeCode ? `${typeCode} — ${CERT_LABELS[typeCode]||typeCode}` : 'ทุกประเภท')],
    [''],
    ['ลำดับที่','หมายเลขใบรับรองผลการสอบเทียบ','วัน-เดือน-ปี ที่ออก','ชื่ออุปกรณ์เครื่องมือวัด / ID CODE','หมายเลขใบขอรับบริการ','เลขที่ของงาน','ผู้ออกเอกสาร','ผู้รับผิดชอบ'],
  ];
  const dataRows = rows.map((d, i) => [
    i+1, d.cert_no||'', fmt(d.cal_date),
    `${d.instrument_name||''} / ${d.id_code||''}`,
    d.request_no||'', d.job_no||'', d.issued_by||'', d.responsible_by||''
  ]);
  const ws = XLSX.utils.aoa_to_sheet([...header, ...dataRows]);
  ws['!cols'] = [{wch:8},{wch:28},{wch:18},{wch:40},{wch:22},{wch:16},{wch:18},{wch:18}];
  ws['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:7} },{ s:{r:1,c:0}, e:{r:1,c:7} },{ s:{r:2,c:0}, e:{r:2,c:7} }];
  XLSX.utils.book_append_sheet(wb, ws, 'FRM-CAL95');
  XLSX.writeFile(wb, `FRM-CAL95_${yearCode}${typeCode||'_ALL'}.xlsx`);
  showToast(`✅ Export FRM-CAL95 สำเร็จ ${rows.length} รายการ`,'success');
}

// ====================================================
