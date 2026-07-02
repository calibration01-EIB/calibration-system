/* ===== 00-config.js ===== */
// Supabase config — แหล่งเดียวของทั้งระบบ (index.html + js/* และ balance-cal.html)
// cert-print.html ไม่ต่อ DB (รับข้อมูลผ่าน #data=/localStorage) จึงไม่ต้องใช้ไฟล์นี้
// ต้องโหลดก่อน 01-core.js (index) และก่อน inline script ของ balance-cal
const SUPABASE_URL = 'https://wgdzcchleuojkbnqvbfl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZHpjY2hsZXVvamtibnF2YmZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0ODM4MDYsImV4cCI6MjA5NDA1OTgwNn0.kmJWFP6mCr10_aQ_AU30yd45lqSi0rX9hapdIKMsH2c';

// อ่าน session token จาก localStorage (ใช้แนบ header x-app-token ให้ RLS ตรวจสิทธิ์ฝั่ง server)
function calSessionToken() {
  try { return JSON.parse(localStorage.getItem('cal_session') || 'null')?.token || ''; }
  catch (e) { return ''; }
}

// สร้าง Supabase client พร้อมแนบ token ปัจจุบัน — การเขียน/ลบตารางข้อมูลต้องมี token ที่ถูกต้อง
function calCreateClient() {
  const token = calSessionToken();
  return supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: token ? { 'x-app-token': token } : {} }
  });
}
