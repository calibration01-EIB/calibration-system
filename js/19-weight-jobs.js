/* ===== 19-weight-jobs.js ===== ทะเบียนงานสอบเทียบตุ้มน้ำหนัก (weight_cal_jobs) */

let wjRows = [];
let wjFilter = { q: '', status: '' };

function wjStatusBadge(status) {
  const m = {
    draft: ['🟡 ร่าง', '#9a6112', '#fdf3dd'],
    issued: ['🏷️ ออก Cert แล้ว', '#0f7a52', '#e2f5ec'],
  };
  const [lbl, fg, bg] = m[status] || [status || '–', '#555', '#f5f5f5'];
  return `<span style="font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:20px;background:${bg};color:${fg};white-space:nowrap">${lbl}</span>`;
}

function wjFmtDate(s) {
  return s ? new Date(s).toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric' }) : '–';
}

async function loadWeightjobs() {
  const tbody = document.getElementById('wjList');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="no-data">กำลังโหลด...</td></tr>';
  if (!sb) { try { sb = calCreateClient(); } catch (e) { sb = null; } }
  if (!sb) { if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="no-data">ยังเชื่อมต่อฐานข้อมูลไม่ได้</td></tr>'; return; }
  try {
    const { data, error } = await sb
      .from('weight_cal_jobs')
      .select('*, weight_cal_points(count)')
      .order('id', { ascending: false });
    if (error) throw error;
    wjRows = data || [];
    renderWeightjobsTable();
  } catch (e) {
    console.warn('โหลดทะเบียนงานสอบเทียบตุ้มน้ำหนักไม่สำเร็จ:', e.message);
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="no-data">โหลดข้อมูลไม่สำเร็จ: ' + escapeHtmlText(e.message) + '</td></tr>';
  }
}

function filterWeightjobs() {
  wjFilter = {
    q: (document.getElementById('wjSearch')?.value || '').trim().toLowerCase(),
    status: document.getElementById('wjStatusFilter')?.value || '',
  };
  renderWeightjobsTable();
}

function wjFilteredRows() {
  return wjRows.filter(r => {
    if (wjFilter.status && r.status !== wjFilter.status) return false;
    if (wjFilter.q) {
      const hay = [r.job_no, r.cert_no, r.client_name].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(wjFilter.q)) return false;
    }
    return true;
  });
}

function wjPointCount(row) {
  const c = row.weight_cal_points;
  if (Array.isArray(c)) return c[0]?.count ?? 0;
  return c?.count ?? 0;
}

function renderWeightjobsTable() {
  const tbody = document.getElementById('wjList');
  if (!tbody) return;
  const rows = wjFilteredRows();
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7" class="no-data">ไม่พบงานสอบเทียบตุ้มน้ำหนัก</td></tr>'; return; }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td style="padding:8px"><strong>${escapeHtmlText(r.job_no || '–')}</strong></td>
      <td style="padding:8px;font-family:var(--mono)">${escapeHtmlText(r.cert_no || '–')}</td>
      <td style="padding:8px">${escapeHtmlText(r.client_name || '–')}</td>
      <td style="padding:8px">${wjFmtDate(r.date_cal)}</td>
      <td style="padding:8px;text-align:center">${wjPointCount(r)}</td>
      <td style="padding:8px">${wjStatusBadge(r.status)}</td>
      <td style="padding:8px;white-space:nowrap">
        <button onclick="openWeightJob('${r.id}')" style="padding:4px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface);font-family:var(--font);font-size:11.5px;cursor:pointer">เปิด</button>
        <button onclick="reprintWeightCert('${r.id}')" style="padding:4px 10px;border:none;border-radius:7px;background:#00695C;color:#fff;font-family:var(--font);font-size:11.5px;cursor:pointer;margin-left:4px">พิมพ์ซ้ำ</button>
      </td>
    </tr>`).join('');
}

async function newWeightJob() {
  if (!sb) { try { sb = calCreateClient(); } catch (e) { sb = null; } }
  if (!sb) { if (typeof showToast === 'function') showToast('ยังเชื่อมต่อฐานข้อมูลไม่ได้', 'error'); return; }
  const jobNo = window.prompt('เลขที่งาน (Job No.)', '');
  if (!jobNo) return;
  try {
    if (typeof showLoading === 'function') showLoading('กำลังสร้างงานใหม่...');
    const { data, error } = await sb
      .from('weight_cal_jobs')
      .insert({ job_no: jobNo.trim(), revision: 0, cert_no: jobNo.trim() + '-0', status: 'draft' })
      .select('id')
      .single();
    if (error) throw error;
    openWeightJob(data.id);
  } catch (e) {
    if (typeof showToast === 'function') showToast('สร้างงานใหม่ไม่สำเร็จ: ' + e.message, 'error');
  } finally {
    if (typeof hideLoading === 'function') hideLoading();
  }
}

function openWeightJob(id) {
  window.open('weight-cal.html#job=' + encodeURIComponent(id), '_blank');
}

function reprintWeightCert(id) {
  window.open('weight-cal.html#job=' + encodeURIComponent(id) + '&print=1', '_blank');
}
