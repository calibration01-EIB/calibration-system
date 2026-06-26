// ===== ข้อมูลตั้งต้น (จากงานจริง 26B232-0) =====
// จุดทดสอบ — comp ไม่ใช้แล้ว (จับคู่ตุ้มจากค่าพิกัดผ่าน comboFor) · ค่าแก้/U ตั้งโดย assignWeights
// ดีฟอลต์ = ชุดที่ทวนสอบกับ Excel · ปุ่ม "สร้างจุดอัตโนมัติ" จะแทนด้วย 10 จุด ช่วงละพิกัด÷10
let POINTS = [1,10,20,50,100,200,500,1000,2000,3000].map(n => ({ nominal: n, corr: 0, U: 0 }));
const READS = { 1:[1,1,1], 10:[10,10,10], 20:[20,20,20], 50:[50,50,50], 100:[100,100,100],
  200:[200,200,200], 500:[500,500,500], 1000:[1000,1000,1000], 2000:[2000,2000,2000], 3000:[2999.99,2999.99,2999.99] };
const REP_READS = [2000,2000,2000,2000,2000,2000,2000,2000,2000,2000];
const PL_READS = [2999.99, 2999.99, 2999.99];
const ECC = [['Middle (1)',1000],['Front left (2)',1000],['Back left (3)',1000.01],['Back right (4)',999.99],['Front right (5)',999.99]];
const TARE = [[500,500],[2000,2000]];
let TOLS = [
  { from: 0, to: 300, tol: 0.05 },
  { from: 300, to: 1000, tol: 0.10 },
  { from: 1000, to: 3100, tol: 0.15 },
];
// ฐาน CMC — โหลดจาก cmc_set/cmc_row (เลือกชุด Permanent/Site ตอนสอบ) · หน่วยมาตรฐาน from_g/to_g=กรัม, cmc_mg=mg
let CMC_SETS = [];                 // ชุด balance ที่ active
let CMC_ROWS = [];                 // แถวของชุดที่เลือก (from_g/to_g กรัม, cmc_mg, low_inc)
let CMC_KIND = 'range';
let CMC_SET_SEL = null;            // set id ที่เลือก
// mock fallback (จนกว่าจะโหลด set ได้) — แถบ MOCK แดงจะเตือน
const MOCK_CMC_ROWS = [ { from_g: 0, to_g: 300, cmc_mg: 3, low_inc: true }, { from_g: 300, to_g: 1000, cmc_mg: 5, low_inc: false }, { from_g: 1000, to_g: 3100, cmc_mg: 8, low_inc: false } ];
function cmcRowsActive() { return (CMC_ROWS && CMC_ROWS.length) ? CMC_ROWS : MOCK_CMC_ROWS; }
function cmcFor(nominalG) {
  const rows = cmcRowsActive();
  if (CMC_KIND === 'point') { const r = rows.find(r => Math.abs(nominalG - r.from_g) <= 1e-9 * Math.max(1, r.from_g)); return r ? r.cmc_mg : 0; }
  const r = rows.find(r => (r.low_inc ? nominalG >= r.from_g : nominalG > r.from_g) && (r.to_g == null || nominalG <= r.to_g));
  return r ? r.cmc_mg : 0;
}
function renderCmcSetDropdown() {
  const sel = document.getElementById('cmcSet'); if (!sel) return;
  sel.innerHTML = CMC_SETS.length
    ? CMC_SETS.map(s => `<option value="${s.id}"${s.id === CMC_SET_SEL ? ' selected' : ''}>${s.lab_status || '?'} (Rev.${s.revision || '-'})</option>`).join('')
    : '<option value="">— MOCK (ยังไม่มีชุด CMC) —</option>';
}
async function onCmcSetChange(id) {
  const sel = CMC_SETS.find(s => s.id === id); if (!sel) return;
  CMC_SET_SEL = id; CMC_KIND = sel.value_kind || 'range';
  const db = sbx(); if (!db) return;
  const { data: rws } = await db.from('cmc_row').select('*').eq('set_id', id).order('seq');
  CMC_ROWS = (rws || []).map(r => ({ from_g: Number(r.from_g), to_g: r.to_g === null ? null : Number(r.to_g), low_inc: !!r.low_inc, cmc_mg: Number(r.cmc_mg) }));
  CMC_IS_MOCK = CMC_ROWS.length === 0;
  recalc(); renderStdBanner();
}
// ===== ทะเบียนชุดตุ้มมาตรฐาน (หลายชุดหลาย ID) — ระบบจริงดึงจาก standard_weights + ใบ cert ล่าสุด =====
// แต่ละชุดมีลูกตุ้มพร้อมค่าแก้/U/Dₛ (resolved) · ชุด F1 ค่าสะท้อนจุดทดสอบเดิม (ทวนสอบกับ Excel ได้) Dₛ=U
const STD_REGISTRY = [
  { id_code:'CLCLSB08-WI01-12', name:'STANDARD WEIGHT SET', model:'CLASS F1 ( 1 - 500 g )', cls:'1-500g/F1', serial:'158880', cert:'26M004-0', due:'2027-01-06',
    weights:[ ['CLW-101',1,0.000004,0.03],['CLW-102',2,0.000010,0.04],['CLW-105',5,0.000012,0.05],['CLW-107',10,0.000047,0.06],['CLW-108',20,0.000079,0.08],['CLW-109',50,-0.00001,0.10],['CLW-110',100,-0.00007,0.16],['CLW-111',200,0.00017,0.30],['CLW-112',500,0.0001,0.80] ] },
  { id_code:'CLCLSB07-WI01', name:'STANDARD WEIGHT', model:'CLASS F1 ( 1 kg )', cls:'1kg/F1', serial:'11119464', cert:'26M005-0', due:'2027-01-06',
    weights:[ ['CLW-113',1000,-0.0022,1.60],['CLW-113X',1000,-0.0024,1.70,'2024-02-01'] ] },
  { id_code:'CLCLSB07-WI02', name:'STANDARD WEIGHT', model:'CLASS F1 ( 2 kg )', cls:'2kg/F1', serial:'11119465', cert:'26M005-0', due:'2027-01-06',
    weights:[ ['CLW-120',2000,-0.0026,3.00] ] },
  { id_code:'CLCLSB07-WI03', name:'STANDARD WEIGHT', model:'CLASS F1 ( 5 kg )', cls:'5kg/F1', serial:'11119470', cert:'26M006-0', due:'2027-03-12',
    weights:[ ['CLW-150',5000,0.0046,2.50] ] },
  { id_code:'CLCLSB07-WI04', name:'STANDARD WEIGHT', model:'CLASS F1 ( 10 kg )', cls:'10kg/F1', serial:'11119471', cert:'26M006-0', due:'2027-03-12',
    weights:[ ['CLW-151',10000,0.0046,5.00] ] },
  { id_code:'CLCLSB07-WI05', name:'STANDARD WEIGHT', model:'CLASS F1 ( 20 kg )', cls:'20kg/F1', serial:'11119472', cert:'26M006-0', due:'2026-12-02',
    weights:[ ['CLW-152',20000,0.010,10.0] ] },
  { id_code:'E2-CLCLRS01', name:'WEIGHT SET (E2)', model:'CLASS E2 ( 1 mg - 1 kg )', cls:'1mg-1kg/E2', serial:'15885', cert:'MM-0148-25', due:'2027-10-15',
    weights:[ ['E2-1g',1,0.000006,0.01],['E2-10g',10,0.000005,0.02],['E2-20g',20,0.000002,0.025],['E2-50g',50,-0.000048,0.03],['E2-100g',100,-0.00007,0.05],['E2-200g',200,-0.00006,0.10],['E2-500g',500,0.00003,0.25],['E2-1kg',1000,-0.00049,0.50] ] },
];
STD_REGISTRY.forEach(s => { s.weights = s.weights.map(a => ({ id_code:a[0], nominal_g:a[1], marking:'none', corr_g:a[2], U_mg:a[3], Ds_mg:a[3], due:a[4]||s.due })); });
const regGet = id => STD_REGISTRY.find(s => s.id_code === id);
let SELECTED_SETS = ['CLCLSB08-WI01-12','CLCLSB07-WI01','CLCLSB07-WI02'];  // ชุดที่หยิบมาใช้ในงานนี้
let STDS = [];   // derived จาก SELECTED_SETS (ชื่อ/รุ่น/serial/cert/due — ใช้ภายในสำหรับ setLabel/คลังตุ้ม)
let CERT_STDS = [];   // แถวที่จะพิมพ์ลง cert: group ตาม Serial No. (auto-compose 5 ช่อง) — แก้ได้ก่อนออกเลข
let STD_ROW_OV = {};  // override ต่อแถว (คีย์ = serial group) เก็บค่าที่ผู้ใช้พิมพ์ทับ — '' ถือว่าตั้งใจล้าง
// รายชื่อลูกค้าที่บันทึกไว้ (dropdown) — ระบบจริงดึงจากฐานข้อมูลลูกค้า · เพิ่ม/แก้ได้ที่นี่
const CLIENTS = [
  { name: 'INTERNATIONAL  LABORATORIES  CORP.,LTD',
    addr: ['62 MU 8, BANGNA-TRAT ROAD, BANG CHALONG SUB-DISTRICT, BANG PHLI DISTRICT,', 'SAMUTPRAKAN PROVINCE, 10540, THAILAND'],
    location: 'B.3/3' },
  { name: 'CAKE & BAKERY CO.,LTD.',
    addr: ['553/21 SOI SATHUPRADIT 41, SATHUPRADIST ROAD, CHONGNONSI, YANNAWA,', 'BANGKOK, 10120 (THAILAND)'],
    location: 'MEETING ROOM' },
  { name: 'OSOTH INTER LABORATORIES CO.,LTD',
    addr: ['600 / 9 MOO11 SRIRACHA INDUSTRIAL PARK , CHONBURI THAILAND 20230'],
    location: 'FILLING ROOM 7' },
];
// ข้อมูลห้องปฏิบัติการ (คงที่) — ไม่ต้องกรอกทุกงาน
const LAB = {
  name: 'INTERNATIONAL LABBORATORIES CROP., LTD .', dept: 'CALIBRATION LABORATORY',
  addr: ['62 MU 8, BANGNA-TRAT ROAD,', 'BANG CHALONG SUB-DISTRICT, BANG PHLI DISTRICT,', 'SAMUTPRAKAN PROVINCE, 10540, THAILAND'],
  phone: 'PHONE : (02)  3468222-4  FAX : (02) 3468233-4',
};

const byId = id => document.getElementById(id);
const fmt = (v, d = 6) => Number.isFinite(v) ? parseFloat(v.toFixed(d)).toString() : '–';
const val = (id, def = '') => { const el = byId(id); return el ? el.value.trim() : def; };
const calRound = (v, d) => Number.isFinite(v) ? +v.toFixed(d) : v;

// ปัด "ขึ้น" เป็น 2 เลขนัยสำคัญ (ตาม UKAS M3003 — ค่า U ต้องไม่ถูกประเมินต่ำกว่าจริง)
// 0.290972 → 0.30 · 8.1649 → 8.2 · 9.6434 → 9.7 · 11.3152 → 12
function roundUp2sf(v) {
  if (!Number.isFinite(v) || v <= 0) return v;
  const mag = Math.floor(Math.log10(v));      // อันดับของหลักนำ
  const factor = Math.pow(10, mag - 1);       // ตำแหน่งเลขนัยสำคัญตัวที่ 2
  return Math.ceil(v / factor - 1e-9) * factor;
}

// ปัดเศษ U สำหรับรายงาน: นน. ≥ 1000 g → ปัดขึ้นเต็มหน่วย mg · < 1000 g → ปัดขึ้น 2 เลขนัยสำคัญ
function roundRepU(U_mg, nominal_g) {
  return nominal_g >= 1000 ? Math.ceil(U_mg - 1e-9) : roundUp2sf(U_mg);
}
// แสดง U รายงาน: > 100 mg → หน่วย g · มิฉะนั้น mg
function fmtRepU(mg) {
  if (!Number.isFinite(mg)) return '–';
  if (mg > 100) { const g = mg / 1000; return (Number.isInteger(g) ? g : +g.toFixed(4)) + ' g'; }
  return (Number.isInteger(mg) ? mg : +mg.toFixed(2)) + ' mg';
}
// ตาราง coverage factor k ตาม Veff (UKAS M3003 ระดับความเชื่อมั่น 95.45%)
// Veff > 100 → k = 2 · ต่ำกว่านั้นเปิดตาราง (ปัด Veff ลงเพื่อความ conservative)
const KTAB = [[1,13.97],[2,4.53],[3,3.31],[4,2.87],[5,2.65],[6,2.52],[7,2.43],[8,2.37],[9,2.32],[10,2.28],[11,2.25],[12,2.23],[13,2.21],[14,2.20],[15,2.18],[16,2.17],[17,2.16],[18,2.15],[19,2.14],[20,2.13],[25,2.11],[30,2.09],[35,2.07],[40,2.06],[45,2.06],[50,2.05],[100,2.025]];
function kFromVeff(veff) {
  if (!Number.isFinite(veff) || veff > 100) return 2;
  if (veff < 1) return KTAB[0][1];
  let k = 2.025;
  for (const [v, kv] of KTAB) { if (veff >= v) k = kv; else break; }
  return k;
}

// แปลงองค์ประกอบตุ้ม (เช่น "F1 1 kg + 2 kg") → รายละเอียดเป็นกรัม
// ตุ้มเดี่ยว = "1000" · รวมหลายลูก = "3000(1000+2000)"
// แยกส่วนประกอบตุ้มของจุดทดสอบ → อาเรย์น้ำหนักเป็นกรัม (เช่น 'F1 1 kg + 2 kg' → [1000, 2000])
function compParts(comp) {
  return String(comp).replace(/^F\d+\s*/i, '').split('+').map(t => {
    const m = t.trim().match(/([\d.]+)\s*(kg|g)?/i);
    if (!m) return null;
    let v = parseFloat(m[1]);
    if (m[2] && m[2].toLowerCase() === 'kg') v *= 1000;
    return v;
  }).filter(v => Number.isFinite(v));
}
function weightDesc(comp) {
  const parts = compParts(comp);
  if (!parts.length) return String(comp);
  if (parts.length === 1) return String(parts[0]);
  return parts.reduce((a, b) => a + b, 0) + '(' + parts.join('+') + ')';
}

// รูปจานเครื่องชั่ง (0=สี่เหลี่ยม, 1=กลม, 2=สามเหลี่ยม) — ตรงกับ panSVG ในใบ Cert
function panSVG(shape) {
  const c = (x,y,n) => `<circle cx="${x}" cy="${y}" r="4.8" fill="#fff" stroke="#111" stroke-width="1"/><text x="${x}" y="${y+2.2}" font-size="6.6" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" fill="#111">${n}</text>`;
  const tc = (x,y,n) => `<circle cx="${x}" cy="${y}" r="3.8" fill="#fff" stroke="#111" stroke-width=".9"/><text x="${x}" y="${y+1.9}" font-size="5.4" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" fill="#111">${n}</text>`;
  if (shape === 0) return `<svg width="46" height="46" viewBox="0 0 44 44"><rect x="3" y="3" width="38" height="38" fill="none" stroke="#111" stroke-width="1.3"/><line x1="22" y1="3" x2="22" y2="41" stroke="#111" stroke-width=".7"/><line x1="3" y1="22" x2="41" y2="22" stroke="#111" stroke-width=".7"/><line x1="3" y1="3" x2="41" y2="41" stroke="#111" stroke-width=".7"/><line x1="41" y1="3" x2="3" y2="41" stroke="#111" stroke-width=".7"/>${c(13,13,3)}${c(31,13,4)}${c(13,31,2)}${c(31,31,5)}${c(22,22,1)}</svg>`;
  if (shape === 1) return `<svg width="46" height="46" viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" fill="none" stroke="#111" stroke-width="1.3"/><line x1="22" y1="3" x2="22" y2="41" stroke="#111" stroke-width=".7"/><line x1="3" y1="22" x2="41" y2="22" stroke="#111" stroke-width=".7"/><line x1="8.6" y1="8.6" x2="35.4" y2="35.4" stroke="#111" stroke-width=".7"/><line x1="35.4" y1="8.6" x2="8.6" y2="35.4" stroke="#111" stroke-width=".7"/>${c(14,14,3)}${c(30,14,4)}${c(14,30,2)}${c(30,30,5)}${c(22,22,1)}</svg>`;
  const tri = 'M13 47 C7 47 4 43 6 37 C7 34 8.5 31 10.5 28 L25 8 C28 3.8 34 3.8 37 8 L51.5 28 C53.5 31 55 34 56 37 C58 43 53 47 47 47 Z';
  return `<svg width="54" height="48" viewBox="0 0 60 54"><defs><clipPath id="triPrevClip"><path d="${tri}"/></clipPath></defs><path d="${tri}" fill="#fff"/><g clip-path="url(#triPrevClip)" stroke="#111" stroke-width=".8"><line x1="30" y1="0" x2="30" y2="54"/><line x1="0" y1="29" x2="60" y2="29"/><line x1="30" y1="29" x2="17" y2="16"/><line x1="30" y1="29" x2="43" y2="16"/><line x1="30" y1="29" x2="1" y2="58"/><line x1="30" y1="29" x2="59" y2="58"/></g><path d="${tri}" fill="none" stroke="#111" stroke-width="1.35" stroke-linejoin="round"/>${tc(22,20,3)}${tc(38,20,4)}${tc(21,38,2)}${tc(39,38,5)}${tc(30,29,1)}</svg>`;
}
function drawPanPrev() {
  const el = byId('eccPanPrev'); if (!el) return;
  el.innerHTML = panSVG(parseInt(byId('eccPan').value, 10) || 0);
}

function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = arr.mean ?? arr.reduce((a,b)=>a+b,0)/arr.length;
  return Math.sqrt(arr.reduce((s,x)=>s+(x-m)**2,0)/(arr.length-1));
}

// ===== build inputs =====
function renderTolRows() {
  byId('tolRows').innerHTML = TOLS.map((t,i) => `<tr>
    <td>ช่วงที่ ${i+1}</td>
    <td class="num"><input type="number" step="any" value="${t.from}" onchange="TOLS[${i}].from=+this.value;recalc()"></td>
    <td class="num"><input type="number" step="any" value="${t.to}" onchange="TOLS[${i}].to=+this.value;recalc()"></td>
    <td class="num"><input type="number" step="any" value="${t.tol}" onchange="TOLS[${i}].tol=+this.value;recalc()"></td>
  </tr>`).join('');
}
function buildStatic() {
  byId('cPick').innerHTML = CLIENTS.map((c,i) => `<option value="${i}">${c.name}</option>`).join('') +
    '<option value="-1">— กรอกเอง / อื่น ๆ —</option>';

  renderTolRows();

  renderStdTable();

  byId('repRow').innerHTML = '<td>อ่านได้ (g)</td>' + REP_READS.map((v,i) =>
    `<td><input type="number" step="any" class="repIn" value="${v}" oninput="recalc()" style="width:72px"></td>`).join('');

  byId('plRow').innerHTML = PL_READS.map((v,i) =>
    `<td><input type="number" step="any" class="plIn" value="${v}" oninput="recalc()"></td>`).join('') +
    '<td class="num calc" id="plAvg">–</td>';

  renderErrRows(true);

  byId('eccRows').innerHTML = ECC.map((e,i) => `<tr>
    <td>${e[0]}</td>
    <td><input type="number" step="any" class="eccIn" value="${e[1]}" oninput="recalc()"></td>
    <td class="num calc" id="eccD${i}">–</td>
  </tr>`).join('');

  byId('tareRows').innerHTML = TARE.map((t,i) => `<tr>
    <td class="num">${t[0]}</td>
    <td><input type="number" step="any" class="tareIn" value="${t[1]}" oninput="recalc()"></td>
    <td class="num calc" id="tareD${i}">–</td>
  </tr>`).join('');

  renderPointRows();
}
// ตารางผลดิบ (st3) — สร้างจาก POINTS · fresh=true → รีเซ็ตค่าอ่านเป็นดีฟอลต์ · ไม่งั้นคงค่าที่กรอก
function renderErrRows(fresh) {
  byId('errRows').innerHTML = POINTS.map((p,i) => {
    const def = READS[p.nominal] || [p.nominal, p.nominal, p.nominal];
    const r = [0,1,2].map(j => {
      if (fresh) return def[j];
      const el = document.querySelector(`.errIn[data-p="${i}"][data-r="${j}"]`);
      return (el && el.value !== '') ? el.value : def[j];
    });
    return `<tr>
    <td><strong>${p.nominal}</strong> <span class="chip" style="margin-left:4px">${pointDesc(p)}</span></td>
    <td class="num calc" id="cm${i}">–</td>
    ${[0,1,2].map(j => `<td><input type="number" step="any" class="errIn" data-p="${i}" data-r="${j}" value="${r[j]}" oninput="recalc()"></td>`).join('')}
    <td class="num calc" id="avg${i}">–</td>
    <td class="num calc" id="cor${i}">–</td>
    <td class="num calc" id="sd${i}">–</td>
  </tr>`;
  }).join('');
}
function renderPointRows() {
  byId('pointRows').innerHTML = POINTS.map((p,i) => {
    const used = (p.avail !== false && p.usedIds && p.usedIds.length) ? p.usedIds.join(' + ') : pointDesc(p);
    const warn = p.avail === false ? `<span class="pt-warn">ตุ้มไม่พร้อม</span>` : '';
    return `<tr>
    <td><input type="number" step="any" class="nomIn" data-i="${i}" value="${p.nominal}" onchange="setPointNominal(${i},this.value)" style="width:84px"></td>
    <td><span class="chip">${used}</span>${warn}</td>
    <td class="num"><input type="number" step="any" class="corrIn roIn" data-i="${i}" value="${calRound(p.corr,7)}" readonly tabindex="-1" title="คำนวณจากตุ้มที่เลือก (แก้ไม่ได้)"></td>
    <td class="num calc" id="conv${i}">${fmt(p.nominal + p.corr, 6)}</td>
    <td class="num"><input type="number" step="any" class="uIn roIn" data-i="${i}" value="${p.U}" readonly tabindex="-1" title="คำนวณจากตุ้มที่เลือก (แก้ไม่ได้)"></td>
    <td class="num"><button type="button" class="rmset" onclick="removePoint(${i})" title="ลบจุด">✕</button></td>
  </tr>`;
  }).join('');
}
// ===== จุดทดสอบแบบปรับได้ (พิกัด÷10 · เพิ่ม/ลบ/แก้ค่าพิกัด) =====
function rebuildPoints(fresh) { renderErrRows(fresh); assignWeights(); renderPointRows(); recalc(); }
function setPointNominal(i, v) { const n = parseFloat(v); if (Number.isFinite(n) && n > 0) POINTS[i].nominal = n; rebuildPoints(); }
function addPoint() { POINTS.push({ nominal: 0, corr: 0, U: 0 }); rebuildPoints(); }
function removePoint(i) { POINTS.splice(i, 1); rebuildPoints(); }
function genPoints(cap) {
  const c = parseFloat(cap != null ? cap : val('iCap'));
  if (!Number.isFinite(c) || c <= 0) { alert('กรุณาระบุพิกัด Max ของเครื่องชั่งก่อน'); return; }
  const step = c / 10;
  POINTS = [];
  for (let k = 1; k <= 10; k++) POINTS.push({ nominal: +(step * k).toFixed(3), corr: 0, U: 0 });
  rebuildPoints(true);
}

// เลือกบริษัทจาก dropdown → เติมชื่อ + ที่อยู่ (แก้ต่อได้)
function pickClient(idx) {
  const i = parseInt(idx, 10);
  if (i < 0 || !CLIENTS[i]) return;
  const c = CLIENTS[i];
  byId('cClientName').value = c.name;
  byId('cAddr').value = c.addr.join('\n');
  if (c.location) byId('cLocation').value = c.location;
}

// อัปเดตวันครบกำหนด (+1 ปี) จากวันที่สอบเทียบ
function nextYearOf(dateStr) {
  const d = new Date(dateStr); if (isNaN(d)) return '';
  d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0,10);
}

// ===== คำนวณทั้งหน้า =====
function recalc() {
  const d = parseFloat(byId('iRes').value) || 0.01;
  byId('iDateNext').value = nextYearOf(byId('iDate').value);

  // 3.1 repeatability
  const reps = [...document.querySelectorAll('.repIn')].map(el => parseFloat(el.value)).filter(Number.isFinite);
  const repAvg = reps.length ? reps.reduce((a,b)=>a+b,0)/reps.length : NaN;
  const repStd = stdev(reps);
  let maxDiff = 0;
  for (let i = 1; i < reps.length; i++) maxDiff = Math.max(maxDiff, Math.abs(reps[i]-reps[i-1]));
  const uR_mg = (repStd / 1.732) * 1000;
  byId('repAvg').textContent = fmt(repAvg, 4) + ' g';
  byId('repStd').textContent = fmt(repStd, 6) + ' g';
  byId('repMaxDiff').textContent = fmt(maxDiff, 4) + ' g';
  byId('repUr').textContent = fmt(uR_mg, 4);

  // 3.3 preload average
  const plReads = [...document.querySelectorAll('.plIn')].map(el => parseFloat(el.value)).filter(Number.isFinite);
  if (byId('plAvg')) byId('plAvg').textContent = plReads.length ? fmt(plReads.reduce((a,b)=>a+b,0)/plReads.length, 4) : '–';

  // 3.2 error per point
  const rows = POINTS.map((p, i) => {
    const reads = [0,1,2].map(j => parseFloat(document.querySelector(`.errIn[data-p="${i}"][data-r="${j}"]`).value)).filter(Number.isFinite);
    const avg = reads.length ? reads.reduce((a,b)=>a+b,0)/reads.length : NaN;
    const conv = p.nominal + p.corr;
    const corr = conv - avg;
    const sd = stdev(reads);
    if (byId('conv'+i)) byId('conv'+i).textContent = fmt(conv, 6);
    byId('cm'+i).textContent = fmt(conv, 6);
    byId('avg'+i).textContent = fmt(avg, 4);
    byId('cor'+i).textContent = fmt(corr, 6);
    byId('sd'+i).textContent = fmt(sd, 6);
    return { ...p, avg, conv, corrBal: corr, sd };
  });

  // 3.4 ecc / 3.5 tare
  const eccVals = [...document.querySelectorAll('.eccIn')].map(el => parseFloat(el.value));
  let eccMax = 0;
  eccVals.forEach((v, i) => {
    const diff = i === 0 ? 0 : v - eccVals[0];
    byId('eccD'+i).textContent = fmt(diff, 4);
    if (Math.abs(diff) > Math.abs(eccMax)) eccMax = diff;
  });
  byId('eccMax').textContent = fmt(eccMax, 4) + ' g';
  [...document.querySelectorAll('.tareIn')].forEach((el, i) => {
    byId('tareD'+i).textContent = fmt(TARE[i][0] - parseFloat(el.value), 4);
  });

  // 4 uncertainty budget per point — สูตร FRM-CAL92
  const SQ3 = 1.7321;
  const d_mg = (d * 1000) / 2;
  const roundUp = byId('roundUpU').checked;
  const abPpm = parseFloat(byId('abMaterial').value) || 1;   // ppm ตามชนิดวัสดุตุ้ม
  const nRep = reps.length;                                  // จำนวนครั้ง repeatability (n)
  byId('uncRows').innerHTML = rows.map((p, i) => {
    const uWS = p.U / 2;
    // D_s มาจากคลังใบรับรองมาตรฐาน (คิด drift เทียบใบก่อนหน้าที่นั่น) — ที่นี่ใช้ค่าที่ส่งมา ถ้าไม่มีใช้ U
    const dsMag = Number.isFinite(p.dsIn) && p.dsIn > p.U ? p.dsIn : p.U;
    const uDS = dsMag / SQ3;
    p.ds = dsMag;
    const udo = d_mg / SQ3, ud = d_mg / SQ3;
    const uAb = (p.nominal * 1000 * abPpm / 1e6) / SQ3;
    const uRr = uR_mg;
    const uc = Math.sqrt(uWS**2 + uDS**2 + udo**2 + ud**2 + uAb**2 + uRr**2);
    // Welch–Satterthwaite: เฉพาะ repeatability (Type A) มี DOF = n−1, ที่เหลือเป็น ∞
    const veff = (uRr > 0 && nRep > 1) ? (uc ** 4) * (nRep - 1) / (uRr ** 4) : Infinity;
    const k = kFromVeff(veff);
    const Uk = uc * k;
    // CMC floor: ถ้า U คำนวณ ≤ CMC ที่เครมไว้ → รายงานเป็น CMC แทน
    const cmc = cmcFor(p.nominal);
    const usedCMC = cmc > 0 && Uk <= cmc;
    const Urep = usedCMC ? cmc : (roundUp ? roundRepU(Uk, p.nominal) : Uk);
    p.Ufinal_mg = Urep; p.k = k; p.veff = veff;
    return `<tr onclick="showUncDetail(${i})" style="cursor:pointer">
      <td><strong>${p.nominal}</strong></td>
      <td class="num">${fmt(uWS,4)}</td><td class="num">${fmt(uDS,4)}</td>
      <td class="num">${fmt(udo,4)}</td><td class="num">${fmt(ud,4)}</td>
      <td class="num">${fmt(uAb,4)}</td><td class="num">${fmt(uRr,4)}</td>
      <td class="num calc">${fmt(uc,4)}</td>
      <td class="num">${Number.isFinite(veff) ? Math.round(veff) : '∞'}</td>
      <td class="num">${k}</td>
      <td class="num calc">${fmt(Uk,4)}</td>
      <td class="num">${cmc > 0 ? fmt(cmc,4) : '–'}</td>
      <td class="num"><strong class="calc">${fmtRepU(Urep)}${usedCMC ? ' (CMC)' : ''}</strong></td>
    </tr>`;
  }).join('');
  window._rows = rows;

  // 5 evaluation
  // ช่วง Tolerance: ใช้ "ขอบบน (to)" เป็นเกณฑ์ + ข้ามแถวที่ยังไม่ได้ตั้งค่า (to ≤ from)
  const tolBands = TOLS.filter(t => Number.isFinite(t.to) && t.to > t.from).sort((a,b) => a.to - b.to);
  const tolFor = nom => {
    if (!tolBands.length) return Infinity;                       // ไม่มีช่วง → ไม่ตัด (ผ่าน)
    return (tolBands.find(t => nom <= t.to) || tolBands[tolBands.length - 1]).tol;
  };
  let allPass = true;
  byId('evalRows').innerHTML = rows.map(p => {
    const errG = Math.round(-p.corrBal * 1000) / 1000;
    const Ug = p.Ufinal_mg / 1000;
    const tol = tolFor(p.nominal);
    const pass = (errG + Ug) <= tol && (errG - Ug) >= -tol;
    if (!pass) allPass = false;
    return `<tr>
      <td><strong>${p.nominal}</strong></td>
      <td class="num">${fmt(errG,3)}</td>
      <td class="num">${fmt(Ug,4)}</td>
      <td class="num">${fmt(errG+Ug,4)}</td>
      <td class="num">${fmt(errG-Ug,4)}</td>
      <td class="num">${fmt(tol,3)}</td>
      <td class="${pass?'pass':'fail'}">${pass?'✓ PASS':'✗ FAIL'}</td>
    </tr>`;
  }).join('');
  const ob = byId('overallBadge');
  ob.className = 'status ' + (allPass ? 'ok' : 'bad');
  ob.textContent = allPass ? 'ผลรวม: PASS ทุกจุด' : 'ผลรวม: มีจุด FAIL';

}

function showUncDetail(i) {
  const p = window._rows[i];
  byId('uncDetail').innerHTML =
    `จุด ${p.nominal} g: u = √( (${p.U}/2)² + (${p.U}/√3)² + (5/√3)² + (5/√3)² + (${fmt(p.nominal/1000,3)}/√3)² + u(R)² ) × k=${p.k ?? 2} (Veff ${Number.isFinite(p.veff) ? Math.round(p.veff) : '∞'}) → U = ${fmt(p.Ufinal_mg,4)} mg`;
}

// ===== รวบข้อมูลที่กรอก + ผลคำนวณ → CAL object ที่ cert-print.html ใช้ =====
function buildCAL() {
  recalc();
  const rows = window._rows || [];
  const num = (id, def) => { const v = parseFloat(val(id)); return Number.isFinite(v) ? v : def; };

  const temps = [...document.querySelectorAll('.tIn')].map(el => parseFloat(el.value));
  const rhs   = [...document.querySelectorAll('.rhIn')].map(el => parseFloat(el.value));
  const warm  = [...document.querySelectorAll('.wuIn')].map(el => el.value.trim());
  const ctime = [...document.querySelectorAll('.ctIn')].map(el => el.value.trim());
  const reps  = [...document.querySelectorAll('.repIn')].map(el => parseFloat(el.value)).filter(Number.isFinite);
  const plReads = [...document.querySelectorAll('.plIn')].map(el => parseFloat(el.value)).filter(Number.isFinite);
  const eccReads = [...document.querySelectorAll('.eccIn')].map(el => parseFloat(el.value));
  const tareEls  = [...document.querySelectorAll('.tareIn')];
  const dateCal = val('iDate') || val('iDateRecv');

  const points = rows.map((p, i) => {
    const reads = [0,1,2].map(j => parseFloat(document.querySelector(`.errIn[data-p="${i}"][data-r="${j}"]`).value));
    return { nominal: p.nominal, desc: pointDesc(p), conv: calRound(p.conv, 7), U: p.U, ds: calRound(p.ds, 6), reads };
  });

  const tolText = TOLS.map((t, i) => `±  ${t.tol} g (${i === 0 ? '0' : '>' + t.from}-${t.to})`);

  return {
    cert_no: val('fCertNo'), job_no: val('fJobNo'), request_no: val('fReqNo'),
    client: { name: val('cClientName'), addr: byId('cAddr').value.split('\n').map(s => s.trim()).filter(Boolean) },
    lab: { name: LAB.name, dept: LAB.dept, addr: LAB.addr, phone: LAB.phone },
    equipment: val('eEquip'), equipment_th: val('eEquipTh'), unit: 'g',
    capacity: num('iCap', 0), resolution: num('iRes', 0.01),
    manufacturer: val('eMfr'), model: val('eModel'), serial: val('eSerial'),
    id_no: val('eId'), asset: val('eAsset'), accuracy_class: val('eClass'),
    condition: val('eCondition'), adjusted: val('eAdjusted'), user_range: val('eUserRange'), cal_type: val('eCalType'),
    temp: temps, rh: rhs, warmup: warm, cal_time: ctime,
    location: val('cLocation'), section: val('cSection'), unit_dept: val('cUnitDept'),
    date_receive: val('iDateRecv'), date_cal: dateCal,
    date_next: val('iDateNext') || nextYearOf(dateCal), date_issue: val('fDateIssue'),
    calibrated_by: val('fCalBy'), procedure: val('fProcedure'),
    tolerances: tolText,
    ab_ppm: parseFloat(byId('abMaterial').value) || 1,
    cmc: cmcRowsActive().map(c => ({ from: c.from_g, to: c.to_g, cmc: c.cmc_mg })),
    cmc_set_id: CMC_SET_SEL || null,
    cmc_lab_status: (CMC_SETS.find(s => s.id === CMC_SET_SEL) || {}).lab_status || null,
    cmc_revision: (CMC_SETS.find(s => s.id === CMC_SET_SEL) || {}).revision || null,
    cmc_based_on: (CMC_SETS.find(s => s.id === CMC_SET_SEL) || {}).based_on || null,
    standards: CERT_STDS.map(s => ({ name: s.name, model: s.model, cls: s.cls, serial: s.serial, id_code: s.id_code, cert: s.cert, due: s.due })),
    // snapshot การเลือกทั้งหมด → prefill ครั้งหน้าของเครื่องนี้ (ชุด + ลูกที่ติ๊ก + การพิมพ์ทับ cert)
    sel_snapshot: {
      sets: SELECTED_SETS.slice(),
      checked: AVAIL_WEIGHTS.filter(w => w.checked).map(w => w.id_code),
      std_ov: STD_ROW_OV,
    },
    preload: { point: num('plPoint', 0), reads: plReads },
    repeat: { point: num('repPoint', 0), reads: reps },
    points,
    ecc:  { wt: num('eccWt', 0), positions: ECC.map(e => e[0]), reads: eccReads, pan: parseInt(val('eccPan'), 10) || 0 },
    tare: { wt: num('tareWt', 0), checks: TARE.map((t, i) => [t[0], parseFloat(tareEls[i].value)]) },
    signers: { tech_mgr: val('sTechMgr'), director: val('sDirector'), approver: val('sApprover') },
    tols: TOLS.map(t => ({ from: t.from, to: t.to, tol: t.tol })),   // raw → ใช้คืนค่าตอนเปิดดูรายละเอียด (#rec=)
  };
}

// เก็บ CAL ลง localStorage แล้วเปิด template ใบรับรอง
function openCert() {
  try {
    const json = JSON.stringify(buildCAL());
    try { localStorage.setItem('calData', json); } catch (e) {}
    window.open('cert-print.html#data=' + encodeURIComponent(json), '_blank');
  } catch (e) { alert('สร้างใบรับรองไม่สำเร็จ: ' + e.message); }
}

// ===== รับชุดตุ้มจากคลังใบรับรองมาตรฐาน (standard-cert-design) =====
// อ่าน #std= (หรือ localStorage 'stdData') → map ค่าแก้/U/Dₛ เข้าจุดทดสอบ
// จุดที่รวมตุ้มหลายลูก: บวกค่าแก้ (Σ) · บวก U (ΣUᵢ) · Dₛ = max(ΣU, |Σค่าแก้ปัจจุบัน−ครั้งก่อน|) ← ส่ง Ds_mg ต่อลูกมาแล้ว จึง Σ
// ใช้เฉพาะ #std= (การกด "ใช้ชุดนี้สอบเทียบ" ส่งผ่าน hash เสมอ) — เปิดหน้าเปล่าจะคงค่า demo ไว้สำหรับทวนสอบ
function readIncomingStd() {
  const m = location.hash.match(/std=([^&]+)/);
  if (!m) return null;
  try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; }
}
// ใบรับรองที่ส่งมา (#std=) → เพิ่มชุดเข้าทะเบียน + เลือกชุดนั้น (ค่า cert-resolved มี drift→Dₛ)
function applyIncomingStd(std) {
  if (!std || !Array.isArray(std.weights) || !std.weights.length) return;
  const id = std.set_code || std.cert_no || 'INCOMING';
  const entry = {
    id_code: id, name: std.item || 'WEIGHT SET (จากใบรับรอง)',
    model: std.class_grade ? ('CLASS ' + std.class_grade) : '', cls: std.class_grade || '',
    serial: std.serial_no || '', cert: std.cert_no || '', due: std.due_date || '',
    weights: std.weights.map(w => ({
      id_code: w.id_code || (id + '·' + (w.nominal_g>=1000 ? (w.nominal_g/1000)+'kg' : w.nominal_g+'g') + (w.marking && w.marking!=='none' ? '·'+w.marking : '')),
      nominal_g: w.nominal_g, marking: w.marking || 'none', corr_g: w.corr_g, U_mg: w.U_mg, Ds_mg: w.Ds_mg, due: std.due_date || '',
    })),
  };
  const ix = STD_REGISTRY.findIndex(s => s.id_code === id);
  if (ix >= 0) STD_REGISTRY[ix] = entry; else STD_REGISTRY.push(entry);
  SELECTED_SETS = [id];   // เริ่มจากชุดที่ส่งมา (เพิ่มชุดอื่นได้จากดรอปดาวน์)
  const b = byId('stdBanner');
  if (b) {
    b.style.cssText = 'display:block;margin-bottom:10px;background:#eef0fb;border:1px solid #534ab740;border-radius:8px;padding:8px 10px;font-size:12px;color:#3b3680';
    b.innerHTML = `<i class="ti ti-link"></i> ดึงตุ้มจากใบรับรอง <b>${std.cert_no || '–'}</b>`
      + (std.prev_cert_no ? ` · คิด Dₛ เทียบใบก่อนหน้า <b>${std.prev_cert_no}</b> (max(U, drift))` : ` · ไม่มีใบก่อนหน้า → Dₛ = U`)
      + ` — เพิ่มชุดอื่นได้จากดรอปดาวน์`;
  }
}

// ===== ชุดที่เลือก → ตาราง STDS + คลังลูกตุ้ม (AVAIL_WEIGHTS) =====
let AVAIL_WEIGHTS = [];
function deriveStds() {
  STDS = SELECTED_SETS.map(regGet).filter(Boolean)
    .map(s => ({ name:s.name, model:s.model, cls:s.cls, serial:s.serial, id_code:s.id_code, cert:s.cert, due:s.due }));
  // deriveCertStds() เรียกท้าย rebuildAvail แทน (ต้องใช้สถานะติ๊กของ AVAIL_WEIGHTS)
}
// escape helpers สำหรับ value/attr และ string ในเครื่องหมาย ' ของ inline handler
function _attr(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function _jsq(v){ return String(v==null?'':v).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
// "พิกัด / Class" จากลูกตุ้มในกลุ่ม: nominal + mark + หน่วย + /class
// ≥3 ค่าต่างกัน→ช่วง min-max · ไม่งั้น→คอมมา (ค่าซ้ำต่าง mark รวม เช่น "2,2*kg")
function composeStdCls(weights, cls) {
  const ws = (weights || []).filter(w => Number(w.nominal_g) > 0);
  if (!ws.length) return cls || '';
  const maxG = Math.max.apply(null, ws.map(w => Number(w.nominal_g)));
  const unit = maxG >= 1000 ? 'kg' : (maxG >= 1 ? 'g' : 'mg');
  const conv = g => unit === 'kg' ? g / 1000 : (unit === 'g' ? g : g * 1000);
  const fmt = v => String(Math.round(v * 1e6) / 1e6);
  const dmap = {};   // ค่าพิกัด(แสดง) → [mark...]
  ws.forEach(w => { const v = fmt(conv(Number(w.nominal_g))); (dmap[v] = dmap[v] || []).push((w.marking && w.marking !== 'none') ? w.marking : ''); });
  const denoms = Object.keys(dmap).map(Number).sort((a, b) => a - b);
  const valStr = denoms.length >= 3
    ? (fmt(denoms[0]) + '-' + fmt(denoms[denoms.length - 1]))
    : denoms.map(d => dmap[fmt(d)].slice().sort().map(m => fmt(d) + m).join(',')).join(',');
  return valStr + unit + (cls ? '/' + cls : '');
}
// แถว cert จาก "ลูกที่ติ๊ก": ครบชุด→1 แถว(ช่วง) · ไม่ครบ→แยกตามค่าพิกัด (ค่าเดียวกัน+mark รวมแถว) · auto แล้วทับด้วย STD_ROW_OV
function deriveCertStds() {
  const groups = [];   // [{ key, weights, reg, full }]
  SELECTED_SETS.map(regGet).filter(Boolean).forEach(reg => {
    const setW = AVAIL_WEIGHTS.filter(w => w.set_id === reg.id_code);
    const checked = setW.filter(w => w.checked);
    if (!checked.length) return;
    if (checked.length === setW.length) {
      groups.push({ key: 'F:' + reg.id_code, weights: checked.slice(), reg, full: true });   // ครบชุด → 1 แถว(ช่วง)
    } else {
      const byNom = {};
      checked.forEach(w => { const n = Number(w.nominal_g); (byNom[n] = byNom[n] || []).push(w); });
      Object.keys(byNom).map(Number).sort((a, b) => a - b).forEach(n => {
        groups.push({ key: 'P:' + reg.id_code + ':' + n, weights: byNom[n], reg, full: false });   // ไม่ครบ → 1 แถว/ค่าพิกัด
      });
    }
  });
  groups.sort((a, b) => Math.min.apply(null, a.weights.map(w => +w.nominal_g)) - Math.min.apply(null, b.weights.map(w => +w.nominal_g)));
  const liveKeys = {};
  CERT_STDS = groups.map(g => {
    const reg = g.reg, classG = reg.cls || '';
    const noms = g.weights.map(w => Number(w.nominal_g)).filter(n => n > 0);
    const serials = Array.from(new Set(g.weights.map(w => (w.serial && String(w.serial).trim()) || '').filter(Boolean)));
    const serial = serials.length ? serials.join(',') : (reg.serial || '');
    const certs = Array.from(new Set(g.weights.map(w => w.cert || reg.cert).filter(Boolean)));
    const dues = g.weights.map(w => w.due || reg.due).filter(Boolean);
    const ids = Array.from(new Set(g.weights.map(w => w.id_code).filter(Boolean)));
    let model = reg.model || '';
    if (noms.length && model.indexOf('(') < 0) {
      const lo = fmtWeightUnit(Math.min.apply(null, noms)), hi = fmtWeightUnit(Math.max.apply(null, noms));
      const same = lo.val === hi.val && lo.unit === hi.unit;
      const rangeTxt = same ? `${lo.val} ${lo.unit}` : `${lo.val} ${lo.unit} - ${hi.val} ${hi.unit}`;
      const base = model || (classG ? `CLASS ${classG}` : '');
      model = base ? `${base} ( ${rangeTxt} )` : `( ${rangeTxt} )`;
    }
    const auto = {
      name: 'STANDARD WEIGHT', model,
      cls: composeStdCls(g.weights, classG),
      serial,
      id_code: g.full ? reg.id_code : ids.join(','),
      cert: certs.join(','),
      due: dues.slice().sort()[0] || '',
    };
    liveKeys[g.key] = 1;
    const ov = STD_ROW_OV[g.key] || {};
    const pick = f => (ov[f] !== undefined ? ov[f] : auto[f]);
    return { key: g.key, _auto: auto, setIds: [reg.id_code], wids: ids.slice(), name: pick('name'), model: pick('model'),
      cls: pick('cls'), serial: pick('serial'), id_code: pick('id_code'), cert: pick('cert'), due: pick('due') };
  });
  Object.keys(STD_ROW_OV).forEach(k => { if (!liveKeys[k]) delete STD_ROW_OV[k]; });
}
function editStdCell(key, field, value) {
  (STD_ROW_OV[key] = STD_ROW_OV[key] || {})[field] = value;
  const row = CERT_STDS.find(r => r.key === key); if (row) row[field] = value;
}
// ครบกำหนด: แสดง dd/mm/yyyy แต่เก็บค่าจริงเป็น ISO (yyyy-mm-dd) เพื่อให้ปริ้นใบ cert format ถูก
function fmtDMY(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || ''); }
function parseDMY(s) { const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return m ? `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : null; }
function editStdDue(key, v) {
  const t = String(v || '').trim();
  if (!t) { editStdCell(key, 'due', ''); return; }
  const iso = parseDMY(t);
  if (iso) editStdCell(key, 'due', iso);
  else { alert('รูปแบบวันที่ต้องเป็น dd/mm/yyyy เช่น 06/01/2027'); renderStdTable(); }
}
function resetStdRow(key) { delete STD_ROW_OV[key]; deriveCertStds(); renderStdTable(); }
function removeStdGroup(key) {
  const row = CERT_STDS.find(r => r.key === key);
  const wids = row ? (row.wids || []) : [];
  AVAIL_WEIGHTS.forEach(w => { if (wids.indexOf(w.id_code) >= 0) w.checked = false; });   // ✕ = ไม่ใช้ลูกกลุ่มนี้ (เอาออกจาก cert)
  delete STD_ROW_OV[key];
  deriveCertStds(); assignWeights(); renderStdTable(); renderWeightPicker(); renderPointRows(); recalc();
}
function rebuildAvail() {
  const prev = {}; AVAIL_WEIGHTS.forEach(w => { prev[w.id_code] = w.checked; });
  AVAIL_WEIGHTS = [];
  SELECTED_SETS.forEach(sid => {
    const s = regGet(sid); if (!s) return;
    s.weights.forEach(w => AVAIL_WEIGHTS.push({ id_code:w.id_code, set_id:sid, nominal_g:w.nominal_g, marking:w.marking, corr_g:w.corr_g, U_mg:w.U_mg, Ds_mg:w.Ds_mg,
      due: w.due || s.due, serial: w.serial || s.serial || '', cert: w.cert || s.cert || '' }));
  });
  const today = new Date(); today.setHours(0,0,0,0);
  AVAIL_WEIGHTS.forEach(w => { w.in_date = !w.due || new Date(w.due+'T00:00:00') >= today; w.checked = (w.id_code in prev) ? (prev[w.id_code] && w.in_date) : w.in_date; });
  deriveCertStds();   // แถว cert ขึ้นกับลูกที่ติ๊ก → derive หลังตั้งสถานะ checked เสร็จ
}
function renderStdTable() {
  byId('stdRows').innerHTML = CERT_STDS.length ? CERT_STDS.map(s => {
    const ov = STD_ROW_OV[s.key] && Object.keys(STD_ROW_OV[s.key]).length;
    const k = _jsq(s.key);
    return `<tr>
    <td><input class="stdin" value="${_attr(s.cls)}" oninput="editStdCell('${k}','cls',this.value)"></td>
    <td><input class="stdin" value="${_attr(s.serial)}" oninput="editStdCell('${k}','serial',this.value)"></td>
    <td><input class="stdin mono" value="${_attr(s.id_code)}" oninput="editStdCell('${k}','id_code',this.value)"></td>
    <td><input class="stdin" value="${_attr(s.cert)}" oninput="editStdCell('${k}','cert',this.value)"></td>
    <td><input class="stdin" value="${_attr(fmtDMY(s.due))}" placeholder="dd/mm/yyyy" inputmode="numeric" onchange="editStdDue('${k}',this.value)"></td>
    <td class="num" style="white-space:nowrap">
      <button type="button" class="rmset" title="คืนค่าอัตโนมัติ" onclick="resetStdRow('${k}')" ${ov ? '' : 'style="opacity:.3"'}>↺</button>
      <button type="button" class="rmset" title="เอาแถวนี้ออก" onclick="removeStdGroup('${k}')">✕</button>
    </td>
  </tr>`; }).join('') : `<tr><td colspan="6" style="color:var(--muted);text-align:center;padding:10px">ยังไม่ได้เลือกชุดตุ้ม — เลือกจากดรอปดาวน์ด้านบน</td></tr>`;
  const opts = STD_REGISTRY.filter(s => !SELECTED_SETS.includes(s.id_code));
  byId('stdAdd').innerHTML = '<option value="">— เลือกชุดเพิ่ม —</option>' +
    opts.map(s => `<option value="${s.id_code}">${s.id_code} · ${s.cls} (${s.serial})</option>`).join('');
}
function addStdSet(id) { if (!id || SELECTED_SETS.includes(id)) return; SELECTED_SETS.push(id); refreshStds(); }
function removeStdSet(id) { SELECTED_SETS = SELECTED_SETS.filter(x => x !== id); refreshStds(); }
function refreshStds() { deriveStds(); rebuildAvail(); renderStdTable(); renderWeightPicker(); assignWeights(); renderPointRows(); recalc(); }
// หาชุดตุ้ม (ติ๊ก+in-date) ที่รวมได้พอดีกับค่าพิกัด — greedy ลูกใหญ่ก่อน (ใช้ได้กับชุดตุ้มมาตรฐาน 1·2·5)
function comboFor(nominal) {
  const target = Math.round(nominal * 1e6) / 1e6;
  if (!(target > 0)) return null;
  const avail = AVAIL_WEIGHTS.filter(w => w.checked && w.in_date).sort((a,b) => b.nominal_g - a.nominal_g);
  let remain = target; const used = [];
  for (const w of avail) {
    if (w.nominal_g <= remain + 1e-9) { used.push(w); remain = Math.round((remain - w.nominal_g) * 1e6) / 1e6; }
    if (remain <= 1e-9) break;
  }
  if (remain > 1e-9 || !used.length) return null;   // รวมไม่ได้พอดี
  return { ids: used.map(w => w.id_code), parts: used.map(w => w.nominal_g),
    corr: used.reduce((s,w) => s + w.corr_g, 0),
    U: +used.reduce((s,w) => s + w.U_mg, 0).toFixed(6),
    Ds: +used.reduce((s,w) => s + w.Ds_mg, 0).toFixed(6) };
}
// คำอธิบายตุ้มของจุด (กรัม): ลูกเดียว = เลข · รวมหลายลูก = total(parts)
function pointDesc(p) {
  const parts = (p.descParts && p.descParts.length) ? p.descParts : null;
  if (!parts) return String(p.nominal);
  if (parts.length === 1) return String(parts[0]);
  return parts.reduce((a,b) => a + b, 0) + '(' + parts.join('+') + ')';
}
// จับคู่ตุ้มเข้าจุดทดสอบ — Σ ค่าแก้/U/Dₛ ของลูกที่ใช้ · ทำไม่ได้พอดี → avail=false
function assignWeights() {
  POINTS.forEach(p => {
    const c = comboFor(p.nominal);
    if (c) { p.corr = c.corr; p.U = c.U; p.dsIn = c.Ds; p.usedIds = c.ids; p.descParts = c.parts; p.avail = true; }
    else { p.usedIds = []; p.descParts = null; p.avail = false; }   // คงค่าแก้/U ที่กรอกไว้
  });
}
// ชื่อชุดจากตาราง "รายการตุ้มน้ำหนักมาตรฐานที่ใช้" (STDS) ตาม id_code
function setLabel(setId) {
  const s = STDS.find(x => x.id_code === setId);
  return s ? (s.name + ' · ' + (s.cls || s.model || '')) : '—';
}
// หน่วยแสดงผลของลูกตุ้มจากค่ากรัม: <1g→mg · <1kg→g · ≥1kg→kg (+ rank สำหรับเรียง)
function fmtWeightUnit(g) {
  let unit, rank, val;
  if (g >= 1000) { unit = 'kg'; rank = 3; val = g / 1000; }
  else if (g >= 1) { unit = 'g'; rank = 2; val = g; }
  else { unit = 'mg'; rank = 1; val = g * 1000; }
  return { unit, rank, val: Math.round(val * 1e6) / 1e6 };
}
function renderWeightPicker() {
  const el = byId('weightPicker'); if (!el) return;
  const groups = {};
  AVAIL_WEIGHTS.forEach((w, i) => { (groups[w.set_id || '—'] = groups[w.set_id || '—'] || []).push(i); });
  el.innerHTML = Object.keys(groups).map(sid => {
    const idxs = groups[sid];
    const nChk = idxs.filter(i => AVAIL_WEIGHTS[i].checked).length;
    const items = idxs.map(i => ({ i, w: AVAIL_WEIGHTS[i], f: fmtWeightUnit(AVAIL_WEIGHTS[i].nominal_g) }))
      .sort((a, b) => a.f.rank - b.f.rank || a.f.val - b.f.val)   // เรียงตามหน่วย (mg→g→kg) แล้วค่อยตัวเลข
      .map(({ i, w, f }) => {
      const mk = (w.marking && w.marking !== 'none') ? `<sup style="color:#c0392b">${w.marking}</sup>` : '';
      const label = `${f.val}${mk} ${f.unit}`;
      return `<label class="wpick ${w.in_date?'':'dis'}">
        <input type="checkbox" ${w.checked?'checked':''} ${w.in_date?'':'disabled'} onchange="toggleWeight(${i})">
        <b>${label}</b><span class="wid">${w.id_code}</span>${w.in_date?'':'<span class="exp">หมดอายุ</span>'}
      </label>`;
    }).join('');
    return `<div class="wset">
      <div class="wset-head" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display==='none'?'block':'none'">
        <i class="ti ti-package"></i> <b>${sid}</b> <span class="wset-sub">${setLabel(sid)}</span>
        <span class="wset-cnt">เลือก ${nChk}/${idxs.length} ลูก</span>
        <button type="button" class="wset-rm" title="เอาชุดนี้ออกจากงาน (เพิ่มกลับได้จากดรอปดาวน์)" onclick="event.stopPropagation();removeStdSet('${_jsq(sid)}')">✕</button>
      </div>
      <div class="wset-body"><div class="wpick-grid">${items}</div></div>
    </div>`;
  }).join('');
}
function toggleWeight(i) {
  AVAIL_WEIGHTS[i].checked = !AVAIL_WEIGHTS[i].checked;
  deriveCertStds(); renderStdTable();   // ติ๊กเปลี่ยน → แถว cert (group ตาม serial ของลูกที่ติ๊ก) อัปเดต
  assignWeights(); renderPointRows(); renderWeightPicker(); recalc();
}

// ===== รับเครื่องมือที่เลือกจากรายการ/แผน (#inst=) → เติมหัวใบรับรอง =====
function readIncomingInst() {
  const m = location.hash.match(/inst=([^&]+)/);
  if (!m) return null;
  try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; }
}
function applyIncomingInst(inst) {
  if (!inst) return;
  const setv = (id,v) => { const el = byId(id); if (el && v != null && v !== '') el.value = v; };
  setv('eEquip', inst.name); setv('eEquipTh', inst.name_th); setv('eId', inst.id_code);
  setv('eAsset', inst.asset); setv('eMfr', inst.manufacturer); setv('eModel', inst.model);
  setv('eSerial', inst.serial); setv('iCap', inst.capacity); setv('iRes', inst.resolution);
  setv('eClass', inst.accuracy_class); setv('cClientName', inst.client); setv('cLocation', inst.location);
  setv('cSection', inst.section); setv('cUnitDept', inst.unit_dept); setv('iDateRecv', inst.date_recv);
  setv('eCalType', inst.cal_type);
  // Tolerance: ดึงจากช่อง Tolerance ของเครื่องในทะเบียน (ค่าเดียว เช่น "± 0.01 g") → ใช้เป็น band เดียวครอบทุกช่วง
  const tolM = String(inst.tolerance || '').match(/[\d.]+/);
  if (tolM) {
    const tolV = parseFloat(tolM[0]);
    const cap = parseFloat(inst.capacity) || parseFloat(val('iCap')) || 0;
    if (Number.isFinite(tolV) && tolV > 0) {
      TOLS = [{ from: 0, to: cap > 0 ? cap : 999999, tol: tolV }];
      renderTolRows();
    }
  }
  const b = byId('instBanner');
  if (b) {
    b.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;background:#e6f1fb;border:1px solid #b5d4f4;border-radius:8px;padding:8px 11px;font-size:12px;color:#185fa5;font-weight:700';
    b.innerHTML = `<i class="ti ti-arrow-down-circle"></i> เข้าสอบเทียบจาก${inst.from || 'รายการเครื่องมือ'}: <b>${inst.name || inst.id_code || ''}</b>${inst.id_code ? ' ('+inst.id_code+')' : ''}`;
  }
}

// ===== โหมดตรวจทาน (ขั้น 8): ล็อกข้อ 2–5 ไว้ตรวจ · ข้อ 1 แก้ได้ · ปุ่ม "แก้ไขข้อนี้" ปลดล็อกทีละข้อ =====
let REVIEW_MODE = false;
function ensureEditButtons() {
  [2,3,4,5].forEach(n => {
    const card = byId('st'+n); if (!card) return;
    const head = card.querySelector('.card-head');
    if (head && !head.querySelector('.editStepBtn')) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'editStepBtn'; b.setAttribute('onclick', 'editStep('+n+')');
      b.innerHTML = '<i class="ti ti-pencil"></i> แก้ไขข้อนี้';
      head.appendChild(b);
    }
  });
}
function setStepEditable(n, editable) {
  const card = byId('st'+n); if (!card) return;
  card.classList.toggle('locked', !editable);
  card.querySelectorAll('input,select,textarea').forEach(el => { el.disabled = !editable; });
  card.querySelectorAll('button').forEach(b => {
    if (!b.classList.contains('editStepBtn') && !b.classList.contains('btn-cert')) b.disabled = !editable;
  });
  const eb = card.querySelector('.editStepBtn');
  if (eb) eb.innerHTML = card.classList.contains('locked')
    ? '<i class="ti ti-pencil"></i> แก้ไขข้อนี้'
    : '<i class="ti ti-check"></i> เสร็จ (กลับไปตรวจ)';
}
function editStep(n) {                       // สลับล็อก↔ปลดล็อกข้อนั้น
  const card = byId('st'+n); if (!card) return;
  setStepEditable(n, card.classList.contains('locked'));
}
function switchMode(mode) {
  REVIEW_MODE = (mode === 'review');
  document.body.classList.toggle('review', REVIEW_MODE);
  byId('mEntry').classList.toggle('active', !REVIEW_MODE);
  byId('mReview').classList.toggle('active', REVIEW_MODE);
  setStepEditable(1, true);                  // ข้อ 1 แก้ได้เสมอ (ช่อง "ออกโดยระบบ" ยัง readonly)
  [2,3,4,5].forEach(n => setStepEditable(n, !REVIEW_MODE));
  const b = byId('reviewBanner');
  if (b) {
    b.style.display = REVIEW_MODE ? 'flex' : 'none';
    if (REVIEW_MODE) {
      b.style.cssText = 'display:flex;align-items:center;gap:8px;margin:10px 0 0;background:#fff8e1;border:1px solid #f2dcb0;border-radius:8px;padding:9px 12px;font-size:12px;color:#854f0b;font-weight:700';
      b.innerHTML = '<i class="ti ti-list-check"></i> โหมดตรวจทาน — ข้อ 2–5 ถูกล็อกไว้ให้ตรวจว่าถูกไหม · ข้อ 1 แก้ได้ · ถ้าผิดกด “แก้ไขข้อนี้” → แก้ → “เสร็จ” → แล้วกด “ออกใบรับรอง”';
    }
  }
  if (REVIEW_MODE) window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== สถานะใบ Cert (แนวทาง 1: ออกเลขตอน "สอบเสร็จ" → ปริ้น/เซ็นที่ออฟฟิศ) =====
// draft → issued(ออกเลข) → signed(เซ็น) → approved(สมบูรณ์) · voided(ยกเลิก-เก็บเลข) · revision
let CAL_STATE = 'draft', CERT_NO = '', CERT_REV = 0;
let CAL_REC_ID = null, CERT_YY = null, CERT_BASE = null, INST_PREV = null;   // record id + เลขรัน + ค่าทะเบียนเครื่องเดิม (เผื่อยกเลิก)
const CERT_TC = 'B';                                        // type code เครื่องชั่ง
const STATE_META = {
  draft:    { label: 'กำลังสอบเทียบ (ยังไม่ออกเลข)', cls: 'st-draft' },
  issued:   { label: 'ออกเลขแล้ว — รอปริ้น/เซ็น',     cls: 'st-issued' },
  signed:   { label: 'เซ็นแล้ว — รออนุมัติ',          cls: 'st-signed' },
  approved: { label: 'สมบูรณ์ (อนุมัติแล้ว)',         cls: 'st-approved' },
  voided:   { label: 'ยกเลิก (เก็บเลขไว้เป็นประวัติ)', cls: 'st-voided' },
};
const certNoStr = () => '' + CERT_YY + CERT_TC + String(CERT_BASE).padStart(3, '0') + '-' + CERT_REV;
const jobNoStr  = () => '' + CERT_YY + '/' + CERT_TC + String(CERT_BASE).padStart(3, '0');  // หมายเลขของงาน รูปแบบ "26/B318" (มี / คั่นปี) ตามฟอร์มต้นฉบับ Book1 — ต่างจาก cert_no "26B318-0"
const sbx = () => SBCAL || (typeof supabase !== 'undefined' ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null);
function renderCertBar() {
  const m = STATE_META[CAL_STATE];
  let a = '';
  if (CAL_STATE === 'draft')        a = `<button class="cbtn primary" onclick="issueCert()"><i class="ti ti-checks"></i> สอบเสร็จ → บันทึก + ออกเลข Cert</button>`;
  else if (CAL_STATE === 'issued')  a = `<button class="cbtn" onclick="printCert()"><i class="ti ti-printer"></i> ปริ้นเอกสาร</button><span style="font-size:12px;color:#7a8a87;align-self:center;margin-left:8px">ปริ้นไปเซ็น → แนบไฟล์สแกน + ทำให้สมบูรณ์ ที่หน้าประวัติเครื่อง</span>`;
  else if (CAL_STATE === 'signed')  a = `<button class="cbtn" onclick="printCert()"><i class="ti ti-printer"></i> ปริ้น</button>`;
  else if (CAL_STATE === 'approved')a = `<button class="cbtn" onclick="printCert()"><i class="ti ti-printer"></i> ปริ้นซ้ำ</button><button class="cbtn" onclick="reviseCert()"><i class="ti ti-versions"></i> ออก revision</button>`;
  if (CAL_STATE === 'issued' || CAL_STATE === 'signed' || CAL_STATE === 'approved')
    a += `<button class="cbtn danger" onclick="voidCert()"><i class="ti ti-ban"></i> ยกเลิกใบ</button>`;
  const html = `<div class="cbar-info"><span class="cbar-no">เลขที่ Cert: <b>${CERT_NO || '— ยังไม่ออกเลข —'}</b></span><span class="cbadge ${m.cls}">${m.label}</span></div>`
    + `<div class="cbar-actions">${a}</div>`;
  ['certStatusBar', 'certStatusBarBottom'].forEach(id => { if (byId(id)) byId(id).innerHTML = html; });
}
// สอบเสร็จ → ออกเลขจริงจาก cert_sequences (type B) + บันทึก calibration_records
let ISSUING = false;
async function issueCert() {
  if (CAL_STATE !== 'draft' || ISSUING) return;   // กันกดซ้ำระหว่างกำลังออกเลข (เคยกดรัวแล้วได้ใบ/เลขซ้ำ)
  if (!calDataReady()) {
    alert('⛔ ยังออกใบ Cert จริงไม่ได้ — ระบบกำลังใช้ข้อมูลตัวอย่าง (MOCK)\n'
      + (STD_IS_MOCK ? '• ตุ้มมาตรฐานยังไม่ถูกอนุมัติ — ไปอนุมัติที่หน้า “ใบ Cert Reference (ตุ้มมาตรฐาน)” ก่อน\n' : '')
      + (CMC_IS_MOCK ? '• ยังไม่มี CMC ที่รับรอง — กรอกที่แท็บ CMC ก่อน\n' : '')
      + '\nเมื่อข้อมูลครบแล้ว แถบเตือนสีแดงจะหายไปและกดสอบเสร็จได้');
    return;
  }
  if (CERT_STDS.length > 5) {
    alert('⛔ ตุ้มมาตรฐานมี ' + CERT_STDS.length + ' แถว แต่ใบรับรองรองรับสูงสุด 5 แถว\nกรุณารวม/ลบแถวในตาราง “รายการตุ้มน้ำหนักมาตรฐานที่ใช้” ให้เหลือไม่เกิน 5 ก่อนออกเลข');
    return;
  }
  const db = sbx();
  if (!db) { alert('เชื่อมต่อระบบไม่ได้ (Supabase) — ออกเลขไม่ได้'); return; }
  // ยืนยันก่อนออกเลข — ออกแล้วกินลำดับเลข กดซ้ำไม่ได้
  const _eqName = val('eEquipTh') || val('eEquip') || 'เครื่องชั่ง';
  if (!confirm('ยืนยัน "สอบเสร็จ" — ออกเลข Cert + บันทึกผล?\n\nเครื่อง: ' + _eqName
    + '\nจุดทดสอบ: ' + POINTS.length + ' จุด · ตุ้มมาตรฐาน: ' + CERT_STDS.length + ' แถว'
    + '\n\n⚠ เลขใบรับรองจะถูกออกและกินลำดับถัดไป — ออกแล้วกดซ้ำไม่ได้')) return;
  ISSUING = true;
  const _issueBtns = [...document.querySelectorAll('.cbtn.primary')];
  _issueBtns.forEach(b => { b.disabled = true; b.style.opacity = '0.6'; b.style.cursor = 'wait'; });
  const calDate = val('iDate') || new Date().toISOString().slice(0, 10);
  CERT_YY = new Date(calDate + 'T00:00:00').getFullYear() % 100;
  const numf = id => { const v = parseFloat(val(id)); return Number.isFinite(v) ? v : null; };
  let seqId = null, newNumber = null;
  try {
    // 1) รันเลข cert_sequences (year_code + type_code=B)
    const { data: seq, error: selErr } = await db.from('cert_sequences')
      .select('id,last_number').eq('year_code', CERT_YY).eq('type_code', CERT_TC).maybeSingle();
    if (selErr) throw selErr;
    if (!seq) {
      const { data: ins, error } = await db.from('cert_sequences')
        .insert({ year_code: CERT_YY, type_code: CERT_TC, last_number: 1 }).select('id').single();
      if (error) throw error;
      newNumber = 1; seqId = ins.id;
    } else {
      newNumber = seq.last_number + 1; seqId = seq.id;
      const { error } = await db.from('cert_sequences').update({ last_number: newNumber, updated_at: new Date().toISOString() }).eq('id', seqId);
      if (error) throw error;
    }
    CERT_BASE = newNumber; CERT_REV = 0; CERT_NO = certNoStr();
    // เติมเลข Cert/Job/วันที่ออก ลงฟอร์ม "ก่อน" buildCAL → data.cert_no/job_no/date_issue ไม่ว่าง (ใช้ตอนปริ้น/ปริ้นย้อนหลัง)
    if (byId('fCertNo')) byId('fCertNo').value = CERT_NO;
    if (byId('fJobNo')) byId('fJobNo').value = jobNoStr();
    if (byId('fDateIssue')) byId('fDateIssue').value = new Date().toISOString().slice(0, 10);
    // 2) บันทึกผลดิบ + CAL object ลง calibration_records
    const rec = {
      instrument_id: (INCOMING_INST && INCOMING_INST.instrument_id) || null,
      cert_no: CERT_NO, job_no: jobNoStr(), request_no: val('fReqNo') || null,
      status: 'issued', revision: CERT_REV,
      cal_date: calDate, date_recv: val('iDateRecv') || null, due_date: val('iDateNext') || null,
      calibrated_by: val('fCalBy') || null, location: val('cLocation') || null, procedure: val('fProcedure') || null,
      capacity: numf('iCap'), resolution: numf('iRes'), accuracy_class: val('eClass') || null,
      adjusted: val('eAdjusted') || null, condition: val('eCondition') || null,
      ab_ppm: numf('abMaterial') || 1, pan: parseInt(val('eccPan'), 10) || 0,
      data: buildCAL(),
    };
    const { data: recIns, error: recErr } = await db.from('calibration_records').insert(rec).select('id').single();
    if (recErr) { if (seqId) await db.from('cert_sequences').update({ last_number: newNumber - 1 }).eq('id', seqId); throw recErr; }
    CAL_REC_ID = recIns.id; CAL_STATE = 'issued';
    // 3) อัปเดตทะเบียนเครื่องมือ (instruments) ให้สะท้อนการสอบเทียบล่าสุด — เก็บค่าเดิมไว้เผื่อยกเลิก
    let instNote = '';
    if (INCOMING_INST && INCOMING_INST.instrument_id) {
      try {
        const { data: cur } = await db.from('instruments').select('cert_no,cal_date,due_date,job_no,request_no,brand,model,serial_no,id_code,range_val,capacity,resolution,accuracy_class,asset_no,cal_type').eq('id', INCOMING_INST.instrument_id).single();
        INST_PREV = cur || null;
        const { error: iErr } = await db.from('instruments').update({
          cert_no: CERT_NO, cal_date: calDate, due_date: val('iDateNext') || null,
          job_no: jobNoStr(), request_no: val('fReqNo') || null,
          // sync ข้อมูลเครื่องที่อาจแก้หน้างาน → ทะเบียนเครื่องหลักตรงกับใบ cert ล่าสุด
          brand: val('eMfr') || null, model: val('eModel') || null, serial_no: val('eSerial') || null,
          id_code: val('eId') || null, range_val: val('eUserRange') || null,
          capacity: numf('iCap'), resolution: numf('iRes'), accuracy_class: val('eClass') || null,
          asset_no: val('eAsset') || null, cal_type: val('eCalType') || null,
        }).eq('id', INCOMING_INST.instrument_id);
        if (iErr) instNote = '\n⚠ ทะเบียนเครื่องไม่อัปเดต: ' + iErr.message;
      } catch (e) { instNote = '\n⚠ อัปเดตทะเบียนเครื่องไม่ได้: ' + (e && e.message); }
    }
    renderCertBar();
    alert('✅ สอบเสร็จ — ออกเลข Cert: ' + CERT_NO + '\nบันทึกผล + อัปเดตทะเบียนเครื่องแล้ว (โปรดรีเฟรชหน้าหลักเพื่อดูข้อมูลเครื่องที่อัปเดต)' + instNote);
    switchMode('review');
  } catch (e) {
    alert('ออกเลข/บันทึกไม่สำเร็จ: ' + (e && e.message ? e.message : e));
  } finally {
    ISSUING = false;
    _issueBtns.forEach(b => { b.disabled = false; b.style.opacity = ''; b.style.cursor = ''; });
  }
}
async function setRecStatus(status) {
  if (!CAL_REC_ID) return;
  const db = sbx(); if (!db) return;
  try { await db.from('calibration_records').update({ status, revision: CERT_REV, cert_no: CERT_NO, updated_at: new Date().toISOString() }).eq('id', CAL_REC_ID); } catch (e) {}
}
async function markSigned()  { if (CAL_STATE !== 'issued') return; if (!confirm('ยืนยันลงนามใบ ' + CERT_NO + ' ?')) return; CAL_STATE = 'signed';   renderCertBar(); await setRecStatus('signed'); }
async function approveCert() { if (CAL_STATE !== 'signed') return; if (!confirm('ยืนยันอนุมัติใบ ' + CERT_NO + ' (ทำให้สมบูรณ์) ?')) return; CAL_STATE = 'approved'; renderCertBar(); await setRecStatus('approved'); }
async function voidCert() {
  if (!confirm('ยกเลิกใบ ' + CERT_NO + ' ?\nเลขจะถูกเก็บไว้เป็นประวัติ (ไม่ออกซ้ำ) · ทะเบียนเครื่องจะคืนเป็นใบก่อนหน้า')) return;
  CAL_STATE = 'voided'; renderCertBar(); await setRecStatus('voided');
  if (INCOMING_INST && INCOMING_INST.instrument_id && INST_PREV) {
    const db = sbx(); if (db) { try { await db.from('instruments').update(INST_PREV).eq('id', INCOMING_INST.instrument_id); } catch (e) {} }
  }
}
async function reviseCert() {
  if (CAL_STATE !== 'approved') return;
  if (!confirm('ออก revision ใหม่ของใบ ' + CERT_NO + ' ?\n(ไม่กินเลขใหม่ — เพิ่มเลขแก้ไข แล้วกลับไปสถานะรอเซ็น)')) return;
  CERT_REV++; CERT_NO = certNoStr(); CAL_STATE = 'issued';
  if (byId('fCertNo')) byId('fCertNo').value = CERT_NO;
  renderCertBar(); await setRecStatus('issued');
  if (INCOMING_INST && INCOMING_INST.instrument_id) { const db = sbx(); if (db) { try { await db.from('instruments').update({ cert_no: CERT_NO }).eq('id', INCOMING_INST.instrument_id); } catch (e) {} } }
  alert('ออก revision: ' + CERT_NO + ' (ไม่กินเลขใหม่ — แค่เพิ่มเลขแก้ไข)');
}
function printCert() {
  if (CAL_STATE === 'draft') { alert('ต้องกด "สอบเสร็จ → ออกเลข Cert" ก่อนจึงจะปริ้นได้'); return; }
  switchMode('review'); openCert();
}

// ===== สถานะข้อมูลจริง vs MOCK — กันออกใบจริงด้วยข้อมูลตัวอย่าง =====
let STD_IS_MOCK = true, CMC_IS_MOCK = true;
function calDataReady() { return !STD_IS_MOCK && !CMC_IS_MOCK; }
function renderStdBanner() {
  const b = byId('stdBanner'); if (!b) return;
  if (calDataReady()) {
    b.style.cssText = 'display:block;margin-bottom:10px;background:#e1f5ee;border:1px solid #b6e6d6;border-radius:8px;padding:8px 10px;font-size:12px;color:#0f6e56';
    b.innerHTML = '<i class="ti ti-database"></i> ข้อมูลจริงพร้อมใช้ — ตุ้มที่อนุมัติ ' + STD_REGISTRY.length + ' ชุด · CMC ' + cmcRowsActive().length + ' แถว';
  } else {
    const miss = [];
    if (STD_IS_MOCK) miss.push('ตุ้มมาตรฐานยังไม่ถูกอนุมัติ (อนุมัติที่หน้า “ใบ Cert Reference (ตุ้มมาตรฐาน)” ก่อน)');
    if (CMC_IS_MOCK) miss.push('ยังไม่มี CMC ที่รับรอง (กรอกที่แท็บ CMC)');
    b.style.cssText = 'display:block;margin-bottom:10px;background:#fdecec;border:1.5px solid #e7a3a3;border-radius:8px;padding:10px 12px;font-size:12.5px;color:#b3261e;font-weight:700';
    b.innerHTML = '⛔ ยังใช้งานจริงไม่ได้ — กำลังใช้ข้อมูลตัวอย่าง (MOCK): ค่าที่คำนวณไม่ใช่ของจริง และออกใบ Cert จริงไม่ได้'
      + '<div style="font-weight:400;margin-top:4px">ต้องแก้ก่อน: ' + miss.join(' · ') + '</div>';
  }
}

// ===== prefill จุด+ตุ้มจากการสอบครั้งก่อนของเครื่องนี้ =====
let PREFILL_REC = null;
// คืนค่าการเลือกตุ้มจาก snapshot {sets, checked, std_ov} → ตั้ง SELECTED_SETS + ติ๊กลูก (ข้ามหมดอายุ) + re-derive/render ตาราง cert + picker
// ใช้ร่วมกัน 3 ทาง: เปิดดูใบ (#rec) · prefill ครั้งก่อน · เลือกพรีเซ็ท — ก่อนหน้านี้ copy ไว้ 3 ที่ ทำให้บั๊ก "ตารางไม่ตรง picker" ต้องไล่แก้ทุกที่
function restoreSelection(snap, fallbackSets) {
  snap = snap || {};
  let setIds = (Array.isArray(snap.sets) && snap.sets.length) ? snap.sets.slice() : (fallbackSets || []);
  setIds = setIds.map(c => String(c).trim()).filter(c => c && regGet(c));
  if (setIds.length) SELECTED_SETS = setIds;
  if (snap.std_ov && typeof snap.std_ov === 'object') { try { STD_ROW_OV = JSON.parse(JSON.stringify(snap.std_ov)); } catch (e) {} }
  deriveStds(); rebuildAvail();
  if (Array.isArray(snap.checked)) {
    const set = {}; snap.checked.forEach(c => { set[c] = 1; });
    AVAIL_WEIGHTS.forEach(w => { w.checked = !!set[w.id_code] && w.in_date; });   // ลูกที่หมดอายุติ๊กไม่ได้
  }
  deriveCertStds(); renderStdTable(); renderWeightPicker();
}
async function loadLastCalForPrefill() {
  if (INCOMING_STD) return;                       // มาทาง #std= → ไม่ prefill
  const id = INCOMING_INST && INCOMING_INST.instrument_id;
  if (!id || !SBCAL) return;
  try {
    const { data, error } = await SBCAL.from('calibration_records')
      .select('cert_no,cal_date,data').eq('instrument_id', id)
      .order('cal_date', { ascending: false }).order('created_at', { ascending: false }).limit(1);
    if (error || !data || !data.length) return;
    const rec = data[0], cal = rec.data || {};
    const pts = Array.isArray(cal.points) ? cal.points.filter(p => Number.isFinite(Number(p.nominal))) : [];
    if (!pts.length) return;
    POINTS = pts.map(p => ({ nominal: Number(p.nominal), corr: 0, U: 0 }));
    const snap = cal.sel_snapshot || {};
    // ชุดที่เลือก: snapshot ถ้ามี · ไม่งั้น fallback จาก standards (รองรับ id_code ที่ join ด้วย comma)
    const fb = Array.isArray(cal.standards) ? cal.standards.flatMap(s => String(s.id_code || '').split(',')) : [];
    restoreSelection(snap, fb);
    PREFILL_REC = { cert_no: rec.cert_no, cal_date: rec.cal_date };
    assignWeights(); rebuildPoints(true); recalc();
    renderPrefillBanner();
  } catch (e) { console.warn('prefill:', e && e.message); }
}
// ===== เปิดดูรายละเอียดใบที่ออกแล้ว (#rec=<id>) → เติมฟอร์มเต็ม + โหมดตรวจทาน =====
function readIncomingRec() {
  const m = location.hash.match(/rec=([^&]+)/);
  if (!m) return null;
  const id = decodeURIComponent(m[1]).trim();
  return id || null;
}
// เติมทุกฟิลด์จาก CAL object (inverse ของ buildCAL) — ค่าแก้/U คำนวณใหม่จากค่าอ่าน+ตุ้มที่คืนค่า
function fillFromCAL(cal) {
  const setv = (id, v) => { const el = byId(id); if (el && v != null && v !== '') el.value = v; };
  const setList = (cls, arr) => { const els = [...document.querySelectorAll(cls)]; (arr || []).forEach((v, i) => { if (els[i] && v != null) els[i].value = v; }); };
  setv('cClientName', cal.client && cal.client.name);
  if (cal.client && Array.isArray(cal.client.addr)) { const a = byId('cAddr'); if (a) a.value = cal.client.addr.join('\n'); }
  setv('eEquip', cal.equipment); setv('eEquipTh', cal.equipment_th);
  setv('iCap', cal.capacity); setv('iRes', cal.resolution);
  setv('eMfr', cal.manufacturer); setv('eModel', cal.model); setv('eSerial', cal.serial);
  setv('eId', cal.id_no); setv('eAsset', cal.asset); setv('eClass', cal.accuracy_class);
  setv('eCondition', cal.condition); setv('eAdjusted', cal.adjusted); setv('eUserRange', cal.user_range); setv('eCalType', cal.cal_type);
  setv('cLocation', cal.location); setv('cSection', cal.section); setv('cUnitDept', cal.unit_dept);
  setv('iDateRecv', cal.date_receive); setv('iDate', cal.date_cal); setv('iDateNext', cal.date_next);
  setv('fDateIssue', cal.date_issue); setv('fCalBy', cal.calibrated_by); setv('fProcedure', cal.procedure);
  setv('fCertNo', cal.cert_no); setv('fJobNo', cal.job_no); setv('fReqNo', cal.request_no);
  if (cal.ab_ppm != null) setv('abMaterial', cal.ab_ppm);
  if (cal.signers) { setv('sTechMgr', cal.signers.tech_mgr); setv('sDirector', cal.signers.director); setv('sApprover', cal.signers.approver); }
  setList('.tIn', cal.temp); setList('.rhIn', cal.rh); setList('.wuIn', cal.warmup); setList('.ctIn', cal.cal_time);
  if (Array.isArray(cal.tols) && cal.tols.length) TOLS = cal.tols.map(t => ({ from: Number(t.from), to: Number(t.to), tol: Number(t.tol) }));
  if (Array.isArray(cal.points) && cal.points.length) POINTS = cal.points.map(p => ({ nominal: Number(p.nominal), corr: 0, U: 0 }));
  // REP_READS/PL_READS/ECC/TARE เป็น const (โครงสร้าง default) — ค่าจริงอยู่ใน input · เขียนทับ input หลัง buildStatic
  setv('repPoint', cal.repeat && cal.repeat.point);
  setv('plPoint', cal.preload && cal.preload.point);
  setv('eccWt', cal.ecc && cal.ecc.wt);
  setv('tareWt', cal.tare && cal.tare.wt);
  buildStatic();   // render ตารางตามโครงสร้าง (ค่าอ่าน default) → แล้วเขียนทับด้วยค่าจาก record
  if (cal.ecc && cal.ecc.pan != null) setv('eccPan', cal.ecc.pan);
  const setInputs = (cls, arr) => { const els = [...document.querySelectorAll(cls)]; (arr || []).forEach((v, i) => { if (els[i] && v != null) els[i].value = v; }); };
  setInputs('.repIn', cal.repeat && cal.repeat.reads);
  setInputs('.plIn', cal.preload && cal.preload.reads);
  setInputs('.eccIn', cal.ecc && cal.ecc.reads);
  setInputs('.tareIn', (cal.tare && Array.isArray(cal.tare.checks)) ? cal.tare.checks.map(c => c[1]) : null);
  (cal.points || []).forEach((p, i) => (p.reads || []).forEach((rv, j) => {
    const el = document.querySelector(`.errIn[data-p="${i}"][data-r="${j}"]`); if (el && rv != null) el.value = rv;
  }));
  assignWeights(); renderPointRows(); drawPanPrev(); recalc();
}
async function loadRecForReview(recId) {
  if (!recId || !SBCAL) return;
  let rec;
  try {
    const { data, error } = await SBCAL.from('calibration_records')
      .select('id,cert_no,job_no,status,revision,instrument_id,data').eq('id', recId).single();
    if (error || !data) throw (error || new Error('not found'));
    rec = data;
  } catch (e) { console.warn('loadRec:', e && e.message); return; }
  const cal = rec.data || {};
  // คืนค่าชุดตุ้ม/ลูกที่ติ๊ก/override ก่อน (ให้ recalc คำนวณค่าแก้/U ตามเดิม)
  const snap = cal.sel_snapshot || {};
  const fb = Array.isArray(cal.standards) ? cal.standards.flatMap(s => String(s.id_code || '').split(',')) : [];
  restoreSelection(snap, fb);
  fillFromCAL(cal);
  // เลข Cert/งาน จาก record column (เผื่อ data เก่าไม่มี) → เขียนทับช่อง
  if (rec.cert_no) { const fc = byId('fCertNo'); if (fc) fc.value = rec.cert_no; }
  if (rec.job_no) { const fj = byId('fJobNo'); if (fj) fj.value = rec.job_no; }
  // สถานะ/เลข Cert จริง → cert bar + ปุ่ม (ปริ้น/ยกเลิก/revision)
  CAL_REC_ID = rec.id; CERT_NO = rec.cert_no || cal.cert_no || ''; CERT_REV = Number(rec.revision) || 0; CAL_STATE = rec.status || 'issued';
  const mm = String(CERT_NO).match(/^(\d+)([A-Z])(\d+)-(\d+)/);
  if (mm) { CERT_YY = Number(mm[1]); CERT_BASE = Number(mm[3]); }
  renderCertBar();
  switchMode('review');
  const ib = byId('instBanner');
  if (ib) {
    ib.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;background:#eef4fb;border:1px solid #b9d4ee;border-radius:8px;padding:8px 11px;font-size:12px;color:#1565c0;font-weight:700';
    ib.innerHTML = `<i class="ti ti-eye"></i> ดูรายละเอียดใบที่ออกแล้ว: <b>${CERT_NO || '–'}</b> — โหมดตรวจทาน (อ่านอย่างเดียว)`;
  }
}
function renderPrefillBanner() {
  const b = byId('prefillBanner'); if (!b) return;
  if (!PREFILL_REC) { b.style.display = 'none'; return; }
  b.style.cssText = 'display:block;margin-bottom:10px;background:#eef4fb;border:1px solid #b9d4ee;border-radius:8px;padding:8px 10px;font-size:12px;color:#1565c0';
  b.innerHTML = '↻ ใช้จุดสอบ + ชุดตุ้ม + ลูกที่ติ๊ก จากการสอบครั้งก่อน (Cert ' + (PREFILL_REC.cert_no || '–') + ' · ' + (PREFILL_REC.cal_date || '') + ') '
    + '<a onclick="resetPrefill()" style="cursor:pointer;text-decoration:underline;color:#b3261e;margin-left:6px">เริ่มใหม่</a>';
}
function resetPrefill() {
  PREFILL_REC = null;
  const cap = (INCOMING_INST && INCOMING_INST.capacity) || parseFloat(val('iCap'));
  if (Number.isFinite(cap) && cap > 0) { const step = cap / 10; POINTS = []; for (let k = 1; k <= 10; k++) POINTS.push({ nominal: +(step * k).toFixed(3), corr: 0, U: 0 }); }
  if (STD_REGISTRY.length) SELECTED_SETS = [STD_REGISTRY[0].id_code];
  deriveStds(); rebuildAvail(); assignWeights(); rebuildPoints(true); renderStdTable(); renderWeightPicker(); recalc();
  renderPrefillBanner();
}

// ===== พรีเซ็ทจุดสอบกลาง (cal_point_presets) =====
let CAL_PRESETS = [];
function renderPresetPick() {
  const sel = byId('presetPick'), wrap = byId('presetPickWrap');
  if (!sel || !wrap) return;
  if (!CAL_PRESETS.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';
  sel.innerHTML = '<option value="">— เลือกพรีเซ็ทจุด —</option>'
    + CAL_PRESETS.map((p, i) => `<option value="${i}">${String(p.name || '').replace(/</g, '&lt;')} (${Array.isArray(p.points) ? p.points.length : 0} จุด)</option>`).join('');
}
function applyPresetPick(idx) {
  const p = CAL_PRESETS[Number(idx)];
  if (!p || !Array.isArray(p.points) || !p.points.length) return;
  POINTS = p.points.map(n => ({ nominal: Number(n), corr: 0, U: 0 }));
  // ถ้าพรีเซ็ทเก็บการเลือกตุ้มไว้ → คืนชุด + ลูกที่ติ๊ก + override (ลูกหมดอายุข้ามให้)
  if (p.weights && Array.isArray(p.weights.sets) && p.weights.sets.length) restoreSelection(p.weights);
  PREFILL_REC = null; renderPrefillBanner();
  rebuildPoints(true);
}
function presetForCapacity(cap) {
  const c = Number(cap);
  if (!Number.isFinite(c)) return null;
  return CAL_PRESETS.find(p => {
    const lo = p.capacity_from == null ? -Infinity : Number(p.capacity_from);
    const hi = p.capacity_to == null ? Infinity : Number(p.capacity_to);
    return c > lo && c <= hi && Array.isArray(p.points) && p.points.length;
  }) || null;
}
// ===== บันทึกจุดทดสอบที่จัดไว้ตอนนี้ → พรีเซ็ทใหม่ (เฉพาะ admin/editor · ช่วงพิกัด auto = 0–พิกัดเครื่อง) =====
let CAL_USER = null;
try { CAL_USER = JSON.parse(localStorage.getItem('cal_session') || 'null'); } catch (e) {}
const CAN_EDIT_PRESETS = !!(CAL_USER && (CAL_USER.role === 'admin' || CAL_USER.role === 'editor'));
let SAVING_PRESET = false;
async function saveCurrentAsPreset() {
  if (SAVING_PRESET) return;   // กันกดซ้ำระหว่างกำลังบันทึก
  if (!CAN_EDIT_PRESETS) { alert('เฉพาะ admin/editor เท่านั้นที่บันทึกพรีเซ็ทได้'); return; }
  const db = sbx(); if (!db) { alert('ยังเชื่อมต่อฐานข้อมูลไม่ได้ — ลองรีเฟรช'); return; }
  const points = POINTS.map(p => Number(p.nominal)).filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!points.length) { alert('ยังไม่มีจุดทดสอบให้บันทึก — จัดจุดก่อน'); return; }
  const cap = numf('iCap');
  const defName = 'เครื่องชั่ง ' + (cap ? cap + ' g' : points[points.length - 1] + ' g');
  const name = (prompt('ตั้งชื่อพรีเซ็ท:', defName) || '').trim();
  if (!name) return;
  SAVING_PRESET = true;
  // เก็บการเลือกตุ้มไปด้วย (ชุด + ลูกที่ติ๊ก + override) → คืนได้ครบตอนเลือกพรีเซ็ท
  const weights = { sets: SELECTED_SETS.slice(),
    checked: AVAIL_WEIGHTS.filter(w => w.checked).map(w => w.id_code), std_ov: STD_ROW_OV };
  const btn = byId('savePresetBtn'), orig = btn ? btn.innerHTML : '';
  const revert = () => { if (btn) { btn.innerHTML = orig; btn.style.background = ''; btn.style.borderColor = ''; btn.style.color = ''; btn.disabled = false; } };
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="ti ti-loader-2"></i> กำลังบันทึก…'; }
  try {
    const { error } = await db.from('cal_point_presets').insert({
      name, capacity_from: 0, capacity_to: cap || null, points, unit: 'g', weights, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    const { data } = await db.from('cal_point_presets').select('*').order('capacity_from', { nullsFirst: true });
    CAL_PRESETS = data || []; renderPresetPick();
    const idx = CAL_PRESETS.findIndex(p => p.name === name);
    if (idx >= 0 && byId('presetPick')) byId('presetPick').value = String(idx);
    if (btn) { btn.innerHTML = '<i class="ti ti-check"></i> ✓ บันทึกแล้ว: ' + name; btn.style.background = '#e3f5e8'; btn.style.borderColor = '#16784a'; btn.style.color = '#12633f'; }
    setTimeout(revert, 2800);   // โชว์สถานะเขียวค้างให้เห็นชัด แล้วค่อยกลับเป็นปุ่มเดิม
    alert('✅ บันทึกพรีเซ็ท "' + name + '" แล้ว (' + points.length + ' จุด · ' + weights.checked.length + ' ลูก) — เลือกใช้ซ้ำได้จากดรอปดาวน์ "พรีเซ็ทจุดสอบ" และหน้า "พรีเซ็ทจุด"');
  } catch (e) {
    revert();
    alert('❌ บันทึกพรีเซ็ทไม่ได้: ' + (e && e.message ? e.message : e));
  } finally { SAVING_PRESET = false; }
}

const INCOMING_STD = readIncomingStd();
const INCOMING_INST = readIncomingInst();
const INCOMING_REC = readIncomingRec();   // #rec=<id> → เปิดดูรายละเอียดใบที่ออกแล้ว (โหมดตรวจทาน)
applyIncomingStd(INCOMING_STD);   // อาจตั้ง SELECTED_SETS + เพิ่มชุดเข้าทะเบียน + banner
if (INCOMING_STD) STD_IS_MOCK = false;   // ส่งชุดจริงมาจากทะเบียนใบ Cert
deriveStds();
rebuildAvail();
assignWeights();
buildStatic();                    // renders STDS (renderStdTable) + points (renderPointRows)
applyIncomingInst(INCOMING_INST);
if (INCOMING_INST && INCOMING_INST.capacity) genPoints(INCOMING_INST.capacity);   // มาจากรายการ → จุด = พิกัด÷10
renderWeightPicker();
drawPanPrev();
ensureEditButtons();
if (CAN_EDIT_PRESETS) { const _sp = byId('savePresetBtn'); if (_sp) _sp.style.display = ''; }
renderCertBar();
recalc();
renderStdBanner();   // เริ่มต้นเป็นแดง (mock) จนกว่า loadFromDB จะยืนยันข้อมูลจริง
// ฟิลด์ที่กระทบการคำนวณ/วันที่ — อัปเดตสดเมื่อพิมพ์
['iRes','iDate'].forEach(id => {
  const el = byId(id); if (el) el.addEventListener('input', recalc);
});
// แตะช่องตัวเลข (editable) → เลือกค่าเดิมทั้งหมด พิมพ์ใหม่ทับทันที (กรอกเร็วบน tablet ไม่ต้องเลื่อน/ลบ)
document.addEventListener('focusin', e => {
  const el = e.target;
  if (el && el.tagName === 'INPUT' && el.type === 'number' && !el.readOnly && !el.disabled) {
    setTimeout(() => { try { el.select(); } catch (_) {} }, 0);
  }
});

// ===== ต่อระบบจริง: โหลดชุดตุ้ม (standard_weights) + CMC (cmc_set/cmc_row) จาก Supabase =====
// SUPABASE_URL / SUPABASE_KEY มาจาก js/00-config.js (โหลดใน <head> ก่อน script นี้)
let SBCAL = null;
const _mgF = u => ({ mg:1, g:1000, kg:1e6 }[u] || 1);     // หน่วย → mg
const _gF  = u => ({ mg:0.001, g:1, kg:1000 }[u] || 1);   // หน่วย → g
async function loadFromDB() {
  if (typeof supabase === 'undefined') return;
  try { SBCAL = supabase.createClient(SUPABASE_URL, SUPABASE_KEY); } catch (e) { return; }
  try {
    const [wRes, setRes] = await Promise.all([
      SBCAL.from('standard_weights').select('*').eq('status', 'approved').order('set_code').order('nominal_value'),
      SBCAL.from('cmc_set').select('*').eq('parameter', 'Electronic balance').eq('is_active', true).order('lab_status'),
    ]);
    const aw = wRes.data || [];   // ตุ้มที่อนุมัติแล้ว

    // STD_REGISTRY จากตุ้มที่อนุมัติแล้ว จัดกลุ่มตามชุด (drift = ค่าแก้ปัจจุบัน vs ครั้งก่อน inline) — ข้ามถ้ามาทาง #std=
    if (!INCOMING_STD && aw.length) {
      const groups = {};
      aw.forEach(w => { const k = w.set_code || ('ID:' + (w.id_code || '')); (groups[k] = groups[k] || []).push(w); });
      const reg = Object.keys(groups).map(set => {
        const ws = groups[set];
        const weights = ws.map(w => {
          const U = Number(w.uncertainty) || 0;
          let Ds = U;
          if (w.correction != null && w.prev_correction != null) Ds = Math.max(U, Math.abs(Number(w.correction) - Number(w.prev_correction)) * 1000);
          return { id_code: w.id_code || (set + '·' + w.nominal_value + w.unit), marking: w.marking || 'none',
            nominal_g: Number(w.nominal_value) * _gF(w.unit),
            corr_g: Number(w.correction) || 0, U_mg: U, Ds_mg: Ds,
            serial: w.serial_no || '', cert: w.cert_no || '', due: w.due_date || '' };
        });
        return { id_code: set, name: 'WEIGHT SET', model: ws[0].model || (ws[0].class_grade ? 'CLASS ' + ws[0].class_grade : ''),
          cls: ws[0].class_grade || '', serial: ws[0].serial_no || '', cert: ws[0].cert_no || '', due: ws[0].due_date || '', weights };
      });
      if (reg.length) { STD_REGISTRY.length = 0; reg.forEach(r => STD_REGISTRY.push(r)); SELECTED_SETS = [reg[0].id_code]; STD_IS_MOCK = false; }
    }

    // CMC จากฐาน: เลือกชุด balance ที่ active (default Permanent) แล้วโหลดแถว
    CMC_SETS = setRes.data || [];
    if (CMC_SETS.length) {
      if (!CMC_SET_SEL || !CMC_SETS.some(s => s.id === CMC_SET_SEL)) { const perm = CMC_SETS.find(s => s.lab_status === 'Permanent'); CMC_SET_SEL = (perm || CMC_SETS[0]).id; }
      const sel = CMC_SETS.find(s => s.id === CMC_SET_SEL) || CMC_SETS[0];
      CMC_SET_SEL = sel.id; CMC_KIND = sel.value_kind || 'range';
      const { data: rws } = await SBCAL.from('cmc_row').select('*').eq('set_id', sel.id).order('seq');
      CMC_ROWS = (rws || []).map(r => ({ from_g: Number(r.from_g), to_g: r.to_g === null ? null : Number(r.to_g), low_inc: !!r.low_inc, cmc_mg: Number(r.cmc_mg) }));
      CMC_IS_MOCK = CMC_ROWS.length === 0;
    } else { CMC_IS_MOCK = true; }
    renderCmcSetDropdown();

    deriveStds(); rebuildAvail(); assignWeights(); renderStdTable(); renderWeightPicker(); recalc();
    renderStdBanner();
    try {
      const { data: presetRes } = await SBCAL.from('cal_point_presets').select('*').order('capacity_from', { nullsFirst: true });
      CAL_PRESETS = presetRes || []; renderPresetPick();
    } catch (e) {}
    if (INCOMING_REC) {
      await loadRecForReview(INCOMING_REC);   // เปิดดูใบที่ออกแล้ว → เติมฟอร์ม + โหมดตรวจทาน (ข้าม prefill/preset)
    } else {
      await loadLastCalForPrefill();
      if (!INCOMING_STD && !PREFILL_REC) {
        const cap = (INCOMING_INST && INCOMING_INST.capacity) || parseFloat(val('iCap'));
        const pm = presetForCapacity(cap);
        if (pm) {
          POINTS = pm.points.map(n => ({ nominal: Number(n), corr: 0, U: 0 }));
          rebuildPoints(true);
          const sel = byId('presetPick'); if (sel) sel.value = String(CAL_PRESETS.indexOf(pm));
        }
      }
    }
  } catch (e) { console.warn('loadFromDB:', e && e.message); }   // ผิดพลาด → คงค่า mock
}
loadFromDB();
