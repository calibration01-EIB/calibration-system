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
