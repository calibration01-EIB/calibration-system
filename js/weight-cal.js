/* ===== weight-cal.js ===== */
// สอบเทียบตุ้มน้ำหนักมาตรฐาน (ABBA) + calc engine ตาม SWI-CAL-701 / OIML R111-1
// ฟังก์ชันคำนวณเป็น pure fn (prefix wc*) — ทดสอบด้วย tests/weight-cal.test.html
// =====================================================================

// สภาวะ: ค่าเฉลี่ยช่วง + ค่าแก้
function wcAvgCorr(lo, hi, corr) {
  return (Number(lo) + Number(hi)) / 2 + Number(corr || 0);
}

// ความหนาแน่นอากาศ (OIML R111-1 Annex E.3) — P: mbar, RH: %RH, T: °C → kg/m³
function wcAirDensity(T, RH, P) {
  T = Number(T); RH = Number(RH); P = Number(P);
  return (0.34848 * P - 0.009 * RH * Math.exp(0.061 * T)) / (273.15 + T);
}

// Conventional mass ของ reference (g)
function wcMcr(nominalG, refCorrMg) {
  return Number(nominalG) + Number(refCorrMg || 0) / 1000;
}

// ABBA 1 รอบ: Δ = (t1 - r1 - r2 + t2)/2  (หน่วยตามที่กรอก, g)
function wcDelta(r1, t1, t2, r2) {
  return (Number(t1) - Number(r1) - Number(r2) + Number(t2)) / 2;
}

// ตัวประกอบแก้แรงพยุงอากาศ Ci = (ρa - 1.2)(1/ρt - 1/ρr)
function wcCi(rhoA, rhoTest, rhoRef) {
  return (Number(rhoA) - 1.2) * (1 / Number(rhoTest) - 1 / Number(rhoRef));
}

// Conventional mass ของตุ้ม unknown
function wcConventionalMass(o) {
  const mcr = wcMcr(o.nominalG, o.refCorrMg);
  const ci = wcCi(o.rhoA, o.rhoTest, o.rhoRef);
  const n = o.abba.r1.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = wcDelta(o.abba.r1[i], o.abba.t1[i], o.abba.t2[i], o.abba.r2[i]);
    sum += d + ci * mcr;           // mci = Δi + Ci·mcr
  }
  const mcBar = sum / n;
  const mct = mcBar + mcr;
  const deltaAvg = mcBar - ci * mcr;   // เฉลี่ย Δ ล้วน (ไว้แสดง/เก็บ)
  return { deltaAvg, ci, mcBar, mct, errorMg: (mct - o.nominalG) * 1000 };
}

// Repeatability (Type A) → standard uncertainty (mg)
function wcRepeatabilityMg(repeatMg) { return Number(repeatMg) / Math.sqrt(3); }

// งบความไม่แน่นอน — คืน u, U(k=2), veff, k, และ ui รายองค์ประกอบ
function wcBudget(inp) {
  const ws = Number(inp.refUmg) / 2;
  const ds = Number(inp.dsMg) / Math.sqrt(3);
  const did = Number(inp.resolutionMg) / Math.sqrt(6);
  const dc = Number(inp.linearityMg) / Math.sqrt(3);
  const ab = (Number(inp.nominalMg) * Number(inp.ppm || 1) / 1e6) / Math.sqrt(3);
  const wr = wcRepeatabilityMg(inp.repeatMg);
  const componentsUi = { ws, ds, did, dc, ab, wr };
  const u = Math.sqrt(ws*ws + ds*ds + did*did + dc*dc + ab*ab + wr*wr);
  const veff = wr > 0 ? (Math.pow(u,4) / Math.pow(wr,4)) * 9 : Infinity;
  const k = 2;   // v1: k=2 (veff โตมากเสมอในงานนี้); เก็บ veff ไว้ตรวจ
  return { u, U: k*u, veff, k, componentsUi };
}

// ปัด 2 นัยสำคัญแบบปัดขึ้น (M3003) — ให้ผลตรงกับ roundUp2sf ใน cert-print.html (ล้วน ไม่มี floor)
function wcRoundUp2sf(x) {
  x = Number(x);
  if (!(x > 0)) return 0;
  const d = Math.ceil(Math.log10(x));
  const p = 2 - d;                 // ตำแหน่งทศนิยมสำหรับ 2 sig fig
  const f = Math.pow(10, p);
  return Math.ceil(x * f - 1e-9) / f;
}

// U ที่รายงาน = พื้น CMC ก่อน แล้วค่อยปัด 2 sig-fig (มาตรฐาน ISO 17025 / M3003)
// cmcMg มาจาก CMC set "Conventional Mass (Class F1)" (point) lookup ตาม nominal
function wcReportedU(computedU, cmcMg) {
  return wcRoundUp2sf(Math.max(Number(computedU), Number(cmcMg || 0)));
}

// OIML R111-1 MPE (± mg) ต่อ nominal (mg) แยกตาม class
const WC_MPE = {
  // nominalMg: { E2, F1, F2 }
  1:{E2:0.006,F1:0.020,F2:0.06}, 2:{E2:0.006,F1:0.020,F2:0.06}, 5:{E2:0.006,F1:0.020,F2:0.06},
  10:{E2:0.008,F1:0.025,F2:0.08}, 20:{E2:0.010,F1:0.03,F2:0.10}, 50:{E2:0.012,F1:0.04,F2:0.12},
  100:{E2:0.016,F1:0.05,F2:0.16}, 200:{E2:0.020,F1:0.06,F2:0.20}, 500:{E2:0.025,F1:0.08,F2:0.25},
  1000:{E2:0.03,F1:0.10,F2:0.3}, 2000:{E2:0.04,F1:0.12,F2:0.4}, 5000:{E2:0.05,F1:0.16,F2:0.5},
  10000:{E2:0.06,F1:0.20,F2:0.6}, 20000:{E2:0.08,F1:0.25,F2:0.8}, 50000:{E2:0.10,F1:0.30,F2:1.0},
  100000:{E2:0.16,F1:0.5,F2:1.6}, 200000:{E2:0.3,F1:1.0,F2:3.0}, 500000:{E2:0.8,F1:2.5,F2:8.0},
  1000000:{E2:1.6,F1:5,F2:16}, 2000000:{E2:3.0,F1:10,F2:30}, 5000000:{E2:8.0,F1:25,F2:80},
  10000000:{E2:16,F1:50,F2:160}, 20000000:{E2:30,F1:100,F2:300}
};
function wcMpeMg(classGrade, nominalMg) {
  const row = WC_MPE[Number(nominalMg)];
  if (!row) return null;
  const v = row[String(classGrade || '').trim().toUpperCase()];
  return (v == null) ? null : v;
}
function wcPass(errorMg, mpeMg) {
  if (mpeMg == null) return false;
  return Math.abs(Number(errorMg)) <= (2/3) * Number(mpeMg);
}

/* ===== Task 7 — orchestration ===== */
// รวมทุกสูตร → ผลของ 1 จุด (หน่วยกลาง: nominal เป็น g ในการคำนวณ, error/U เป็น mg)
const WC_UNIT_G = { mg: 0.001, g: 1, kg: 1000 };
function wcComputePoint(p, job, std, comp, inst, cmcMg) {
  const T = wcAvgCorr(job.temp_lo, job.temp_hi, job.temp_corr);
  const RH = wcAvgCorr(job.rh_lo, job.rh_hi, job.rh_corr);
  const P = wcAvgCorr(job.press_lo, job.press_hi, job.press_corr);
  const rhoA = wcAirDensity(T, RH, P);
  const nominalG = Number(p.nominal_value) * (WC_UNIT_G[p.unit] || 1);
  const nominalMg = nominalG * 1000;
  const cm = wcConventionalMass({
    abba: p.abba, nominalG, refCorrMg: Number(std.correction),
    rhoA, rhoTest: Number(inst.density || 7950), rhoRef: Number(std.density || 7950)
  });
  const b = wcBudget({
    refUmg: Number(std.uncertainty), dsMg: Number(std.ds != null ? std.ds : std.uncertainty),
    resolutionMg: Number(comp.resolution) * 1000, linearityMg: Number(comp.linearity),
    nominalMg, ppm: Number(p.ppm || 1), repeatMg: Number(comp.repeatability)
  });
  const Ur = wcReportedU(b.U, cmcMg);   // CMC floor แล้วปัด 2 sig-fig
  const mpe = wcMpeMg(inst.class_grade, nominalMg);
  return {
    delta_avg: cm.deltaAvg, ci: cm.ci, mc_bar: cm.mcBar, conventional_mass: cm.mct,
    correction_mg: cm.errorMg, uncertainty_mg: Ur, veff: b.veff, k: b.k,
    mpe_mg: mpe, pass: wcPass(cm.errorMg, mpe), _budget: b.componentsUi, _rhoA: rhoA,
    _u: b.u, _U: b.U   // ค่า u/U ก่อนปัด — ใช้แสดงในใบ uncertainty (FRM-CAL90) ผ่าน wcBuildCAL
  };
}

// ปัดเศษปกติ (round-half-up) dp ตำแหน่งทศนิยม — ใช้จัดรูปตัวเลขแสดงผลใน CAL (ไม่ใช่ 2sf ของ M3003)
function wcRoundHalf(x, dp) {
  const f = Math.pow(10, dp);
  return Math.round((Number(x) + Number.EPSILON) * f) / f;
}

// ค่าคงที่ห้องแล็บ — คัดลอกจาก LAB ใน js/balance-cal.js (ต้องตรงกันทุกตัวอักษรกับปกใบเครื่องชั่ง)
const WC_LAB = {
  name: 'INTERNATIONAL LABBORATORIES CROP., LTD .', dept: 'CALIBRATION LABORATORY',
  addr: ['62 MU 8, BANGNA-TRAT ROAD,', 'BANG CHALONG SUB-DISTRICT, BANG PHLI DISTRICT,', 'SAMUTPRAKAN PROVINCE, 10540, THAILAND'],
  phone: 'PHONE : (02)  3468222-4  FAX : (02) 3468233-4',
};

// รวมรายชื่อ mass comparator ที่ใช้ในงานนี้ (ไม่ซ้ำ) → รายการหน้า 2 ของ cert
function WC_uniqueComparators(points) {
  const seen = new Map();
  (points || []).forEach(pt => {
    const c = pt._comp || pt.comparator;
    if (!c) return;
    const key = c.serial || c.name || '';
    if (!seen.has(key)) {
      seen.set(key, { name: c.name || '-', serial: c.serial || '-', due: c.due || c.due_date || '-', cert: c.cert || c.cert_no || '-' });
    }
  });
  return [...seen.values()];
}

// รวมรายชื่อตุ้มมาตรฐานอ้างอิงที่ใช้ในงานนี้ (ไม่ซ้ำ) → รายการหน้า 2 ของ cert (procedure_refs)
function WC_refLines(points) {
  const seen = new Map();
  (points || []).forEach(pt => {
    const s = pt._std || pt.std;
    if (!s) return;
    const key = s.id_code || s.serial || (String(s.nominal_value) + (s.unit || ''));
    if (!seen.has(key)) {
      const nomTxt = (s.nominal_value != null ? s.nominal_value : '') + ' ' + (s.unit || '');
      seen.set(key, {
        label: 'STANDARD WEIGHT',
        model: ('CLASS ' + (s.class_grade || '') + ' ( ' + nomTxt.trim() + ' )').replace(/\s+/g, ' ').trim(),
        serial: s.serial || s.id_code || '-',
        due: s.due_date || s.due || null,
        cert: s.cert_no || s.cert || '-'
      });
    }
  });
  return [...seen.values()];
}

// ประกอบ object ให้ cert-print.html (doc_type='weight')
function wcBuildCAL(job, points) {
  const fmtErr = (mg) => (mg >= 0 ? '+ ' : '- ') + Math.abs(wcRoundHalf(mg, 4)); // helper below
  const P = points.map(pt => ({
    nominal_value: pt.nominal_value, unit: pt.unit, marking: pt.marking,
    conventional_mass_str: `${pt.nominal_value} ${pt.unit}   ${fmtErr(pt.correction_mg)}`,
    correction_str: fmtErr(pt.correction_mg),
    uncertainty_str: `${pt.uncertainty_mg} mg`,
    abba: pt.abba, ci: pt.ci,
    budget: Object.assign({ u: pt._u, U: pt._U, veff: pt.veff, k: pt.k }, pt._budget || {}),
    std: pt._std, comparator: pt._comp
  }));
  return {
    doc_type: 'weight', cert_no: job.cert_no,
    lab: WC_LAB,                          // ค่าคงที่ห้องแล็บ (คัดจาก cert-print balance CAL.lab)
    client: { name: job.client_name, addr: (job.client_addr || '').split('\n') },
    equipment: job.equipment, range_text: job.range_text,
    manufacturer: job.manufacturer, model: job.model, serial: job.serial, id_no: job.id_no,
    resolution_str: 'N/A',            // ตุ้มน้ำหนักไม่มี resolution → N/A (ตรงกับใบ cert จริง FRM-CAL54)
    tolerances: [],                   // EIB55 header Tolerance band — ตุ้มใช้ MPE รายจุด (คอลัมน์ tol ใน eib_rows)
    section: '',                      // ไม่มีในโมเดลงานตุ้ม v1
    unit_dept: '',
    user_range: job.range_text || '',
    temp: [job.temp_lo, job.temp_hi], rh: [job.rh_lo, job.rh_hi],
    date_receive: job.date_receive, date_cal: job.date_cal, date_issue: job.date_issue,
    signers: { tech_mgr: job.tech_mgr, approver_pos: 'TECHNICAL MANAGEMENT STAFF' },
    calibrated_by: job.calibrated_by,
    comparators: WC_uniqueComparators(points), procedure_refs: WC_refLines(points),
    points: P,
    // pre-computed rows for the shared pageEIB55 (Task 6a shape)
    eib_rows: points.map(pt => {
      const errG = pt.correction_mg / 1000, Ug = pt.uncertainty_mg / 1000;
      const tolG = (pt.mpe_mg != null ? pt.mpe_mg / 1000 : null);
      const result = (tolG == null) ? '-' : (pt.pass ? 'PASS' : 'FAIL');
      return { label: `${pt.nominal_value} ${pt.unit}`, errG, Ug,
               sumEU: errG + Ug, diffEU: errG - Ug, tol: tolG, result };
    })
  };
}

/* ===== Task 7 — page controller (state + Supabase I/O + DOM) ===== */
let sb = null;                 // Supabase client (calCreateClient())
let WC_JOB = null;              // job header (form-backed)
let WC_POINTS = [];             // array of point rows (raw input + resolved refs + computed)
let WC_INSTRUMENTS = [];        // weight-type instruments (picker)
let WC_STD_WEIGHTS = [];        // standard_weights (status='approved')
let WC_COMPARATORS = [];        // mass_comparators
let wcCmcRows = [];             // cmc_row rows for parameter='Conventional Mass (Class F1)'

// ---- small DOM helpers (ไม่พึ่งไฟล์อื่น เพราะหน้านี้โหลดแบบสแตนด์อโลน) ----
function wcVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function wcNum(id) { const v = wcVal(id); return v === '' ? null : Number(v); }
function wcSet(id, v) { const el = document.getElementById(id); if (el) el.value = (v == null ? '' : v); }
function wcEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ตรวจว่าเครื่องมือเป็นประเภทตุ้มน้ำหนัก/มวลมาตรฐาน (ล้อกับ isMassInstrumentType ใน js/02-dashboard.js
// แต่หน้านี้โหลดแบบสแตนด์อโลน ไม่มี dashboard.js ให้เรียก จึงทำ regex เดียวกันไว้ในตัว)
function wcIsMassType(type, name) {
  const s = String(type || '') + ' ' + String(name || '');
  return /\bmass\b|\bweights?\b|standard\s*weight|reference\s*weight|ตุ้มน้ำหนัก|มวลมาตรฐาน|ลูกตุ้ม/i.test(s);
}

function wcBlankJob() {
  return {
    id: null, job_no: '', revision: 0, cert_no: '',
    client_name: '', client_addr: '', equipment: 'WEIGHT', range_text: '',
    manufacturer: '', model: '', serial: '', id_no: '',
    date_receive: null, date_cal: null, date_issue: null, due_date: null,
    temp_lo: 20, temp_hi: 20, temp_corr: 0, rh_lo: 50, rh_hi: 50, rh_corr: 0,
    press_lo: 1013, press_hi: 1013, press_corr: 0, air_density: null,
    calibrated_by: '', tech_mgr: '', director: '', status: 'draft'
  };
}
function wcNewPointRow() {
  return {
    _rowId: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    instrument_id: null, nominal_value: null, unit: 'mg', marking: 'NONE', ppm: 1,
    comparator_id: null, std_weight_id: null,
    abba: { r1: [0, 0, 0], t1: [0, 0, 0], t2: [0, 0, 0], r2: [0, 0, 0] }
  };
}

// ---- CMC floor (จุดแม่นยำ Conventional Mass Class F1) ----
function wcCmcForNominal(nominalG) {
  const rows = wcCmcRows || [];
  const r = rows.find(r => Math.abs(Number(nominalG) - Number(r.from_g)) <= 1e-9 * Math.max(1, Number(r.from_g)));
  return r ? Number(r.cmc_mg) : 0;
}

// ---- lookups ----
async function wcLoadLookups() {
  try {
    const { data, error } = await sb.from('instruments')
      .select('id,instrument_type,instrument_name,brand,model,serial_no,id_code,accuracy_class,capacity,resolution_text,cal_status')
      .limit(3000);
    if (error) throw error;
    WC_INSTRUMENTS = (data || []).filter(r => wcIsMassType(r.instrument_type, r.instrument_name) && r.cal_status !== 'cancelled');
  } catch (e) { WC_INSTRUMENTS = []; showToast('โหลดรายการเครื่องมือไม่ได้: ' + e.message, 'error'); }

  try {
    const { data, error } = await sb.from('standard_weights').select('*').eq('status', 'approved').order('nominal_value');
    if (error) throw error;
    WC_STD_WEIGHTS = data || [];
  } catch (e) { WC_STD_WEIGHTS = []; showToast('โหลดตุ้มมาตรฐานไม่ได้: ' + e.message, 'error'); }

  try {
    const { data, error } = await sb.from('mass_comparators').select('*').order('range_lo');
    if (error) throw error;
    WC_COMPARATORS = data || [];
  } catch (e) { WC_COMPARATORS = []; showToast('โหลด mass comparator ไม่ได้: ' + e.message, 'error'); }

  try {
    const { data, error } = await sb.from('cmc_row')
      .select('from_g,to_g,cmc_mg,cmc_set!inner(parameter,value_kind)')
      .eq('cmc_set.parameter', 'Conventional Mass (Class F1)');
    if (error) throw error;
    wcCmcRows = data || [];
    if (!wcCmcRows.length) showToast('ไม่พบตาราง CMC "Conventional Mass (Class F1)" — จะไม่ใช้ CMC floor', 'warning');
  } catch (e) { wcCmcRows = []; showToast('โหลด CMC ไม่ได้ (จะไม่ใช้ CMC floor): ' + e.message, 'warning'); }
}

function wcDefaultComparatorFor(nominalG) {
  const c = (WC_COMPARATORS || []).find(c => Number(c.range_lo) <= nominalG && nominalG <= Number(c.range_hi));
  return c || WC_COMPARATORS[0] || null;
}
function wcDefaultStdFor(nominalValue, unit) {
  return (WC_STD_WEIGHTS || []).find(w => Number(w.nominal_value) === Number(nominalValue) && (w.unit || 'g') === (unit || 'g')) || null;
}
function wcResolveInst(id) { return (WC_INSTRUMENTS || []).find(i => i.id === id) || null; }
function wcResolveStd(id, nominalValue, unit) {
  if (id) { const w = (WC_STD_WEIGHTS || []).find(w => w.id === id); if (w) return w; }
  return wcDefaultStdFor(nominalValue, unit);
}
function wcResolveComp(id, nominalG) {
  if (id) { const c = (WC_COMPARATORS || []).find(c => c.id === id); if (c) return c; }
  return wcDefaultComparatorFor(nominalG);
}

// Dₛ ของตุ้มมาตรฐาน (เหมือน swDrift ใน js/08-weights.js): correction เก็บหน่วย g, uncertainty เก็บหน่วย mg
function wcSwDrift(w) {
  const U = Number(w.uncertainty) || 0;
  if (w.correction == null || w.prev_correction == null) return { has: false, drift: 0, Ds: U };
  const d = Math.abs(Number(w.correction) - Number(w.prev_correction)) * 1000;
  return { has: true, drift: d, Ds: Math.max(U, d) };
}
// std_weights row → arg ของ wcComputePoint (correction/uncertainty เป็น mg) + เมทาสำหรับพิมพ์ cert
function wcStdToStdArg(w) {
  if (!w) return null;
  const dr = wcSwDrift(w);
  return {
    correction: w.correction != null ? Number(w.correction) * 1000 : 0,   // g → mg
    uncertainty: Number(w.uncertainty) || 0,
    density: 7950, ds: dr.Ds,
    id_code: w.id_code, serial: w.serial_no, cert_no: w.cert_no, due_date: w.due_date,
    class_grade: w.class_grade, nominal_value: w.nominal_value, unit: w.unit
  };
}
function wcCompToCompArg(c) {
  if (!c) return null;
  return { name: c.name, serial: c.serial, repeatability: c.repeatability, linearity: c.linearity, resolution: c.resolution, due: '-', cert: '-' };
}
function wcInstToInstArg(inst, p) {
  return { class_grade: (inst && (inst.accuracy_class || inst.class_grade)) || p.class_grade || 'F1', density: 7950 };
}

// ---- job form <-> WC_JOB ----
function wcReadJobForm() {
  if (!WC_JOB) WC_JOB = wcBlankJob();
  Object.assign(WC_JOB, {
    job_no: wcVal('wcJobNo'), revision: wcNum('wcRevision') || 0,
    client_name: wcVal('wcClientName'), client_addr: wcVal('wcClientAddr'),
    equipment: wcVal('wcEquipment') || 'WEIGHT', range_text: wcVal('wcRangeText'),
    manufacturer: wcVal('wcManufacturer'), model: wcVal('wcModel'), serial: wcVal('wcSerial'), id_no: wcVal('wcIdNo'),
    date_receive: wcVal('wcDateReceive') || null, date_cal: wcVal('wcDateCal') || null,
    date_issue: wcVal('wcDateIssue') || null, due_date: wcVal('wcDueDate') || null,
    temp_lo: wcNum('wcTempLo'), temp_hi: wcNum('wcTempHi'), temp_corr: wcNum('wcTempCorr') || 0,
    rh_lo: wcNum('wcRhLo'), rh_hi: wcNum('wcRhHi'), rh_corr: wcNum('wcRhCorr') || 0,
    press_lo: wcNum('wcPressLo'), press_hi: wcNum('wcPressHi'), press_corr: wcNum('wcPressCorr') || 0,
    calibrated_by: wcVal('wcCalibratedBy'), tech_mgr: wcVal('wcTechMgr'), director: wcVal('wcDirector')
  });
  WC_JOB.cert_no = WC_JOB.job_no ? (WC_JOB.job_no + '-' + (WC_JOB.revision || 0)) : '';
  wcSet('wcCertNo', WC_JOB.cert_no);
}
function wcFillJobForm() {
  const j = WC_JOB || wcBlankJob();
  wcSet('wcJobNo', j.job_no); wcSet('wcRevision', j.revision != null ? j.revision : 0); wcSet('wcCertNo', j.cert_no);
  wcSet('wcClientName', j.client_name); wcSet('wcClientAddr', j.client_addr);
  wcSet('wcEquipment', j.equipment || 'WEIGHT'); wcSet('wcRangeText', j.range_text);
  wcSet('wcManufacturer', j.manufacturer); wcSet('wcModel', j.model); wcSet('wcSerial', j.serial); wcSet('wcIdNo', j.id_no);
  wcSet('wcDateReceive', j.date_receive); wcSet('wcDateCal', j.date_cal); wcSet('wcDateIssue', j.date_issue); wcSet('wcDueDate', j.due_date);
  wcSet('wcTempLo', j.temp_lo); wcSet('wcTempHi', j.temp_hi); wcSet('wcTempCorr', j.temp_corr);
  wcSet('wcRhLo', j.rh_lo); wcSet('wcRhHi', j.rh_hi); wcSet('wcRhCorr', j.rh_corr);
  wcSet('wcPressLo', j.press_lo); wcSet('wcPressHi', j.press_hi); wcSet('wcPressCorr', j.press_corr);
  wcSet('wcCalibratedBy', j.calibrated_by); wcSet('wcTechMgr', j.tech_mgr); wcSet('wcDirector', j.director);
  wcRenderStatus();
}
function wcUpdateEnvReadout() {
  const j = WC_JOB || {};
  const T = wcAvgCorr(j.temp_lo || 0, j.temp_hi || 0, j.temp_corr || 0);
  const RH = wcAvgCorr(j.rh_lo || 0, j.rh_hi || 0, j.rh_corr || 0);
  const P = wcAvgCorr(j.press_lo || 0, j.press_hi || 0, j.press_corr || 0);
  const rho = wcAirDensity(T, RH, P);
  const el = document.getElementById('wcAirDensityOut');
  if (el) el.textContent = Number.isFinite(rho) ? rho.toFixed(5) + ' kg/m³' : '–';
}
function wcRenderStatus() {
  const el = document.getElementById('wcStatusPill');
  if (!el) return;
  const st = (WC_JOB && WC_JOB.status) || 'draft';
  el.textContent = st === 'issued' ? '● ออก Cert แล้ว' : '● ฉบับร่าง';
  el.className = 'status' + (st === 'issued' ? ' ok' : '');
}

// ---- points table render ----
function wcInstrumentOptions(selectedId) {
  return '<option value="">— เลือกเครื่อง —</option>' + (WC_INSTRUMENTS || []).map(i =>
    `<option value="${i.id}"${i.id === selectedId ? ' selected' : ''}>${wcEsc(i.id_code || i.instrument_name || ('#' + i.id))} · ${wcEsc(i.instrument_name || '')}</option>`).join('');
}
function wcComparatorOptions(selectedId) {
  return '<option value="">(อัตโนมัติตามพิกัด)</option>' + (WC_COMPARATORS || []).map(c =>
    `<option value="${c.id}"${c.id === selectedId ? ' selected' : ''}>${wcEsc(c.name)} (${wcEsc(c.id_code || c.serial || '')})</option>`).join('');
}
function wcStdOptions(selectedId) {
  return '<option value="">(อัตโนมัติตามพิกัด)</option>' + (WC_STD_WEIGHTS || []).map(w =>
    `<option value="${w.id}"${w.id === selectedId ? ' selected' : ''}>${wcEsc(w.id_code || '')} ${w.nominal_value}${wcEsc(w.unit || '')}</option>`).join('');
}
function wcAbbaGrid(rowId, abba) {
  const keys = ['r1', 't1', 't2', 'r2'];
  const labels = { r1: 'Ref (r1)', t1: 'Unknown (t1)', t2: 'Unknown (t2)', r2: 'Ref (r2)' };
  const head = '<tr><th>รอบ</th>' + keys.map(k => `<th>${labels[k]}</th>`).join('') + '</tr>';
  const rows = [0, 1, 2].map(i => '<tr><td>' + (i + 1) + '</td>' + keys.map(k =>
    `<td><input type="number" step="any" class="wc-abba-in" value="${(abba[k] && abba[k][i] != null) ? abba[k][i] : 0}" oninput="wcOnAbbaInput('${rowId}','${k}',${i},this.value)"></td>`).join('') + '</tr>').join('');
  return `<table class="wc-abba-tbl"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}
function wcRenderPoints() {
  const host = document.getElementById('wcPointsBody');
  if (!host) return;
  if (!WC_POINTS.length) { host.innerHTML = '<div class="no-data">ยังไม่มีจุดสอบเทียบ — กด "+ เพิ่มจุด"</div>'; wcRecalc(); return; }
  host.innerHTML = WC_POINTS.map(p => `
    <div class="wc-point" data-row="${p._rowId}">
      <div class="wc-point-head">
        <select class="wc-inst" onchange="wcOnInstrumentChange('${p._rowId}', this.value)">${wcInstrumentOptions(p.instrument_id)}</select>
        <button type="button" class="wc-rm" onclick="wcRemovePoint('${p._rowId}')" title="ลบจุดนี้">✕</button>
      </div>
      <div class="wc-point-fields">
        <div class="field"><label>ค่าพิกัด (Nominal)</label><input type="number" step="any" value="${p.nominal_value != null ? p.nominal_value : ''}" oninput="wcOnFieldInput('${p._rowId}','nominal_value',this.value)"></div>
        <div class="field"><label>หน่วย</label><select onchange="wcOnFieldInput('${p._rowId}','unit',this.value)">
          ${['mg', 'g', 'kg'].map(u => `<option value="${u}"${p.unit === u ? ' selected' : ''}>${u}</option>`).join('')}</select></div>
        <div class="field"><label>Marking</label><select onchange="wcOnFieldInput('${p._rowId}','marking',this.value)">
          ${['NONE', 'POINT'].map(m => `<option value="${m}"${p.marking === m ? ' selected' : ''}>${m}</option>`).join('')}</select></div>
        <div class="field"><label>Mass Comparator</label><select onchange="wcOnFieldInput('${p._rowId}','comparator_id', this.value ? Number(this.value) : null)">${wcComparatorOptions(p.comparator_id)}</select></div>
        <div class="field"><label>ตุ้มมาตรฐานอ้างอิง</label><select onchange="wcOnFieldInput('${p._rowId}','std_weight_id', this.value ? Number(this.value) : null)">${wcStdOptions(p.std_weight_id)}</select></div>
      </div>
      <details class="wc-abba-wrap"><summary>ABBA (r1 / t1 / t2 / r2 × 3 รอบ)</summary>${wcAbbaGrid(p._rowId, p.abba)}</details>
      <div class="wc-point-res">
        <div class="kpi"><span>Conventional mass</span><strong id="wc_cm_${p._rowId}">–</strong></div>
        <div class="kpi"><span>ค่าแก้ (mg)</span><strong id="wc_err_${p._rowId}">–</strong></div>
        <div class="kpi"><span>U (k=2, mg)</span><strong id="wc_u_${p._rowId}">–</strong></div>
        <div class="kpi"><span>ผล</span><strong id="wc_pass_${p._rowId}" class="status">–</strong></div>
      </div>
    </div>`).join('');
  wcRecalc();
}
function wcRenderPointsResults() {
  WC_POINTS.forEach(p => {
    const cm = document.getElementById('wc_cm_' + p._rowId);
    const err = document.getElementById('wc_err_' + p._rowId);
    const u = document.getElementById('wc_u_' + p._rowId);
    const pass = document.getElementById('wc_pass_' + p._rowId);
    if (cm) cm.textContent = Number.isFinite(p.conventional_mass) ? p.conventional_mass.toFixed(7) + ' g' : '–';
    if (err) err.textContent = Number.isFinite(p.correction_mg) ? (p.correction_mg >= 0 ? '+' : '') + p.correction_mg.toFixed(4) : '–';
    if (u) u.textContent = Number.isFinite(p.uncertainty_mg) ? p.uncertainty_mg : '–';
    if (pass) { pass.textContent = p.pass == null ? '–' : (p.pass ? 'PASS' : 'FAIL'); pass.className = 'status' + (p.pass == null ? '' : (p.pass ? ' ok' : ' bad')); }
  });
}

// ---- row event handlers (เรียกจาก inline onclick/onchange/oninput ในตาราง) ----
function wcFindPoint(rowId) { return WC_POINTS.find(p => p._rowId === rowId); }
function wcOnInstrumentChange(rowId, val) {
  const p = wcFindPoint(rowId); if (!p) return;
  p.instrument_id = val ? Number(val) : null;
  const inst = wcResolveInst(p.instrument_id);
  if (inst) {
    if (inst.capacity != null && (p.nominal_value == null || p.nominal_value === '')) p.nominal_value = inst.capacity;
  }
  wcRenderPoints();
}
function wcOnFieldInput(rowId, key, val) {
  const p = wcFindPoint(rowId); if (!p) return;
  p[key] = val;
  wcRecalc();
}
function wcOnAbbaInput(rowId, k, i, val) {
  const p = wcFindPoint(rowId); if (!p) return;
  if (!p.abba) p.abba = { r1: [0, 0, 0], t1: [0, 0, 0], t2: [0, 0, 0], r2: [0, 0, 0] };
  if (!p.abba[k]) p.abba[k] = [0, 0, 0];
  p.abba[k][i] = Number(val) || 0;
  wcRecalc();
}
function wcRemovePoint(rowId) {
  WC_POINTS = WC_POINTS.filter(p => p._rowId !== rowId);
  wcRenderPoints();
}

// ---- page globals: wcLoadJob / wcAddPoint / wcRecalc / wcSaveJob / wcIssueCert ----
function wcJobIdFromHash() {
  const m = /#job=([^&]+)/.exec(location.hash);
  return m ? decodeURIComponent(m[1]) : null;
}
function wcAddPoint() {
  WC_POINTS.push(wcNewPointRow());
  wcRenderPoints();
}
// คำนวณใหม่ทุกจุด (อ่านฟอร์ม job → resolve std/comparator/instrument → wcComputePoint) แล้วอัปเดตเฉพาะ cell ผลลัพธ์
function wcRecalc() {
  wcReadJobForm();
  const job = WC_JOB;
  WC_POINTS.forEach(p => {
    const nominalG = Number(p.nominal_value || 0) * (WC_UNIT_G[p.unit] || 1);
    const std = wcResolveStd(p.std_weight_id, p.nominal_value, p.unit);
    const comp = wcResolveComp(p.comparator_id, nominalG);
    const inst = wcResolveInst(p.instrument_id);
    if (std) p.std_weight_id = std.id;
    if (comp) p.comparator_id = comp.id;
    const stdArg = wcStdToStdArg(std);
    const compArg = wcCompToCompArg(comp);
    p._std = stdArg; p._comp = compArg;
    if (!stdArg || !compArg || !p.nominal_value) {
      Object.assign(p, { delta_avg: null, ci: null, mc_bar: null, conventional_mass: null, correction_mg: null, uncertainty_mg: null, veff: null, k: null, mpe_mg: null, pass: null });
      return;
    }
    const instArg = wcInstToInstArg(inst, p);
    const cmcMg = wcCmcForNominal(nominalG);
    const r = wcComputePoint(p, job, stdArg, compArg, instArg, cmcMg);
    Object.assign(p, r);
  });
  wcUpdateEnvReadout();
  wcRenderPointsResults();
}
async function wcLoadJob(id) {
  if (!sb) { try { sb = calCreateClient(); } catch (e) { sb = null; } }
  if (typeof showLoading === 'function') showLoading('กำลังโหลด...');
  try {
    if (sb) await wcLoadLookups();
    const jobId = id || wcJobIdFromHash();
    if (sb && jobId && jobId !== 'new') {
      const { data: job, error } = await sb.from('weight_cal_jobs').select('*').eq('id', jobId).single();
      if (error) throw error;
      WC_JOB = job;
      const { data: pts, error: pErr } = await sb.from('weight_cal_points').select('*').eq('job_id', jobId).order('sort_order');
      if (pErr) throw pErr;
      WC_POINTS = (pts || []).map(p => Object.assign({}, p, {
        _rowId: 'p' + p.id, abba: p.abba || { r1: [0, 0, 0], t1: [0, 0, 0], t2: [0, 0, 0], r2: [0, 0, 0] }
      }));
    } else {
      WC_JOB = wcBlankJob();
      WC_POINTS = [];
    }
    wcFillJobForm();
    wcRenderPoints();
  } catch (e) {
    if (typeof showToast === 'function') showToast('โหลดงานไม่สำเร็จ: ' + e.message, 'error');
  } finally {
    if (typeof hideLoading === 'function') hideLoading();
  }
}
async function wcSaveJob() {
  wcRecalc();
  if (!WC_JOB.job_no) { showToast('กรอกเลขที่งานก่อนบันทึก', 'error'); return false; }
  if (!sb) { showToast('ยังเชื่อมต่อฐานข้อมูลไม่ได้', 'error'); return false; }
  showLoading('กำลังบันทึก...');
  try {
    const T = wcAvgCorr(WC_JOB.temp_lo, WC_JOB.temp_hi, WC_JOB.temp_corr);
    const RH = wcAvgCorr(WC_JOB.rh_lo, WC_JOB.rh_hi, WC_JOB.rh_corr);
    const P = wcAvgCorr(WC_JOB.press_lo, WC_JOB.press_hi, WC_JOB.press_corr);
    WC_JOB.air_density = wcAirDensity(T, RH, P);
    WC_JOB.updated_at = new Date().toISOString();

    const jobRow = Object.assign({}, WC_JOB);
    delete jobRow.id;
    let jobId = WC_JOB.id;
    if (jobId) {
      const { error } = await sb.from('weight_cal_jobs').update(jobRow).eq('id', jobId);
      if (error) throw error;
    } else {
      const { data, error } = await sb.from('weight_cal_jobs').insert(jobRow).select('id').single();
      if (error) throw error;
      jobId = data.id; WC_JOB.id = jobId;
      location.hash = '#job=' + jobId;
    }
    const { error: delErr } = await sb.from('weight_cal_points').delete().eq('job_id', jobId);
    if (delErr) throw delErr;
    if (WC_POINTS.length) {
      const rows = WC_POINTS.map((p, i) => ({
        job_id: jobId, sort_order: i, instrument_id: p.instrument_id || null,
        nominal_value: p.nominal_value, unit: p.unit, marking: p.marking || 'NONE',
        comparator_id: p.comparator_id || null, std_weight_id: p.std_weight_id || null,
        abba: p.abba,
        delta_avg: p.delta_avg, ci: p.ci, mc_bar: p.mc_bar, conventional_mass: p.conventional_mass,
        correction_mg: p.correction_mg, uncertainty_mg: p.uncertainty_mg,
        veff: Number.isFinite(p.veff) ? p.veff : null, k: p.k, mpe_mg: p.mpe_mg, pass: p.pass
      }));
      const { error: insErr } = await sb.from('weight_cal_points').insert(rows);
      if (insErr) throw insErr;
    }
    if (typeof logAudit === 'function') await logAudit('บันทึก', { id: jobId, id_code: WC_JOB.cert_no, instrument_name: 'Weight Cal Job' }, null);
    showToast('บันทึกงาน ' + WC_JOB.cert_no + ' แล้ว', 'success');
    wcRenderStatus();
    return true;
  } catch (e) {
    showToast('บันทึกไม่สำเร็จ: ' + e.message, 'error');
    return false;
  } finally { hideLoading(); }
}
async function wcIssueCert() {
  wcRecalc();
  if (!WC_POINTS.length) { showToast('เพิ่มอย่างน้อย 1 จุดก่อนออก Cert', 'error'); return; }
  WC_JOB.status = 'issued';
  const saved = await wcSaveJob();
  if (!saved) return;
  const CAL = wcBuildCAL(WC_JOB, WC_POINTS);
  window.open('cert-print.html#data=' + encodeURIComponent(JSON.stringify(CAL)), '_blank');
}
