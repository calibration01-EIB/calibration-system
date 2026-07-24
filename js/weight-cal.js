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
