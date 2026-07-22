// ====================================================
// FRM CROSS-MONTH RANGE — ลากช่วงวันข้ามเดือนถัดไปในตาราง FRM editor
// pure helpers (ไม่แตะ Supabase) อยู่บนสุด, async orchestration (เรียก sb) อยู่ท้ายไฟล์
// ====================================================

// เดือน/ปีถัดไปและก่อนหน้า (จัดการ ธ.ค.→ม.ค. และ ม.ค.→ธ.ค.)
function frmNextMonthOf(monthNum, year) {
  return monthNum >= 12 ? { month_num: 1, year: year + 1 } : { month_num: monthNum + 1, year };
}
function frmPrevMonthOf(monthNum, year) {
  return monthNum <= 1 ? { month_num: 12, year: year - 1 } : { month_num: monthNum - 1, year };
}

// ระบบเลขวันรวม: 1-31 = วันของแผนปัจจุบัน, 32-41 = วันที่ 1-10 ของเดือนถัดไป (offset +31)
// ติ๊กวันแรก = จุดเริ่ม (รอวันที่สอง); ติ๊กวันที่สอง = จุดจบ (คำนวณ min/max ตอน commit ไม่ใช่ในนี้)
// ติ๊กวันเดิมซ้ำตอนรอจุดที่สอง = คอมมิตช่วง 1 วัน (เหมือนคลิกวันเดียวกัน 2 ครั้งในระบบเดิม — ตามตัวอย่างจริง BALANCE-01)
// มีครบ 2 จุดแล้ว (คอมมิตไปแล้ว) ติ๊กวันใหม่ = เริ่มช่วงใหม่ (แทนที่คู่เดิม) — ไม่มีการ "ถอน" รายวันเดี่ยว ๆ (ล้างทั้งช่วงใช้ปุ่ม ✕ เดิม)
function frmMarksToggle(marks, day) {
  const cur = marks || [];
  if (cur.length === 0) return [day];
  if (cur.length === 1) return [cur[0], day];
  return [day];
}

// เติมคำต่อท้ายชื่อเครื่องสำหรับแถวคู่แฝด (idempotent — เรียกซ้ำไม่เติมซ้ำ)
const FRM_CROSS_SUFFIX = ' (ต่อจากเดือนก่อน)';
function frmSiblingName(name) {
  const base = String(name || '').replace(/ \(ต่อจากเดือนก่อน\)$/, '');
  return base + FRM_CROSS_SUFFIX;
}

// สร้าง item แถวคู่แฝด (ฟ้าวัน 1 ถึง nextEndDay ของเดือนถัดไป) — pure ไม่รู้จัก plan id ใดๆ
function frmBuildCrossSiblingItem(item, nextMonthNum, nextEndDay, crossId) {
  return {
    instrument_id: item.instrument_id, id_code: item.id_code,
    name: frmSiblingName(item.name), location: item.location || '',
    due_date: null, is_new: false, bar_mode: 'day',
    bar_start: 1, bar_end: nextEndDay, month_num: nextMonthNum,
    cross_id: crossId, crosses_from_prev: true
  };
}

// หาแถวเครื่องเดิมที่ "ไม่ใช่" แถวคู่แฝด (กันซ้ำก่อนแทรกแถวคู่แฝดใหม่)
function frmFindDuplicateInstrument(items, instrumentId) {
  return (items || []).find(it => it.instrument_id === instrumentId && !it.crosses_from_prev);
}

// แทนที่แถวคู่แฝดเดิม (ถ้ามี cross_id ตรงกัน) หรือเพิ่มท้าย
function frmUpsertByCrossId(items, crossId, newItem) {
  const arr = items || [];
  const idx = arr.findIndex(it => it.cross_id === crossId);
  if (idx < 0) return arr.concat([newItem]);
  const copy = arr.slice(); copy[idx] = newItem; return copy;
}

// ลบแถวที่มี cross_id ตรงกันออก
function frmRemoveByCrossId(items, crossId) {
  return (items || []).filter(it => it.cross_id !== crossId);
}

// ล้างสถานะ "ข้ามเดือน" ของแถวต้นทาง (ใช้ตอน sibling ถูกลบ/แผนเดือนถัดไปถูกลบทั้งใบ) — คืน object ใหม่
function frmDecoupleCrossItem(item) {
  const copy = Object.assign({}, item);
  delete copy.cross_id; delete copy.crosses_to_next; delete copy.cross_end_day;
  if (copy.bar_end > 31) copy.bar_end = 31;
  return copy;
}
