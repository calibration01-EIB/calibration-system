/* KPI cohorts use the original planned date, never the registry's next due date. */
const kptState = { batches: [], items: [], loading: false, loaded: false, error: '', month: -1, type: '' };
function kptDate(value) {
  const s = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s ? s : null;
}
function kptAggregate(batches, items, options) {
  const byId = new Map(batches.filter(b => !['draft', 'cancelled'].includes(b.status)).map(b => [String(b.id), b]));
  const groups = new Map();
  items.forEach(item => {
    const batch = byId.get(String(item.batch_id)), date = kptDate(item.planned_date);
    if (!batch || item.is_active === false || !date || Number(date.slice(0, 4)) !== options.year
      || (options.month >= 0 && Number(date.slice(5, 7)) - 1 !== options.month)) return;
    const type = String(batch.instrument_type || 'ไม่ระบุประเภท').trim() || 'ไม่ระบุประเภท';
    if (!groups.has(type)) groups.set(type, { type, plan: 0, done: 0, onTime: 0, late: 0, unknown: 0, overdue: 0, pending: 0, skipped: 0 });
    const r = groups.get(type); r.plan++;
    if (item.result_status === 'completed') {
      r.done++;
      const calibrated = kptDate(item.calibration_date);
      if (!calibrated) r.unknown++;
      else if (calibrated <= date) r.onTime++;
      else r.late++;
    } else if (item.result_status === 'skipped') r.skipped++;
    else if (date < options.today) r.overdue++;
    else r.pending++;
  });
  return [...groups.values()].map(r => ({ ...r, completion: r.done / r.plan * 100,
    timeliness: r.onTime + r.late ? r.onTime / (r.onTime + r.late) * 100 : null }))
    .sort((a, b) => b.overdue - a.overdue || a.type.localeCompare(b.type, 'th'));
}
async function kptRead(client, table, columns) {
  const rows = []; let cursor = null;
  while (true) {
    let query = client.from(table).select(columns).order('id', { ascending: true });
    if (cursor !== null) query = query.gt('id', cursor);
    const { data, error } = await query.limit(200);
    if (error) throw new Error(error.message || 'โหลดข้อมูลไม่สำเร็จ');
    const page = data || []; rows.push(...page);
    if (page.length < 200) return rows;
    const next = page[page.length - 1].id;
    if (next == null || next === cursor) throw new Error('ไม่สามารถอ่านข้อมูลหน้าถัดไป');
    cursor = next;
  }
}
async function kptLoad() {
  if (kptState.loading) return;
  kptState.loading = true; kptState.error = ''; renderKpiPage();
  try {
    const [batches, items] = await Promise.all([
      kptRead(sb, 'calibration_work_batches', 'id,instrument_type,status'),
      kptRead(sb, 'calibration_work_items', 'id,batch_id,planned_date,result_status,calibration_date,is_active')
    ]);
    kptState.batches = batches; kptState.items = items; kptState.loaded = true;
  } catch (error) { kptState.error = error.message; }
  finally { kptState.loading = false; renderKpiPage(); }
}
function kptEscape(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function kptSetFilter(key, value) { if (key === 'month') kptState.month = Number(value); else kptState.type = value; renderKpiPage(); }
function kptHtml() {
  if (kptState.loading) return '<div class="ax-kpi-card" role="status">กำลังโหลดแผนและผลสอบเทียบ…</div>';
  if (kptState.error) return '<div class="ax-kpi-card" role="alert">โหลด KPI ไม่สำเร็จ: ' + kptEscape(kptState.error) + ' <button onclick="kptLoad()">ลองใหม่</button></div>';
  if (!kptState.loaded) return '<div class="ax-kpi-card">ยังไม่ได้โหลดข้อมูล <button onclick="kptLoad()">โหลด KPI</button></div>';
  const today = typeof cwTodayISO === 'function' ? cwTodayISO() : new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Bangkok'});
  const all = kptAggregate(kptState.batches, kptState.items, { year: kpiYear, month: kptState.month, today });
  const types = [...new Set(kptState.batches.map(b => String(b.instrument_type || 'ไม่ระบุประเภท').trim()))].sort((a,b)=>a.localeCompare(b,'th'));
  const rows = all.filter(r => !kptState.type || r.type === kptState.type);
  const total = rows.reduce((t,r) => { ['plan','done','onTime','late','unknown','overdue','pending','skipped'].forEach(k=>t[k]+=r[k]);return t; }, {plan:0,done:0,onTime:0,late:0,unknown:0,overdue:0,pending:0,skipped:0});
  return '<div class="kpt-filters"><label>เดือนตามแผน <select onchange="kptSetFilter(\'month\',this.value)"><option value="-1">ทั้งปี</option>'
    + KPI_MONTHS.map((m,i)=>'<option value="'+i+'"'+(kptState.month===i?' selected':'')+'>'+m+'</option>').join('')
    + '</select></label><label>ประเภทเครื่องมือ <select onchange="kptSetFilter(\'type\',this.value)"><option value="">ทุกประเภท</option>'
    + types.map(t=>'<option value="'+kptEscape(t)+'"'+(kptState.type===t?' selected':'')+'>'+kptEscape(t)+'</option>').join('')
    + '</select></label><button class="ax-kpi-pill" onclick="kptLoad()">รีเฟรช KPI</button></div>'
    + '<div class="kpt-cards">'+kpiCard(total.plan.toLocaleString(),'#155e75','งานตามแผน','รายการในชุดงานที่ยืนยันแล้ว')
    + kpiCard(total.done.toLocaleString(),'#0f6e56','สอบเทียบแล้ว',total.plan ? kpiPct(total.done/total.plan*100,1)+' ของแผน' : 'ไม่มีข้อมูลแผน')
    + kpiCard(total.overdue.toLocaleString(),'#b91c1c','ค้างเกินวันแผน','ยังไม่เสร็จและเลยวันแผนแล้ว')
    + kpiCard(kpiPct(total.onTime+total.late?total.onTime/(total.onTime+total.late)*100:null,1),'#155e75','ตรงตามวันแผน','เฉพาะงานที่เสร็จและมีวันที่สอบเทียบ')+'</div>'
    + '<div class="ax-kpi-card"><h3>ผลสอบเทียบแยกประเภท · '+kpiYear+'</h3><p>นับตามวันแผนเดิมของแต่ละงาน · เรียงประเภทที่มีงานค้างก่อน</p>'
    + '<div class="table-wrap"><table class="ax-table kpt-table"><thead><tr><th>ประเภทเครื่องมือ</th><th>ตามแผน</th><th>เสร็จแล้ว</th><th>ความสำเร็จ</th><th>ตรงแผน</th><th>เสร็จช้า</th><th>ค้าง</th><th>รอถึงวันแผน</th><th>ข้ามงาน</th></tr></thead><tbody>'
    + (rows.map(r=>'<tr><th>'+kptEscape(r.type)+'</th><td>'+r.plan+'</td><td>'+r.done+'</td><td><progress max="100" value="'+r.completion+'" aria-label="ความสำเร็จ '+kptEscape(r.type)+'"></progress> '+kpiPct(r.completion,1)+'</td><td>'+kpiPct(r.timeliness,1)+'<small>'+r.onTime+' งาน</small></td><td>'+r.late+'</td><td class="'+(r.overdue?'kpt-overdue':'')+'">'+r.overdue+'</td><td>'+r.pending+'</td><td>'+r.skipped+'</td></tr>').join('') || '<tr><td colspan="9">ไม่มีแผนสอบเทียบในช่วงและประเภทที่เลือก</td></tr>')
    + '</tbody></table></div></div><details class="ax-kpi-card kpt-notes"><summary>วิธีคำนวณและขอบเขตข้อมูล</summary><p>ความสำเร็จ = งานที่สอบเทียบเสร็จ ÷ งานตามแผนทั้งหมด รวมงานอนาคตและงานที่ข้าม · ตรงแผน = งานที่วันที่สอบเทียบไม่เกินวันแผน ÷ งานที่เสร็จและมีวันที่สอบเทียบ</p><p>ไม่นับชุดงานฉบับร่าง ชุดงานยกเลิก และรายการที่นำออกจากชุดงาน เครื่องมือเดียวกันหลายรอบนับเป็นหลายงาน แยกประเภทตามที่บันทึกในชุดงาน ประวัติที่มีเฉพาะในทะเบียนไม่รวมในหน้านี้</p><p>งานเสร็จที่ไม่มีวันที่สอบเทียบ: '+total.unknown+' งาน (ไม่นับในอัตราตรงแผน) · สถานะค้างคำนวณ ณ '+today+'</p></details>';
}
