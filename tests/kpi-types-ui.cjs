const { chromium } = require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
const root=process.cwd(),html=fs.readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin!=='http://kpi.test')return route.abort();if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:html});const f=path.resolve(root,'.'+decodeURIComponent(u.pathname));return f.startsWith(root+path.sep)&&fs.existsSync(f)?route.fulfill({path:f}):route.fulfill({status:404,body:''});});
await page.goto('http://kpi.test');
await page.addScriptTag({content:`var allData=[];var cwTodayISO=()=> '2026-09-14';var fail=false;var batches=['เครื่องชั่ง','ตุ้มน้ำหนัก','อุณหภูมิ','ความดัน','ไฟฟ้า'].map((t,i)=>({id:i,instrument_type:t,status:'awaiting_calibration'}));var items=batches.flatMap(b=>Array.from({length:12},(_,i)=>({id:b.id*20+i,batch_id:b.id,planned_date:'2026-09-01',result_status:i<9?'completed':'in_progress',calibration_date:i<7?'2026-08-30':'2026-09-02'})));var sb={from(t){return {select(){return this},order(){return this},limit(){return Promise.resolve(fail?{error:{message:'offline'}}:{data:t==='calibration_work_batches'?batches:items})}}}};`});
await page.addScriptTag({content:fs.readFileSync('js/10-router.js','utf8').split('(function installListIntegrityFixes()')[0]});
for(const f of ['js/24-home.js','js/28-kpi.js','js/31-kpi-types.js'])await page.addScriptTag({path:f});
await page.evaluate(async()=>{for(const id of ['loginPage','splashScreen'])document.getElementById(id).style.setProperty('display','none','important');document.getElementById('app').style.display='block';document.querySelectorAll('.page-content').forEach(e=>e.style.display='none');kpiYear=2026;showPage('home');});
await page.locator('#axTiles').getByRole('button',{name:/KPI งานสอบเทียบ/}).click();
await page.waitForSelector('.kpt-table tbody tr');
assert.equal(await page.locator('.kpt-table tbody tr').count(),5);
await page.screenshot({path:'.codex-screens/kpi-types-desktop.png',fullPage:true});
await page.locator('.kpt-filters select').nth(1).selectOption('อุณหภูมิ');assert.equal(await page.locator('.kpt-table tbody tr').count(),1);
await page.locator('.kpt-filters select').first().selectOption('0');assert.match(await page.locator('.kpt-table').innerText(),/ไม่มีแผน/);
await page.locator('.kpt-filters select').first().selectOption('-1');
await page.setViewportSize({width:390,height:844});for(const sel of ['.kpt-cards','.kpt-filters','.kpt-filters select']){const b=await page.locator(sel).first().boundingBox();assert.ok(b.x>=0&&b.x+b.width<=391,sel);}
await page.screenshot({path:'.codex-screens/kpi-types-mobile.png',fullPage:true});
await page.evaluate(async()=>{fail=true;await kptLoad()});assert.match(await page.locator('#kpiBody').innerText(),/โหลด KPI ไม่สำเร็จ/);assert.equal(await page.locator('.kpt-table').count(),0);
assert.deepEqual(errors,[]);console.log('KPI desktop/mobile, filters, empty and failure states passed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
