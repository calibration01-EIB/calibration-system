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
