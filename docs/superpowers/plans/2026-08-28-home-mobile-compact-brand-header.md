# HOME Mobile Compact Brand Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำหน้า HOME Mobile ให้ตรงแบบ B ด้วย Header สีขาวชุดเดียว, Hero 140px, การ์ดสองคอลัมน์ และ Bottom Navigation ห้ารายการพร้อม More Menu

**Architecture:** ใช้ `theme-aqua.css` เป็น Mobile override ชั้นสุดท้ายเพื่อยกเลิก Sidebar เดิมโดยไม่แตะ Desktop เพิ่ม Markup สำหรับ Logout และ More Sheet ใน `index.html` และให้ `js/24-home.js` ซิงก์สถานะเมนูกับ `showPage()` เดิม

**Tech Stack:** Static HTML/CSS, vanilla JavaScript, service worker, browser-based HTML regression tests

## Global Constraints

- Mobile คือ viewport ไม่เกิน `768px`; Desktop ตั้งแต่ `769px` ต้องไม่เปลี่ยน
- Hero Mobile สูง `140px`; การ์ด HOME สองคอลัมน์
- Bottom Navigation ห้ารายการ ไม่มี Horizontal Scroll และแต่ละปุ่มสูงอย่างน้อย `44px`
- More Menu ต้องรักษา Dashboard, Cert, Repairs, Cert Reference และ Admin/Audit ตามสิทธิ์
- ไม่แก้ API, Login, ข้อมูลการ์ด หรือปลายทาง `showPage()`

---

### Task 1: Regression contracts

**Files:**
- Modify: `tests/reference-home.test.html`

**Interfaces:**
- Consumes: `INDEX`, `CSS`, `HOME_JS`, `SW`
- Produces: contract สำหรับ Mobile Layout B

- [x] **Step 1: เขียน Test ให้คาดหวัง Header B, Hero 140px, กริดสองคอลัมน์และ Bottom Nav fixed ห้ารายการ**

```javascript
has(INDEX, 'id="axMobileMore"');
ok(/body\.app-mode #app \.sidebar\s*\{[^}]*display:\s*none\s*!important/.test(CSS));
ok(/#app \.ax-hero--split\s*\{[^}]*height:\s*140px/.test(CSS));
ok(/\.ax-tiles\s*\{[^}]*repeat\(2,minmax\(0,1fr\)\)/.test(CSS));
```

- [x] **Step 2: เปิด `tests/reference-home.test.html` และยืนยัน RED**

Expected: `FAIL` จากองค์ประกอบและขนาดแบบ B ที่ยังไม่มี

---

### Task 2: Implement Layout B

**Files:**
- Modify: `index.html`
- Modify: `theme-aqua.css`
- Modify: `js/24-home.js`
- Test: `tests/reference-home.test.html`

**Interfaces:**
- Consumes: `showPage(page)`, `doLogout()`, `axSyncUser()` และ role elements เดิม
- Produces: `toggleAxMobileMore(event)`, `closeAxMobileMore()`, `axMobileGo(page)`, `syncAxMobileNav(page)`

- [x] **Step 1: เพิ่ม `.ax-mobile-logout` และ More Sheet markup**
- [x] **Step 2: เปลี่ยน Bottom Navigation เป็น home/list/plan/calrecs/more**
- [x] **Step 3: เพิ่ม JavaScript เปิด/ปิด More, ซิงก์ Active page และซิงก์สิทธิ์ Admin/Audit**
- [x] **Step 4: เพิ่ม Mobile CSS override**

```css
@media (max-width: 768px) {
  body.app-mode #app .sidebar { display: none !important; }
  .ax-header-inner { height: 56px; }
  #app .ax-hero--split { height: 140px; }
  .ax-tiles { grid-template-columns: repeat(2,minmax(0,1fr)); }
  body.app-mode .bottom-nav { position: fixed !important; bottom: 0 !important; grid-template-columns: repeat(5,1fr); }
}
```

- [x] **Step 5: ยืนยัน GREEN และตรวจ Responsive 320/390/430/768/1280**

Expected: Focused Test `ALL PASS`, Mobile ไม่มี overflow และ Desktop ไม่เปลี่ยน

---

### Task 3: Cache and complete verification

**Files:**
- Modify: `sw.js`
- Modify: `tests/reference-home.test.html`
- Modify: `tests/login-b3-ui.test.html`

**Interfaces:**
- Consumes: `CACHE_NAME`
- Produces: `calibration-app-v148`

- [x] **Step 1: เปลี่ยน Test เป็น v148 และยืนยัน RED ขณะ Service Worker ยังเป็น v147**
- [x] **Step 2: เปลี่ยน `sw.js` เป็น `calibration-app-v148`**
- [x] **Step 3: รัน Browser suite ทั้ง 8 หน้า**
- [x] **Step 4: รัน Static verification**

```powershell
node --check js/24-home.js
node --check sw.js
git diff --check
```

Expected: ทุกคำสั่ง exit `0` และ Browser suite ไม่มี `FAIL`
