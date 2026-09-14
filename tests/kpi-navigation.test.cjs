const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
test('home exposes KPI and mobile menu routes to it',()=>{
 const host={innerHTML:''};const c=vm.createContext({window:{},document:{getElementById:id=>id==='axTiles'?host:null,querySelectorAll:()=>[],addEventListener(){}},console});
 vm.runInContext(fs.readFileSync('js/24-home.js','utf8'),c);c.renderAxTiles();
 assert.match(host.innerHTML,/showPage\('kpi'\)/);assert.match(host.innerHTML,/KPI งานสอบเทียบ/);
 assert.match(fs.readFileSync('index.html','utf8'),/axMobileGo\('kpi'\)/);
});
