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

// ---------------- orchestration (แตะ sb) ----------------

async function frmFetchPlanByMonth(unitCode, typeName, monthNum, year) {
  const { data, error } = await sb.from('frm_plans').select('*')
    .eq('unit_code', unitCode).eq('type_name', typeName)
    .eq('month_num', monthNum).eq('year', year).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function frmSavePlanItems(planId, items) {
  const { error } = await sb.from('frm_plans')
    .update({ items, updated_at: new Date().toISOString() }).eq('id', planId);
  if (error) throw error;
}

// หาแผนเดือนถัดไป (หน่วย+ประเภทเดียวกัน) — ไม่พบก็สร้าง draft ใหม่ให้อัตโนมัติ
async function frmFindOrCreateNextMonthPlan(plan) {
  const next = frmNextMonthOf(plan.month_num, plan.year);
  const found = await frmFetchPlanByMonth(plan.unit_code, plan.type_name, next.month_num, next.year);
  if (found) return found;
  const row = {
    unit_code: plan.unit_code, type_name: plan.type_name,
    month_num: next.month_num, year: next.year,
    header: Object.assign({}, plan.header), items: [], status: 'draft',
    created_by: currentUser?.username || ''
  };
  const { data, error } = await sb.from('frm_plans').insert(row).select().single();
  if (error) throw error;
  return data;
}

// ผูกแถวข้ามเดือน: หา/สร้างแผนเดือนถัดไป, กันซ้ำ, ตรวจล็อก, แทรก/อัพเดตแถวคู่แฝด
async function frmLinkCrossMonth(plan, item, nextEndDay) {
  let nextPlan;
  try { nextPlan = await frmFindOrCreateNextMonthPlan(plan); }
  catch (e) { return { ok: false, message: 'หาแผนเดือนถัดไปไม่สำเร็จ: ' + e.message }; }

  if (nextPlan.status !== 'draft') {
    return { ok: false, message: 'แผนเดือนถัดไปของหน่วยนี้ถูกส่งขออนุมัติแล้ว ลากข้ามเดือนไม่ได้ — ต้องตีกลับแผนนั้นเป็นร่างก่อน' };
  }

  const dup = frmFindDuplicateInstrument(nextPlan.items, item.instrument_id);
  if (dup) {
    return { ok: false, message: 'เครื่อง ' + (item.id_code || item.name || '') + ' มีอยู่ในแผนเดือนถัดไปแล้ว (แถวปกติ) — กรุณาลบ/รวมแถวเดิมก่อน' };
  }

  const crossId = item.cross_id || crypto.randomUUID();
  const siblingItem = frmBuildCrossSiblingItem(item, nextPlan.month_num, nextEndDay, crossId);
  const newItems = frmUpsertByCrossId(nextPlan.items, crossId, siblingItem);

  try { await frmSavePlanItems(nextPlan.id, newItems); }
  catch (e) { return { ok: false, message: 'บันทึกแผนเดือนถัดไปไม่สำเร็จ: ' + e.message }; }

  return { ok: true, crossId };
}

// ลบแถวคู่แฝดออกจากแผนเดือนถัดไป (ใช้ตอนแก้ช่วงจนไม่ข้ามเดือนแล้ว หรือลบแถวต้นทาง)
async function frmRemoveCrossSibling(plan, item) {
  if (!item.cross_id) return { ok: true };
  const next = frmNextMonthOf(plan.month_num, plan.year);
  let nextPlan;
  try { nextPlan = await frmFetchPlanByMonth(plan.unit_code, plan.type_name, next.month_num, next.year); }
  catch (e) { return { ok: false, message: 'ค้นหาแผนเดือนถัดไปไม่สำเร็จ: ' + e.message }; }
  if (!nextPlan) return { ok: true }; // ถูกลบไปแล้วทั้งใบ ไม่มีอะไรต้องลบซ้ำ
  if (nextPlan.status !== 'draft') {
    return { ok: false, message: 'แผนเดือนถัดไปถูกส่งขออนุมัติแล้ว ไม่สามารถลบแถวคู่แฝดอัตโนมัติได้ — ต้องตีกลับแผนนั้นเป็นร่างก่อน' };
  }
  const filtered = frmRemoveByCrossId(nextPlan.items, item.cross_id);
  if (filtered.length === (nextPlan.items || []).length) return { ok: true }; // ไม่มีแถวคู่แฝดอยู่แล้ว
  try { await frmSavePlanItems(nextPlan.id, filtered); }
  catch (e) { return { ok: false, message: 'ลบแถวคู่แฝดไม่สำเร็จ: ' + e.message }; }
  return { ok: true };
}

// เก็บกวาดก่อนลบแผนทั้งใบ: ลูกที่แผนนี้สร้างไว้ในเดือนถัดไป (crosses_to_next) + พ่อแม่ที่แผนนี้พึ่งพาอยู่ (crosses_from_prev)
async function frmCleanupPlanCrossSiblings(plan) {
  for (const item of (plan.items || [])) {
    if (item.crosses_to_next) {
      const res = await frmRemoveCrossSibling(plan, item);
      if (!res.ok) return res;
    }
    if (item.crosses_from_prev && item.cross_id) {
      const prev = frmPrevMonthOf(plan.month_num, plan.year);
      let originPlan;
      try { originPlan = await frmFetchPlanByMonth(plan.unit_code, plan.type_name, prev.month_num, prev.year); }
      catch (e) { return { ok: false, message: 'ค้นหาแผนต้นทางไม่สำเร็จ: ' + e.message }; }
      if (!originPlan) continue; // ต้นทางถูกลบไปแล้ว ไม่มีอะไรต้อง decouple
      const idx = (originPlan.items || []).findIndex(it => it.cross_id === item.cross_id);
      if (idx < 0) continue;
      const newItems = originPlan.items.slice();
      newItems[idx] = frmDecoupleCrossItem(newItems[idx]);
      try { await frmSavePlanItems(originPlan.id, newItems); }
      catch (e) { return { ok: false, message: 'อัพเดตแผนต้นทางไม่สำเร็จ: ' + e.message }; }
    }
  }
  return { ok: true };
}
