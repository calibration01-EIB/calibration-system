/* ===== 09-cert.js ===== (extracted from index.html lines 4306-4637) */
const CERT_COLORS = { B:'#00897B',T:'#185FA5',F:'#BA7517',M:'#639922',H:'#993556',P:'#534AB7',C:'#D85A30',D:'#3B6D11',E:'#0F6E56',Q:'#888780',G:'#BA7517',L:'#185FA5' };
const CERT_LABELS = { B:'Balance',T:'Torque/Safety',F:'Light/Sound',M:'Mass Weight',H:'Flow/Volume',P:'Pressure',C:'Temperature',D:'Chemical',E:'Electrical',Q:'Time/Others',G:'Speed/Rotation',L:'Length' };

// อัพเดท badge จำนวน Cert ที่ยังไม่อนุมัติ (นับทั้งหมดจาก allData, เฉพาะ Admin)
function updateCertBadge() {
  const navBadge = document.getElementById('certPendingBadge');
  if (!navBadge) return;
  const isAdmin = (currentUser && currentUser.role === 'admin');
  const n = isAdmin ? (allData || []).filter(d => d.cert_no && !d.approved_by).length : 0;
  navBadge.textContent = n > 0 ? n : '';
  navBadge.style.display = n > 0 ? 'inline-flex' : 'none';
}

async function loadCertPage() {
  const fmt = s => s ? new Date(s).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'}) : '–';
  const fmtDt = s => s ? new Date(s).toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
  const yearSel = document.getElementById('certHistoryYear');
  const typeSel = document.getElementById('certHistoryType');
  const yearCode = yearSel ? yearSel.value : '26';
  const typeCode = typeSel ? typeSel.value : '';
  const isAdmin = (currentUser && currentUser.role === 'admin');

  // Type Cards
  const { data: seqData } = await sb.from('cert_sequences').select('*').eq('year_code', parseInt(yearCode)).order('type_code');
  const cards = document.getElementById('certTypeCards');
  if (cards) {
    const codes = ['B','T','F','M','H','P','C','D','E','Q','G','L'];
    const seqMap = {};
    (seqData||[]).forEach(s => { seqMap[s.type_code] = s.last_number; });
    cards.innerHTML = codes.map(c => {
      const n = seqMap[c] || 0;
      const col = CERT_COLORS[c] || '#888';
      const first = n > 0 ? `${yearCode}${c}001` : '—';
      const last  = n > 0 ? `${yearCode}${c}${String(n).padStart(3,'0')}` : '—';
      return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 12px;text-align:center;cursor:default">
        <div style="font-size:20px;font-weight:700;color:${col};line-height:1">${n}</div>
        <div style="font-size:12px;font-weight:600;color:var(--text);margin-top:4px">${c} — ${CERT_LABELS[c]||c}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">${first}${n>1?` – ${last}`:''}</div>
      </div>`;
    }).join('');
  }

  // ประวัติ Cert
  const prefix = typeCode ? `${yearCode}${typeCode}` : String(yearCode);
  const history = allData.filter(d => d.cert_no && d.cert_no.startsWith(prefix));
  history.sort((a, b) => (a.cert_no||'').localeCompare(b.cert_no||''));
  const pendingCount = history.filter(d => !d.approved_by).length;

  const histBody = document.getElementById('certHistoryBody');
  if (histBody) {
    histBody.innerHTML = history.length === 0
      ? '<tr><td colspan="10" style="padding:16px;text-align:center;color:var(--text3)">ไม่มีข้อมูล</td></tr>'
      : history.map((d, i) => {
        const approved = !!d.approved_by;
        const rowBg = approved
          ? (i%2===0?'background:#f0faf5':'background:#e8f5f0')
          : (i%2===0?'':'background:var(--surface2)');
        const approveBtn = isAdmin && !approved
          ? `<button onclick="approveCertEntry(${d.id})" title="อนุมัติ" style="background:#e8f5e9;border:1px solid #43a047;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px;color:#2e7d32;margin-right:4px">✅</button>`
          : '';
        const editBtn = !approved
          ? `<button onclick="openEditCertModal(${d.id})" style="background:var(--accent-light);border:1px solid var(--accent);border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px;color:var(--accent);margin-right:4px">✏️</button>`
          : `<span title="อนุมัติแล้ว ไม่สามารถแก้ไขได้" style="font-size:11px;color:var(--text3)">🔒</span>`;
        const delBtn = isAdmin
          ? `<button onclick="deleteCertEntry(${d.id},'${(d.cert_no||'').replace(/'/g,'')}',${approved})" style="background:var(--red-light);border:1px solid var(--red);border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px;color:var(--red)">🗑️</button>`
          : (!approved ? `<button onclick="deleteCertEntry(${d.id},'${(d.cert_no||'').replace(/'/g,'')}',false)" style="background:var(--red-light);border:1px solid var(--red);border-radius:6px;padding:2px 8px;cursor:pointer;font-size:11px;color:var(--red)">🗑️</button>` : '');
        return `
        <tr style="border-bottom:1px solid var(--border);${rowBg}">
          <td style="padding:7px 10px;color:var(--text3)">${i+1}</td>
          <td style="padding:7px 10px;font-family:var(--mono);font-weight:600;color:var(--accent)">${d.cert_no||'–'}</td>
          <td style="padding:7px 10px;font-size:11px">${fmt(d.cal_date)}</td>
          <td style="padding:7px 10px;font-size:11px">${d.instrument_name||'–'} / <span style="font-family:var(--mono)">${d.id_code||'–'}</span></td>
          <td style="padding:7px 10px;font-size:11px">${d.request_no||'–'}</td>
          <td style="padding:7px 10px;font-size:11px">${d.job_no||'–'}</td>
          <td style="padding:7px 10px;font-size:11px">${d.issued_by||'–'}</td>
          <td style="padding:7px 10px;font-size:11px">
            ${approved
              ? `<span style="color:#2e7d32;font-weight:600">${d.approved_by}</span><br><span style="font-size:10px;color:var(--text3)">${fmtDt(d.approved_at)}</span>`
              : `<span style="color:var(--text3);font-size:11px">รออนุมัติ</span>`}
          </td>
          <td style="padding:7px 10px;white-space:nowrap">
            ${approveBtn}${editBtn}${delBtn}
          </td>
        </tr>`;
      }).join('');
  }

  // อัพเดท badge รออนุมัติ (นับทั้งหมดจาก allData)
  updateCertBadge();

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
  </style></head><body>
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
  document.getElementById('icTypeCode').value = getCertTypeCode(d.instrument_type) || '';
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

// ====================================================
// SHOW PAGE
// ====================================================
