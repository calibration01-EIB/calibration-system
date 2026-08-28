# HOME Mobile Compact Brand Header Design

วันที่: 28 สิงหาคม 2026
สถานะ: อนุมัติแบบ B และนำไปใช้งานแล้ว

## เป้าหมาย

ทำหน้า HOME ที่ viewport ไม่เกิน `768px` ให้ตรงแบบ B: เหลือ Header สีขาวชุดเดียว, Hero และการ์ดกระชับ และ Bottom Navigation ห้ารายการ โดย Desktop ตั้งแต่ `769px` ต้องไม่เปลี่ยน

## Header

- ซ่อน `.sidebar` สีเข้มบน Mobile เพื่อไม่ให้ Header ซ้ำ
- ใช้ `.ax-header` สีขาวสูง `56px`
- แสดงโลโก้และชื่อเต็ม ILC ทางซ้าย
- แสดง Avatar ผู้ใช้และปุ่มออกจากระบบทางขวา
- ซ่อนปุ่มหน้าแรก, การแจ้งเตือน, ช่วยเหลือ, ชื่อ/Role และสถานะฐานข้อมูลบน Mobile
- เมนูผู้ใช้และ `doLogout()` ใช้พฤติกรรมเดิม

## HOME

- Hero สูง `140px` และใช้ภาพเดิม
- `Welcome` 11px, หัวเรื่อง 24px และคำอธิบาย 10.5px
- การ์ดเป็นสองคอลัมน์, Gap 8px, รูป 44px และชื่อ 12px
- ซ่อนคำอธิบายกับลูกศรของการ์ดเฉพาะ Mobile
- Badge การ์ดยังทำงานเหมือนเดิม

## Bottom Navigation

- ห้ารายการเต็มความกว้างและไม่มี Horizontal Scroll: หน้าแรก, รายการ, วางแผน, ติดตาม, เพิ่มเติม
- `เพิ่มเติม` เปิด Bottom Sheet สำหรับ Dashboard, Cert, งานซ่อม, Cert Reference และ Admin/Audit ตามสิทธิ์
- ปิดเมนูได้ด้วย Scrim, ปุ่มปิด, Escape และเมื่อเลือกหน้า
- พื้นที่กดเมนูหลักไม่น้อยกว่า `44px`

## การทดสอบ

- Source-contract regression ใน `tests/reference-home.test.html`
- TDD Red/Green สำหรับ Layout B, Bottom Nav fixed และ Cache v148
- Browser suite 8 หน้า
- Visual QA ที่ 320×800, 390×844, 430×932, 768×900 และ 1280×720
- `node --check js/24-home.js`, `node --check sw.js` และ `git diff --check`

## เกณฑ์สำเร็จ

- Mobile ไม่มี Header ซ้ำ, ไม่มี Horizontal Overflow และ Bottom Nav ติดขอบล่าง
- Hero 140px และการ์ดสองคอลัมน์
- เมนูทั้งหมดเข้าถึงได้ผ่านรายการหลักหรือ More Sheet
- Desktop คงรูปแบบเดิมและชุดทดสอบผ่านทั้งหมด
