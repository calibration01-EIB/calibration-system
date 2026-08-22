-- ล้างข้อมูลระบบสอบเทียบตุ้มน้ำหนัก (ABBA) เพื่อเริ่มนับ 1 ใหม่
--
-- ***** รันไปแล้ว 2026-08-21 (ขั้นที่ 1-3) — เก็บไว้เป็นบันทึกและไว้ย้อนกลับ *****
--
-- สิ่งที่พบตอนรันขั้นที่ 1: ข้อมูลน้อยกว่าที่คิดมาก
--   weight_cal_jobs   1 แถว  (cert 26M001-0-0 วันที่ 2026-07-29 ลูกค้าสะกดผิด = งานทดลอง)
--   weight_cal_points 1 แถว  (จุด 1000 g)
--   mass_comparators  4 แถว
--
-- สิ่งที่ทำจริง ต่างจากแผนเดิม 1 จุด:
--   **ไม่ได้ลบ mass_comparators** เพราะเปิดดูแล้วไม่ใช่ข้อมูลงาน แต่เป็นทะเบียน
--   เครื่องเปรียบเทียบมวลจริงของแล็บ 4 เครื่อง (AT21 / AT1005 / PR5003 / ID7+KA30-3/P)
--   พร้อมสเปกทางมาตรวิทยาที่ต้องกรอกจากคู่มือ/ใบ cert — resolution, repeatability,
--   linearity, ย่านการวัด, serial, ID code ตามระบบทะเบียนเครื่องมือ
--   ลบทิ้งแล้วต้องกรอกใหม่ทั้งหมดและเสี่ยงพิมพ์ผิด ถ้าจะลบจริงดูขั้นที่ 3ข ท้ายไฟล์
--
-- ตรวจ FK แล้ว: ไม่มีตารางนอกกลุ่มนี้ชี้เข้ามา (มีแต่ points -> jobs และ points -> comparators)
-- สำเนาอยู่ที่สคีมา weight_cal_backup (jobs 1 / points 1 / comparators 4)
--
-- อ่านให้จบก่อนรัน แล้วรันทีละขั้นใน Supabase SQL Editor
--
-- ============================================================
-- ห้ามแตะเด็ดขาด — ใช้ร่วมกับการสอบเทียบเครื่องชั่งซึ่งเป็นงานหลัก
--   standard_weights   js/balance-cal.js:1813 ดึงมาใช้เป็นตุ้มมาตรฐาน (status='approved')
--   cmc_set / cmc_row  ขอบเขตความสามารถการวัด ใช้คำนวณ uncertainty
--   instruments        ทะเบียนเครื่องมือทั้งระบบ
--   calibration_records / cert_sequences
-- ถ้าล้างพวกนี้ = สอบเทียบเครื่องชั่งไม่ได้ และสูตร FRM-CAL92 ขาดค่า Dₛ
-- ============================================================

-- ---------- ขั้นที่ 1: ดูก่อนว่าจะลบอะไรบ้าง (ไม่เปลี่ยนข้อมูล) ----------
select 'weight_cal_points' as tbl, count(*) as rows from public.weight_cal_points
union all
select 'weight_cal_jobs',  count(*) from public.weight_cal_jobs
union all
select 'mass_comparators', count(*) from public.mass_comparators;

-- ตารางที่ต้องคงไว้ — เลขต้องไม่เปลี่ยนหลังล้าง เอาไว้เทียบทีหลัง
select 'standard_weights' as tbl, count(*) as rows from public.standard_weights
union all
select 'cmc_row',  count(*) from public.cmc_row
union all
select 'cmc_set',  count(*) from public.cmc_set;


-- ---------- ขั้นที่ 2: สำรองไว้ก่อนลบ ----------
-- เก็บเป็นตารางสำเนาไว้ในสคีมาแยก เผื่ออยากได้ข้อมูลเดิมกลับ
-- (ลบสคีมานี้ทิ้งเองภายหลังเมื่อมั่นใจแล้ว: drop schema weight_cal_backup cascade;)
create schema if not exists weight_cal_backup;

create table if not exists weight_cal_backup.weight_cal_points_20260821 as
  select * from public.weight_cal_points;
create table if not exists weight_cal_backup.weight_cal_jobs_20260821 as
  select * from public.weight_cal_jobs;
create table if not exists weight_cal_backup.mass_comparators_20260821 as
  select * from public.mass_comparators;

-- เช็คว่าสำเนาครบเท่าต้นฉบับก่อนไปขั้นต่อไป
select 'points' as t, (select count(*) from public.weight_cal_points)  as src,
       (select count(*) from weight_cal_backup.weight_cal_points_20260821)  as bak
union all
select 'jobs', (select count(*) from public.weight_cal_jobs),
       (select count(*) from weight_cal_backup.weight_cal_jobs_20260821)
union all
select 'comparators', (select count(*) from public.mass_comparators),
       (select count(*) from weight_cal_backup.mass_comparators_20260821);


-- ---------- ขั้นที่ 3: ล้างข้อมูล ----------
-- ลบลูกก่อนแม่ (weight_cal_points อ้าง weight_cal_jobs)
-- ใช้ delete ไม่ใช่ truncate เพื่อให้ติด RLS/trigger ตามปกติ และ rollback ได้ถ้าอยู่ใน transaction
begin;

delete from public.weight_cal_points;
delete from public.weight_cal_jobs;

-- mass_comparators ไม่ได้ลบ (ดูเหตุผลหัวไฟล์) — เป็นทะเบียนเครื่องจริง ไม่ใช่ข้อมูลงาน
-- delete from public.mass_comparators;

-- ตรวจก่อน commit — jobs/points ต้องเป็น 0 · comparators คงไว้ 4 · ที่เหลือต้องไม่เปลี่ยน
select 'weight_cal_points' as tbl, count(*) from public.weight_cal_points
union all select 'weight_cal_jobs', count(*) from public.weight_cal_jobs
union all select 'mass_comparators', count(*) from public.mass_comparators
union all select 'standard_weights (ต้องเท่าเดิม)', count(*) from public.standard_weights
union all select 'cmc_row (ต้องเท่าเดิม)', count(*) from public.cmc_row;

-- ถ้าเลขถูกต้อง:
commit;
-- ถ้าผิด:
-- rollback;


-- ---------- ขั้นที่ 4 (ทำเมื่อแน่ใจแล้วว่าไม่กลับไปใช้ของเดิม) ----------
-- ลบตารางทิ้งทั้งหมด ถ้าจะออกแบบสคีมาใหม่ตั้งแต่ต้น
-- ยังไม่ต้องรีบ — เก็บโครงว่างไว้ก่อนก็ได้ ไม่กินที่
--
-- drop table if exists public.weight_cal_points;
-- drop table if exists public.weight_cal_jobs;
-- drop table if exists public.mass_comparators;


-- ---------- ขั้นที่ 3ข (ทางเลือก): ถ้าตัดสินใจจะลบทะเบียนเครื่องด้วย ----------
-- สำเนาอยู่ใน weight_cal_backup.mass_comparators_20260821 แล้ว กู้กลับได้
-- begin;
--   delete from public.mass_comparators;
--   select count(*) from public.mass_comparators;   -- ต้องเป็น 0
-- commit;


-- ---------- กู้ข้อมูลกลับจากสำเนา ----------
-- insert into public.mass_comparators  select * from weight_cal_backup.mass_comparators_20260821;
-- insert into public.weight_cal_jobs   select * from weight_cal_backup.weight_cal_jobs_20260821;
-- insert into public.weight_cal_points select * from weight_cal_backup.weight_cal_points_20260821;
-- หมายเหตุ: jobs/points ใช้ id เดิม ถ้ามีข้อมูลใหม่ชนกันต้องจัดการ sequence ก่อน
