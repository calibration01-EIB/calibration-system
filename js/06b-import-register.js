/* ===== 06b-import-register.js ===== นำเข้าบัญชีรายการเครื่องมือจาก Excel (แยกจาก 06-plan.js) */
// ขอบเขต: อ่านไฟล์ .xlsx -> map คอลัมน์ -> ตรวจ/เทียบกับของเดิมใน DB -> ยืนยันบันทึกลง instruments
// ไม่เกี่ยวกับการวางแผนสอบเทียบ — แก้เรื่องนำเข้า/เทมเพลต/การ map คอลัมน์ ให้แก้ที่ไฟล์นี้
//
// ชื่อไฟล์เป็น "06b" ไม่ใช่เลขท้าย ๆ เพราะ "ต้องโหลดก่อน 11-import-template-selection.js"
// ซึ่ง monkey-patch openImportModal ตอนโหลด (ถ้าไฟล์นี้โหลดทีหลัง ตัว patch จะโดนทับเงียบ ๆ
// ปุ่มดาวน์โหลดเทมเพลตในหน้านำเข้าจะหายไปโดยไม่มี error)
// ====================================================
// IMPORT EXCEL
// ====================================================
let importRows = [];
let importAnalysis = {
  existingMap: {},
  actionIds: [],
  unchangedIds: [],
  duplicateIds: [],
  invalidRows: [],
  newCount: 0,
  updateCount: 0,
  unchangedCount: 0,
};

const IMPORT_DB_SELECT = [
  'id','instrument_type','machine_name','location','instrument_name','brand','model','range_val','tolerance',
  'serial_no','asset_no','department','id_code','cert_no','cal_date','due_date','cal_frequency','cal_type','remark',
  'prev_cert_no','prev_cal_date',
  'resolution_text','usage_min','usage_max','usage_frequency','product_group','usp_type','division',
  'capacity','resolution','range_profile'
].join(',');

const IMPORT_COMPARE_FIELDS = [
  'instrument_type','machine_name','location','instrument_name','brand','model','range_val','tolerance',
  'serial_no','asset_no','department','cert_no','cal_date','due_date','cal_frequency','cal_type','remark',
  'prev_cert_no','prev_cal_date',
  'resolution_text','usage_min','usage_max','usage_frequency','product_group','usp_type','division'
];

const IMPORT_COL_MAP = {
  'ประเภทเครื่องมือ':'instrument_type','instrument_type':'instrument_type',
  'ชื่อเครื่องจักร':'machine_name','machine_name':'machine_name',
  'สถานที่ใช้งาน':'location','สถานที่':'location','location':'location',
  'ชื่อเครื่องมือ':'instrument_name','เครื่องมือ':'instrument_name','instrument_name':'instrument_name',
  'ยี่ห้อ/รุ่น':'brand','ยี่ห้อ':'brand','brand':'brand','manufacturer':'brand',
  'รุ่น':'model','รุ่น (model)':'model','รุ่น(model)':'model','model':'model',
  'range':'range_val','range_val':'range_val',
  'tolerance (±)':'tolerance','tolerance':'tolerance',
  's/n':'serial_no','serial_no':'serial_no','serial no.':'serial_no',
  'asset no.':'asset_no','asset no':'asset_no','asset':'asset_no','asset_no':'asset_no','assetno':'asset_no',
  'หน่วยงาน':'department','department':'department',
  'แผนก':'division','แผนก (section)':'division','section':'division','division':'division',
  'id code':'id_code','id_code':'id_code','idcode':'id_code',
  // Cert ใหม่ (มี 2026) → cert_no ปัจจุบัน
  'cert. 2026':'cert_no','cert.2026':'cert_no',
  // วันสอบใหม่ (มี 2026) → cal_date ปัจจุบัน
  'วันสอบเทียบ 2026':'cal_date','วันสอบเทียบ2026':'cal_date',
  // ถ้าไม่มี 2026 → cert. และวันสอบเทียบ = ปัจจุบัน
  'cert.':'cert_no','เลขที่ certificate':'cert_no',
  'วันสอบเทียบ':'cal_date','วันที่สอบเทียบ':'cal_date','cal_date':'cal_date',
  'วันครบกำหนด':'due_date','ครบกำหนด':'due_date','due_date':'due_date',
  'ความถี่สอบเทียบ':'cal_frequency','ความถี่':'cal_frequency','cal_frequency':'cal_frequency',
  'ภายใน/ภายนอก':'cal_type','cal_type':'cal_type',
  'remark':'remark','หมายเหตุ':'remark',
  // ฟิลด์จากบัญชีรายการ (master register)
  'ความละเอียด':'resolution_text','resolution':'resolution_text','resolution_text':'resolution_text',
  'ใช้งานต่ำสุด':'usage_min','minimum usage':'usage_min','usage_min':'usage_min',
  'ใช้งานสูงสุด':'usage_max','maximum usage':'usage_max','usage_max':'usage_max',
  'ความถี่ใช้งาน':'usage_frequency','usage frequency':'usage_frequency','usage_frequency':'usage_frequency',
  'กลุ่มสินค้า':'product_group','product group':'product_group','product_group':'product_group',
  'usp type':'usp_type','type :a,b,c':'usp_type','type a,b,c':'usp_type','usp_type':'usp_type',
};

// ===== บัญชีรายการ (ข้อความ) → ตัวเลขสำหรับ cal engine (เฉพาะเครื่องชั่ง) =====
// แปลงหน่วยเป็นกรัมเสมอ: "0.002 kg" → 2 · "0.01 g" → 0.01 · ">800kg" → 800000
function regToGrams(str) {
  const s = String(str || '').trim();
  if (!s) return null;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  let n = parseFloat(m[0]);
  if (!Number.isFinite(n)) return null;
  if (/kg|kilogram/i.test(s)) n *= 1000;
  else if (/\bmg\b/i.test(s)) n /= 1000;
  return n;
}
// แตก band ที่ต่อด้วย " / " (multi-interval) → ["0.002 kg","0.005 kg",...]
function regSplitBands(str) {
  return String(str || '').split('/').map(x => x.trim()).filter(Boolean);
}
// ขอบบนของย่าน: "0-3100 g" → 3100 · "0 - 1500 kg" → 1500000 (เครื่องหมาย - = คั่น ไม่ใช่ลบ)
function regRangeUpperG(rangeStr) {
  const s = String(rangeStr || '').trim();
  if (!s) return null;
  const isKg = /kg|kilogram/i.test(s);
  const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  let up = Math.max(...nums);
  if (isKg) up *= 1000;
  return up;
}
// แปลงข้อมูลบัญชีของแถวเครื่องชั่ง → { capacity, resolution, range_profile } (กรัม) · ไม่ใช่เครื่องชั่ง → null
function parseBalanceRegister(row, extraTypeText) {
  // ตรวจว่าเป็นเครื่องชั่งจากชื่อในแถว หรือจากทะเบียนเดิม (เผื่อไฟล์ import ไม่มีคอลัมน์ประเภท)
  const hay = [row.instrument_type, row.instrument_name, extraTypeText].filter(Boolean).join(' ');
  if (!/balance/i.test(hay)) return null;
  const resBands = regSplitBands(row.resolution_text).map(regToGrams).filter(n => n != null && n > 0);
  const maxBands = regSplitBands(row.usage_max).map(regToGrams).filter(n => n != null && n > 0);
  const tolBands = regSplitBands(row.tolerance).map(regToGrams).filter(n => n != null && n > 0);
  const rangeUpper = regRangeUpperG(row.range_val);

  const capCands = [rangeUpper, maxBands.length ? Math.max(...maxBands) : null].filter(n => n != null && n > 0);
  const capacity = capCands.length ? Math.max(...capCands) : null;
  const resolution = resBands.length ? Math.min(...resBands) : null;
  if (capacity == null && resolution == null) return null;

  const out = {};
  if (capacity != null) out.capacity = capacity;
  if (resolution != null) out.resolution = resolution;

  const segCount = Math.max(resBands.length, maxBands.length, tolBands.length);
  const isMulti = segCount > 1;
  const lastUnitKg = /kg|kilogram/i.test(row.tolerance || '');

  if (isMulti) {
    const prof = [];
    for (let i = 0; i < segCount; i++) {
      let to = (maxBands[i] != null) ? maxBands[i] : null;
      if (i === segCount - 1 && capacity != null) to = capacity; // ย่านสุดท้ายให้ถึง Max
      if (to == null || !(to > 0)) continue;
      const d = (resBands[i] != null) ? resBands[i] : (resBands.length ? resBands[resBands.length - 1] : null);
      const tol = (tolBands[i] != null) ? tolBands[i] : (tolBands.length ? tolBands[tolBands.length - 1] : null);
      prof.push({ to, d: d != null ? d : null, tol: tol != null ? tol : null, unit: 'g' });
    }
    prof.sort((a, b) => a.to - b.to);
    if (prof.length) out.range_profile = prof;
  } else if (lastUnitKg && capacity != null && resolution != null && tolBands.length) {
    // ย่านเดียวแต่ tolerance เป็น kg → ทำ range_profile 1 segment เพื่อให้หน่วยถูก (เลี่ยง text regex อ่านเป็นกรัม)
    out.range_profile = [{ to: capacity, d: resolution, tol: tolBands[0], unit: 'g' }];
  }
  return out;
}

function downloadTemplate() {
  if (typeof XLSX === 'undefined') { showToast('โหลด SheetJS ไม่สำเร็จ', 'error'); return; }
  const headers = ['ประเภทเครื่องมือ','ชื่อเครื่องจักร','สถานที่ใช้งาน','ชื่อเครื่องมือ',
    'ยี่ห้อ','รุ่น','Range','Tolerance (±)','S/N','Asset No.','หน่วยงาน','ID Code','CERT.',
    'วันสอบเทียบ','วันครบกำหนด','ความถี่สอบเทียบ','ภายใน/ภายนอก','Remark',
    'ความละเอียด','ใช้งานต่ำสุด','ใช้งานสูงสุด','ความถี่ใช้งาน','กลุ่มสินค้า','USP Type'];
  const example = ['เครื่องชั่ง (Balance)','MIX 1000L','ตึก 5/1','Electronic Balance',
    'AND','GF-3000','30 kg','0.01 g','A1234567','701267','PMP1','PMP1BB01-WI01','25B001-0',
    '2025-01-15','2026-01-15','1 ครั้ง/ปี','ภายนอก','',
    '0.01 g','1 g','3000 g','Every day','Drug product','B'];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map(() => ({ wch: 22 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, 'import_template.xlsx');
}

function openImportModal() { resetImport(); document.getElementById('importModal').classList.add('open'); }
function closeImportModal() { document.getElementById('importModal').classList.remove('open'); resetImport(); }

function resetImport() {
  importRows = [];
  importAnalysis = {
    existingMap: {},
    actionIds: [],
    unchangedIds: [],
    duplicateIds: [],
    invalidRows: [],
    newCount: 0,
    updateCount: 0,
    unchangedCount: 0,
  };
  document.getElementById('importStep1').style.display = 'block';
  document.getElementById('importStep2').style.display = 'none';
  document.getElementById('importProgress').style.display = 'none';
  const fi = document.getElementById('importFileInput');
  if (fi) fi.value = '';
}

function normalizeImportBlank(value) {
  const s = String(value ?? '').trim();
  return (s === '' || s === '–' || s === '-') ? null : s;
}

function normalizeImportInstrumentType(row) {
  const raw = String(row.instrument_type || '').trim();
  if (!raw) return raw;
  const key = raw.toLowerCase().replace(/\s+/g, ' ');
  if (key === 'เครื่องชั่ง' || key === 'balance' || key === 'เครื่องชั่ง (balance)' || key === 'electronic balance' || key === 'analytical balance' || key === 'precision balance' || key === 'electronic scale' || key === 'weighing scale' || key === 'weighing machine') return 'เครื่องชั่ง (Balance)';
  if (key === 'ตุ้มน้ำหนักมาตรฐาน' || key === 'mass' || key === 'weight' || key === 'ตุ้มน้ำหนักมาตรฐาน (mass)') return 'ตุ้มน้ำหนักมาตรฐาน (Mass)';
  if (key === 'มวล/น้ำหนัก' || key === 'มวล/น้ำหนัก (mass/weight)' || key === 'mass/weight') {
    const code = typeof getCertTypeCode === 'function' ? getCertTypeCode(raw, row.instrument_name || '') : '';
    return code === 'M' ? 'ตุ้มน้ำหนักมาตรฐาน (Mass)' : 'เครื่องชั่ง (Balance)';
  }
  return raw;
}

function importComparableValue(value, field) {
  const normalized = normalizeImportBlank(value);
  if (normalized === null) return '';
  if (['cal_date','due_date','prev_cal_date'].includes(field)) return String(normalized).slice(0, 10);
  return String(normalized).trim();
}

function parseImportDateCell(value, rowNo, header) {
  if (value === '' || value === null || value === undefined) return { value: '' };
  if (value instanceof Date) {
    const y = value.getFullYear(), m = String(value.getMonth()+1).padStart(2,'0'), d = String(value.getDate()).padStart(2,'0');
    return { value: y+'-'+m+'-'+d };
  }
  if (typeof value === 'number' && value > 40000 && value < 60000) {
    const dt = new Date(Math.round((value - 25569) * 86400 * 1000));
    const y = dt.getUTCFullYear(), mo = String(dt.getUTCMonth()+1).padStart(2,'0'), dd = String(dt.getUTCDate()).padStart(2,'0');
    return { value: y+'-'+mo+'-'+dd };
  }

  const raw = String(value || '').trim();
  if (!raw || raw === '–' || raw === '-') return { value: '' };

  let y, m, d;
  let match = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    y = Number(match[1]); m = Number(match[2]); d = Number(match[3]);
  } else {
    match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
    if (match) {
      d = Number(match[1]); m = Number(match[2]); y = Number(match[3]);
      if (y < 100) y += 2000;
    }
  }

  if (!match) return { value: raw, error: `แถว ${rowNo}: ${header} ต้องเป็นวันที่ แต่พบ "${raw}"` };
  if (y > 2400) y -= 543;

  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return { value: raw, error: `แถว ${rowNo}: ${header} วันที่ไม่ถูกต้อง "${raw}"` };
  }

  return { value: `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` };
}

function prepareImportRowForDb(row) {
  const clean = {};
  Object.entries(row).forEach(([k, v]) => {
    if (k.startsWith('__')) return;
    clean[k] = normalizeImportBlank(v);
  });
  if (!clean.due_date && clean.cal_date && clean.cal_frequency) {
    clean.due_date = calcDueDateStr(clean.cal_date, clean.cal_frequency);
  }
  if (clean.instrument_type) {
    clean.instrument_type = normalizeImportInstrumentType(clean);
    clean.category = clean.instrument_type;
  }
  return clean;
}

function getImportDiff(existing, cleanRow) {
  if (!existing) return [];
  return IMPORT_COMPARE_FIELDS.filter(field => {
    if (!Object.prototype.hasOwnProperty.call(cleanRow, field)) return false;
    return importComparableValue(existing[field], field) !== importComparableValue(cleanRow[field], field);
  });
}

async function fetchExistingImportRows(idCodes) {
  const uniqueCodes = [...new Set(idCodes.map(v => String(v || '').trim()).filter(Boolean))];
  const existingMap = {};
  for (let i = 0; i < uniqueCodes.length; i += 100) {
    const chunk = uniqueCodes.slice(i, i + 100);
    const { data, error } = await sb.from('instruments').select(IMPORT_DB_SELECT).in('id_code', chunk);
    if (error) throw error;
    (data || []).forEach(row => { existingMap[row.id_code] = row; });
  }
  return existingMap;
}

function analyzeImportRows(validRows, existingMap) {
  const countsById = {};
  validRows.forEach(row => { countsById[row.id_code] = (countsById[row.id_code] || 0) + 1; });
  const duplicateIds = Object.keys(countsById).filter(id => countsById[id] > 1);
  let newCount = 0, updateCount = 0, unchangedCount = 0;
  const actionIds = [], unchangedIds = [];

  validRows.forEach(row => {
    const existing = existingMap[row.id_code];
    const clean = prepareImportRowForDb(row);
    if (!existing) {
      newCount += 1;
      actionIds.push(row.id_code);
      return;
    }
    const diff = getImportDiff(existing, clean);
    if (diff.length) {
      updateCount += 1;
      actionIds.push(row.id_code);
    } else {
      unchangedCount += 1;
      unchangedIds.push(row.id_code);
    }
  });

  return { existingMap, actionIds, unchangedIds, duplicateIds, newCount, updateCount, unchangedCount };
}

function importStatusBadge(row) {
  if (!row.id_code) return '<span style="color:var(--red);font-weight:700">ไม่มี ID Code</span>';
  if (importAnalysis.duplicateIds.includes(row.id_code)) return '<span style="color:var(--red);font-weight:700">ID ซ้ำในไฟล์</span>';
  if (importAnalysis.unchangedIds.includes(row.id_code)) return '<span style="color:var(--text3);font-weight:700">ซ้ำเดิม</span>';
  if (importAnalysis.existingMap[row.id_code]) return '<span style="color:var(--amber);font-weight:700">อัปเดต</span>';
  return '<span style="color:var(--green);font-weight:700">ใหม่</span>';
}

function handleImportFile(file) {
  if (!file) return;
  if (typeof XLSX === 'undefined') { showToast('โหลด SheetJS ไม่สำเร็จ', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (raw.length < 2) { showToast('ไม่พบข้อมูลในไฟล์', 'error'); return; }

      const excelHeaders = raw[0].map(h => String(h).trim());
      const fieldMap = {};
      // ตรวจว่ามี Cert. 2026 ไหม — ถ้ามีให้ cert. เก่าเป็น prev
      const hasNew2026 = excelHeaders.some(h => h.toLowerCase().includes('2026'));
      excelHeaders.forEach((h, i) => {
        const key = h.toLowerCase();
        if (IMPORT_COL_MAP[key]) {
          // ถ้าไม่มี 2026 และ key เป็น cert. → map เป็น cert_no (ปัจจุบัน)
          // ถ้ามี 2026 และ key เป็น cert. → map เป็น prev_cert_no
          if (!hasNew2026 && key === 'cert.') fieldMap[i] = 'cert_no';
          else if (!hasNew2026 && key === 'วันสอบเทียบ') fieldMap[i] = 'cal_date';
          else if (hasNew2026 && key === 'cert.') fieldMap[i] = 'prev_cert_no';
          else if (hasNew2026 && key === 'วันสอบเทียบ') fieldMap[i] = 'prev_cal_date';
          else fieldMap[i] = IMPORT_COL_MAP[key];
        }
      });

      const errors = [];
      importRows = raw.slice(1).filter(r => r.some(c => c !== '')).map((r, rowIdx) => {
        const obj = {};
        Object.entries(fieldMap).forEach(([ci, field]) => {
          let val = r[ci];
          if (['cal_date','due_date','prev_cal_date'].includes(field)) {
            const parsed = parseImportDateCell(val, rowIdx + 2, excelHeaders[ci] || field);
            val = parsed.value;
            if (parsed.error) errors.push(parsed.error);
          } else if (val instanceof Date) {
            const y = val.getFullYear(), m = String(val.getMonth()+1).padStart(2,'0'), d = String(val.getDate()).padStart(2,'0');
            val = y+'-'+m+'-'+d;
          } else if (typeof val === 'number' && val > 40000 && val < 60000) {
            // Excel serial number → YYYY-MM-DD (epoch: 1899-12-30)
            const dt = new Date(Math.round((val - 25569) * 86400 * 1000));
            const y = dt.getUTCFullYear(), mo = String(dt.getUTCMonth()+1).padStart(2,'0'), dd = String(dt.getUTCDate()).padStart(2,'0');
            val = y+'-'+mo+'-'+dd;
          } else { val = String(val || '').trim(); }
          if (val) obj[field] = val;
        });
        if (obj.instrument_type) {
          obj.instrument_type = normalizeImportInstrumentType(obj);
          obj.category = obj.instrument_type;
        }
        if (!obj.id_code) errors.push('แถว '+(rowIdx+2)+': ไม่มี ID Code');
        return obj;
      }).filter(o => Object.keys(o).length > 0);

      const validRows = importRows.filter(r => r.id_code);
      let analysisError = '';
      try {
        const existingMap = await fetchExistingImportRows(validRows.map(r => r.id_code));
        importAnalysis = {
          ...analyzeImportRows(validRows, existingMap),
          invalidRows: errors,
        };
      } catch (checkError) {
        analysisError = 'ตรวจข้อมูลซ้ำไม่สำเร็จ: ' + checkError.message;
        importAnalysis = {
          existingMap: {},
          actionIds: validRows.map(r => r.id_code),
          unchangedIds: [],
          duplicateIds: [],
          invalidRows: errors,
          newCount: validRows.length,
          updateCount: 0,
          unchangedCount: 0,
        };
      }

      if (importAnalysis.duplicateIds.length) {
        errors.push('พบ ID Code ซ้ำในไฟล์: ' + importAnalysis.duplicateIds.slice(0,8).join(', ') + (importAnalysis.duplicateIds.length > 8 ? ' ...' : ''));
      }
      if (analysisError) errors.push(analysisError);

      const previewColumns = excelHeaders
        .map((h, i) => fieldMap[i] ? { header: h, field: fieldMap[i] } : null)
        .filter(Boolean);
      document.getElementById('importPreviewHead').innerHTML =
        '<tr>'+previewColumns.map(c => '<th style="padding:8px 12px;white-space:nowrap;text-align:left;font-size:12px">'+escapeHtmlText(c.header)+'</th>').join('')+
        '<th style="padding:8px 12px;white-space:nowrap;text-align:left;font-size:12px">ผลตรวจ</th></tr>';
      document.getElementById('importPreviewBody').innerHTML =
        importRows.slice(0,5).map(r =>
          '<tr>'+previewColumns.map(c => '<td style="padding:7px 12px;border-bottom:1px solid var(--border);white-space:nowrap;font-size:12px">'+escapeHtmlText(r[c.field]||'–')+'</td>').join('')+
          '<td style="padding:7px 12px;border-bottom:1px solid var(--border);white-space:nowrap;font-size:12px">'+importStatusBadge(r)+'</td></tr>'
        ).join('');

      document.getElementById('importSummary').innerHTML =
        '📋 พบ <strong>'+importRows.length+'</strong> แถว &nbsp;|&nbsp; ✅ Valid: <strong>'+validRows.length+'</strong>' +
        ' &nbsp;|&nbsp; 🆕 ใหม่: <strong>'+importAnalysis.newCount+'</strong>' +
        ' &nbsp;|&nbsp; ✏️ อัปเดต: <strong>'+importAnalysis.updateCount+'</strong>' +
        ' &nbsp;|&nbsp; 🔁 ซ้ำเดิม: <strong>'+importAnalysis.unchangedCount+'</strong>' +
        ' &nbsp;|&nbsp; ❌ ข้าม: <strong>'+(importRows.length-validRows.length)+'</strong> (ไม่มี ID Code)';
      const errEl = document.getElementById('importErrors');
      if (errors.length) {
        errEl.style.display = 'block';
        errEl.innerHTML = '⚠️ '+errors.slice(0,5).map(escapeHtmlText).join('<br>')+(errors.length>5?'<br>...และอีก '+(errors.length-5)+' แถว':'');
      } else if (importAnalysis.unchangedCount && !importAnalysis.actionIds.length) {
        errEl.style.display = 'block';
        errEl.innerHTML = 'ℹ️ ข้อมูลทั้งหมดมีอยู่แล้วและไม่มีการเปลี่ยนแปลง จึงไม่มีรายการให้ Import';
      } else { errEl.style.display = 'none'; }
      document.getElementById('confirmImportBtn').disabled =
        validRows.length === 0 || errors.length > 0 || importAnalysis.actionIds.length === 0;
      document.getElementById('importStep1').style.display = 'none';
      document.getElementById('importStep2').style.display = 'block';
    } catch(e) { showToast('อ่านไฟล์ไม่สำเร็จ: '+e.message, 'error'); }
  };
  reader.readAsArrayBuffer(file);
}

async function confirmImport() {
  const validRows = importRows.filter(r => r.id_code);
  if (!validRows.length) return;
  document.getElementById('importStep2').style.display = 'none';
  document.getElementById('importProgress').style.display = 'block';
  document.getElementById('confirmImportBtn').disabled = true;
  document.getElementById('importProgressBar').style.width = '0%';
  document.getElementById('importProgressText').textContent = 'กำลังตรวจข้อมูล...';
  const CHUNK = 50;
  let done = 0, success = 0, failed = 0, failedCodes = [];
  try {
    const countsById = {};
    validRows.forEach(row => { countsById[row.id_code] = (countsById[row.id_code] || 0) + 1; });
    const duplicateIds = Object.keys(countsById).filter(id => countsById[id] > 1);
    if (duplicateIds.length) {
      document.getElementById('importStep2').style.display = 'block';
      document.getElementById('importProgress').style.display = 'none';
      document.getElementById('confirmImportBtn').disabled = false;
      showToast('พบ ID Code ซ้ำในไฟล์: ' + duplicateIds.slice(0,5).join(', '), 'error');
      return;
    }

    // ดึงข้อมูลเดิมของทุก id_code ที่จะ import มาเปรียบเทียบ
    const existingMap = await fetchExistingImportRows(validRows.map(r => r.id_code));
    const analysis = analyzeImportRows(validRows, existingMap);
    importAnalysis = { ...analysis, invalidRows: importAnalysis.invalidRows || [] };
    const cleanRows = validRows
      .map(row => prepareImportRowForDb(row))
      .filter(row => {
        const existing = existingMap[row.id_code];
        return !existing || getImportDiff(existing, row).length > 0;
      });
    const skipped = validRows.length - cleanRows.length;
    const created = cleanRows.filter(row => !existingMap[row.id_code]).length;
    const updated = cleanRows.length - created;

    if (!cleanRows.length) {
      document.getElementById('importStep2').style.display = 'block';
      document.getElementById('importProgress').style.display = 'none';
      document.getElementById('confirmImportBtn').disabled = true;
      showToast('ไม่มีข้อมูลใหม่หรือข้อมูลที่เปลี่ยนแปลงให้ Import', 'success');
      return;
    }

    for (let i = 0; i < cleanRows.length; i += CHUNK) {
      const cleanChunk = cleanRows.slice(i, i + CHUNK);

      // บันทึกประวัติ calibration_history เฉพาะรายการที่ cert_no หรือ cal_date เปลี่ยน
      const historyRows = [];
      cleanChunk.forEach(row => {
        const orig = existingMap[row.id_code];
        if (!orig) return; // รายการใหม่ ยังไม่มีประวัติ
        const certChanged = Object.prototype.hasOwnProperty.call(row, 'cert_no') &&
          orig.cert_no && importComparableValue(orig.cert_no, 'cert_no') !== importComparableValue(row.cert_no, 'cert_no');
        const dateChanged = Object.prototype.hasOwnProperty.call(row, 'cal_date') &&
          orig.cal_date && importComparableValue(orig.cal_date, 'cal_date') !== importComparableValue(row.cal_date, 'cal_date');
        if (certChanged || dateChanged) {
          historyRows.push({
            instrument_id: orig.id,
            cert_no: orig.cert_no || null,
            cal_date: orig.cal_date || null,
            due_date: orig.due_date || null,
          });
          // set prev fields
          row.prev_cert_no = orig.cert_no || null;
          row.prev_cal_date = orig.cal_date || null;
        }
      });
      if (historyRows.length) {
        const { error: histErr } = await sb.from('calibration_history').insert(historyRows);
        if (histErr) {
          console.error('[Import] calibration_history insert error:', histErr.message, histErr.details, histErr.hint);
          showToast('⚠️ บันทึกประวัติไม่สำเร็จ: ' + histErr.message, 'error');
        }
      }

      const { error } = await sb.from('instruments')
        .upsert(cleanChunk, { onConflict: 'id_code', ignoreDuplicates: false });
      if (error) {
        failed += cleanChunk.length;
        failedCodes.push(...cleanChunk.map(r => r.id_code));
        console.error('upsert error:', error.message, error.details, error.hint);
        document.getElementById('importProgressText').textContent = '❌ ' + error.message;
        document.getElementById('importStep2').style.display = 'block';
        document.getElementById('confirmImportBtn').disabled = false;
        showToast('❌ Import ผิดพลาด: ' + error.message, 'error');
        return;
      } else {
        success += cleanChunk.length;
      }
      done += cleanChunk.length;
      const pct = Math.round(done/cleanRows.length*100);
      document.getElementById('importProgressBar').style.width = pct+'%';
      document.getElementById('importProgressText').textContent =
        'กำลัง import... '+done+'/'+cleanRows.length+' รายการ' + (skipped ? ' (ข้ามซ้ำเดิม '+skipped+' รายการ)' : '');
      await new Promise(r => setTimeout(r, 30));
    }

    // เติมค่าตัวเลขสำหรับเครื่องชั่ง (capacity/resolution/range_profile) → ใช้สอบเทียบได้เลย
    // เติมเฉพาะช่องที่ว่าง — ไม่ทับค่าที่ปรับจากการสอบเทียบ · คีย์สม่ำเสมอกัน PostgREST NULL-clobber
    try {
      const balNumRows = [];
      validRows.forEach(row => {
        const ex = existingMap[row.id_code];
        const exType = ex ? ((ex.instrument_type || '') + ' ' + (ex.instrument_name || '')) : '';
        const parsed = parseBalanceRegister(row, exType);
        if (!parsed) return;
        const exHasCap  = ex && ex.capacity != null;
        const exHasRes  = ex && ex.resolution != null;
        const exHasProf = ex && Array.isArray(ex.range_profile) && ex.range_profile.length > 0;
        if (exHasCap && exHasRes && exHasProf) return; // มีครบแล้ว ไม่ต้องแตะ
        balNumRows.push({
          id_code: row.id_code,
          capacity:      exHasCap  ? ex.capacity     : (parsed.capacity ?? null),
          resolution:    exHasRes  ? ex.resolution   : (parsed.resolution ?? null),
          range_profile: exHasProf ? ex.range_profile : (parsed.range_profile ?? null),
        });
      });
      if (balNumRows.length) {
        const { error: numErr } = await sb.from('instruments')
          .upsert(balNumRows, { onConflict: 'id_code', ignoreDuplicates: false });
        if (numErr) console.warn('[Import] balance numeric fill error:', numErr.message);
      }
    } catch (numEx) { console.warn('[Import] balance numeric fill exception:', numEx && numEx.message); }

    await logAudit('แก้ไข', {
      id_code: 'IMPORT_BATCH',
      instrument_name: 'Import: เพิ่ม '+created+' / อัปเดต '+updated+' / ซ้ำเดิม '+skipped+' รายการ'
    }, null);
    const msg = '✅ Import สำเร็จ '+success+' รายการ' +
      ' (เพิ่ม '+created+', อัปเดต '+updated+(skipped ? ', ข้ามซ้ำเดิม '+skipped : '')+')' +
      (failed ? ' | ❌ ล้มเหลว '+failed+' รายการ' : '');
    showToast(msg, 'success');
    if (failed) console.warn('Failed id_codes:', failedCodes);
    closeImportModal();
    await loadData(true);
  } catch(e) {
    showToast('Import ไม่สำเร็จ: '+e.message, 'error');
    document.getElementById('importStep2').style.display = 'block';
    document.getElementById('importProgress').style.display = 'none';
    document.getElementById('confirmImportBtn').disabled = false;
  }
}

document.addEventListener('click', (e) => {
  const wrapper = document.getElementById('notifWrapper');
  if (wrapper && !wrapper.contains(e.target)) {
    const dd = document.getElementById('notifDropdown');
    if (dd) dd.style.display = 'none';
  }
  const scanWrapper = document.getElementById('scanNotifWrapper');
  if (scanWrapper && !scanWrapper.contains(e.target)) {
    const dd = document.getElementById('scanNotifDropdown');
    if (dd) dd.style.display = 'none';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const ia = document.getElementById('importUploadArea');
  if (!ia) return;
  ia.addEventListener('dragover', e => { e.preventDefault(); ia.classList.add('dragover'); });
  ia.addEventListener('dragleave', () => ia.classList.remove('dragover'));
  ia.addEventListener('drop', e => { e.preventDefault(); ia.classList.remove('dragover'); handleImportFile(e.dataTransfer.files[0]); });
});
