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
