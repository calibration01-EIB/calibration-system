/* ===== 20-weight-cert-xlsx.js ===== */
// Export ใบ Cert ตุ้มน้ำหนักเป็น .xlsx (workbook เดียว, ค่านิ่ง) จาก template ด้วย JSZip
// ค่าเลขทั้งหมดมาจาก calc engine (js/weight-cal.js) — ที่นี่แค่เขียนค่าลง template ตามฟอร์ม
// =====================================================================
function wxColIndex(letters){ let n=0; for(const ch of letters) n=n*26+(ch.charCodeAt(0)-64); return n; }
function wxCellRef(col,row){ let s=''; while(col>0){ const m=(col-1)%26; s=String.fromCharCode(65+m)+s; col=(col-m-1)/26; } return s+row; }
function wxEsc(t){ return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function wxRowNum(addr){ return parseInt(addr.replace(/[A-Z]/g,''),10); }
function wxColLetters(addr){ return addr.replace(/[0-9]/g,''); }
// เขียน cell (inlineStr หรือ number) ลง sheetData string — insert row/cell ถ้ายังไม่มี, ทับถ้ามี
function wxSetCell(sheetXml, addr, inner, attr){
  const row=wxRowNum(addr);
  const cellXml=`<c r="${addr}"${attr}>${inner}</c>`;
  // มี cell อยู่แล้ว → แทน
  const cellRe=new RegExp(`<c r="${addr}"[^>]*?(/>|>[\\s\\S]*?</c>)`);
  if(cellRe.test(sheetXml)) return sheetXml.replace(cellRe, cellXml);
  // มี row แต่ไม่มี cell → แทรกใน row ตามลำดับคอลัมน์
  const rowOpenRe=new RegExp(`<row r="${row}"[^>]*>`);
  const rowSelfRe=new RegExp(`<row r="${row}"([^>]*)/>`);
  if(rowSelfRe.test(sheetXml)) return sheetXml.replace(rowSelfRe,`<row r="${row}"$1>${cellXml}</row>`);
  if(rowOpenRe.test(sheetXml)){
    const closeIdx=sheetXml.indexOf('</row>', sheetXml.search(rowOpenRe));
    return sheetXml.slice(0,closeIdx)+cellXml+sheetXml.slice(closeIdx); // append before </row> (Excel tolerates order; sort not required for read)
  }
  // ไม่มี row → แทรก row ใหม่ก่อน </sheetData>
  const nr=`<row r="${row}">${cellXml}</row>`;
  return sheetXml.replace('</sheetData>', nr+'</sheetData>');
}
function wxSetCellText(sheetXml, addr, text){ if(text==null||text==='') return sheetXml; return wxSetCell(sheetXml, addr, `<is><t xml:space="preserve">${wxEsc(text)}</t></is>`, ' t="inlineStr"'); }
function wxSetCellNum(sheetXml, addr, num){ if(num==null||num===''||!isFinite(Number(num))) return sheetXml; return wxSetCell(sheetXml, addr, `<v>${Number(num)}</v>`, ''); }

function wxFillCover(x, cal){
  x=wxSetCellText(x,'K3',cal.cert_no); x=wxSetCellText(x,'D13',cal.client&&cal.client.name);
  x=wxSetCellText(x,'D19',cal.equipment); x=wxSetCellText(x,'F19',cal.range_text);
  x=wxSetCellText(x,'F20',cal.manufacturer); x=wxSetCellText(x,'F21',cal.model);
  x=wxSetCellText(x,'F22',cal.serial); x=wxSetCellText(x,'F23',cal.id_no); x=wxSetCellText(x,'F24',cal.resolution_str||'N/A');
  x=wxSetCellText(x,'D32',cal.calibrated_by); x=wxSetCellText(x,'H34',cal.signers&&cal.signers.tech_mgr);
  return x;
}
function wxFillCertBody(x, cal){
  x=wxSetCellText(x,'K1',cal.cert_no); x=wxSetCellText(x,'C4',cal.equipment); x=wxSetCellText(x,'F4',cal.range_text);
  // reference-standard rows + results rows filled in Task 4
  return x;
}

// ===================== OOXML plumbing (per-point sheet cloning) =====================
// ลงทะเบียนชีตใหม่ใน 3 ที่: [Content_Types].xml, workbook.xml, workbook.xml.rels
function wxRegisterSheet(ctXml, wbXml, relsXml, newName, newPath, newRid, newSheetId){
  ctXml = ctXml.replace('</Types>',
    `<Override PartName="/${newPath}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  wbXml = wbXml.replace('</sheets>',
    `<sheet name="${wxEsc(newName)}" sheetId="${newSheetId}" r:id="${newRid}"/></sheets>`);
  const target = newPath.replace(/^xl\//,''); // rels Target is relative to xl/
  relsXml = relsXml.replace('</Relationships>',
    `<Relationship Id="${newRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${target}"/></Relationships>`);
  return { ctXml, wbXml, relsXml };
}
// หา path ไฟล์ชีตจากชื่อชีต (robust ต่อลำดับ attribute)
function wxResolveSheets(wbXml, relsXml){
  const rel={};
  relsXml.replace(/<Relationship\b([^>]*?)\/?>/g,(m,a)=>{
    const id=(a.match(/\bId="([^"]+)"/)||[])[1];
    const tg=(a.match(/\bTarget="([^"]+)"/)||[])[1];
    if(id&&tg) rel[id]=tg; return m;
  });
  const map={};
  wbXml.replace(/<sheet\b([^>]*?)\/?>/g,(m,a)=>{
    const name=(a.match(/\bname="([^"]+)"/)||[])[1];
    const rid=(a.match(/r:id="([^"]+)"/)||[])[1];
    if(name&&rid){ let t=(rel[rid]||'').replace(/^\//,''); if(!/^xl\//.test(t)) t='xl/'+t; map[name]=t; }
    return m;
  });
  return map;
}
// เปลี่ยนชื่อชีตใน workbook.xml (ไม่แตะ r:id/sheetId) — ใช้ทำ Rec→Rec_1 ให้จุดแรกใช้ชีตเดิม
function wxRenameSheet(wbXml, oldName, newName){
  return wbXml.replace(new RegExp(`(<sheet\\b[^>]*?\\bname=")${oldName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(")`), `$1${wxEsc(newName)}$2`);
}
function wxMaxRid(relsXml){ let mx=0; (relsXml.match(/Id="rId(\d+)"/g)||[]).forEach(s=>{ const n=+s.match(/\d+/)[0]; if(n>mx)mx=n; }); return mx; }
function wxMaxSheetId(wbXml){ let mx=0; (wbXml.match(/sheetId="(\d+)"/g)||[]).forEach(s=>{ const n=+s.match(/\d+/)[0]; if(n>mx)mx=n; }); return mx; }

// clone ชีต 1 ใบพร้อม chain: sheet.xml + _rels + drawing (+drawing _rels) — media/printerSettings ใช้ร่วม (ไม่ทำซ้ำ)
// mutate plumb={ct,wb,rels}, ids={nextSheet,nextDrawing,nextRid,nextSheetId}; คืน path ชีตใหม่
async function wxCloneSheetFull(zip, plumb, ids, srcSheetPath, newName){
  const srcNum = srcSheetPath.match(/sheet(\d+)\.xml/)[1];
  const newSheetNum = ids.nextSheet++;
  const newPath = `xl/worksheets/sheet${newSheetNum}.xml`;
  zip.file(newPath, await zip.file(srcSheetPath).async('string'));
  // clone the sheet's _rels (drawing + printerSettings). drawing must be per-sheet → clone it; printerSettings shared.
  const srcRelsFile = zip.file(`xl/worksheets/_rels/sheet${srcNum}.xml.rels`);
  if(srcRelsFile){
    let relsXml = await srcRelsFile.async('string');
    const dm = relsXml.match(/\.\.\/drawings\/drawing(\d+)\.xml/);
    if(dm){
      const srcDraw=dm[1], newDraw=ids.nextDrawing++;
      zip.file(`xl/drawings/drawing${newDraw}.xml`, await zip.file(`xl/drawings/drawing${srcDraw}.xml`).async('string'));
      const drawRels = zip.file(`xl/drawings/_rels/drawing${srcDraw}.xml.rels`);
      if(drawRels) zip.file(`xl/drawings/_rels/drawing${newDraw}.xml.rels`, await drawRels.async('string')); // targets = shared media
      plumb.ct = plumb.ct.replace('</Types>',
        `<Override PartName="/xl/drawings/drawing${newDraw}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`);
      relsXml = relsXml.replace(`../drawings/drawing${srcDraw}.xml`, `../drawings/drawing${newDraw}.xml`);
    }
    zip.file(`xl/worksheets/_rels/sheet${newSheetNum}.xml.rels`, relsXml);
  }
  const newRid=`rId${ids.nextRid++}`, newSheetId=ids.nextSheetId++;
  const r = wxRegisterSheet(plumb.ct, plumb.wb, plumb.rels, newName, newPath, newRid, newSheetId);
  plumb.ct=r.ctXml; plumb.wb=r.wbXml; plumb.rels=r.relsXml;
  return newPath;
}

// สร้าง JSZip object พร้อม inject/clone ครบ (ยังไม่ download) — แยกไว้ให้ acceptance harness เรียก capture ได้
async function wxBuildZip(cal, templateUrl){
  const points = (cal && cal.points) || [];
  const buf = await fetch(templateUrl||'assets/weight-cert-template.xlsx').then(r=>r.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);
  const rd = n => zip.file(n).async('string');

  // --- read plumbing ---
  const plumb = {
    ct:   await rd('[Content_Types].xml'),
    wb:   await rd('xl/workbook.xml'),
    rels: await rd('xl/_rels/workbook.xml.rels'),
  };
  const smap = wxResolveSheets(plumb.wb, plumb.rels); // {Cover,CertP2,Rec,Unc,Eval} → path
  const ids = {
    nextSheet:   Math.max(...Object.keys(zip.files).map(f=>{ const m=f.match(/^xl\/worksheets\/sheet(\d+)\.xml$/); return m?+m[1]:0; }))+1,
    nextDrawing: Math.max(0,...Object.keys(zip.files).map(f=>{ const m=f.match(/^xl\/drawings\/drawing(\d+)\.xml$/); return m?+m[1]:0; }))+1,
    nextRid:     wxMaxRid(plumb.rels)+1,
    nextSheetId: wxMaxSheetId(plumb.wb)+1,
  };

  // --- per-point sheet paths: point 1 reuses template Rec/Unc/Eval; points 2..N cloned ---
  const ptSheets = [{ rec:smap.Rec, unc:smap.Unc, eval:smap.Eval }];
  plumb.wb = wxRenameSheet(plumb.wb,'Rec','Rec_1');
  plumb.wb = wxRenameSheet(plumb.wb,'Unc','Unc_1');
  plumb.wb = wxRenameSheet(plumb.wb,'Eval','Eval_1');
  for(let i=1;i<points.length;i++){
    const rec  = await wxCloneSheetFull(zip, plumb, ids, smap.Rec,  'Rec_'+(i+1));
    const unc  = await wxCloneSheetFull(zip, plumb, ids, smap.Unc,  'Unc_'+(i+1));
    const evl  = await wxCloneSheetFull(zip, plumb, ids, smap.Eval, 'Eval_'+(i+1));
    ptSheets.push({ rec, unc, eval:evl });
  }

  // --- fill cert sheets (per-point fills wired in Task 4) ---
  let cover = await rd(smap.Cover); cover = wxFillCover(cover, cal); zip.file(smap.Cover, cover);
  let p2 = await rd(smap.CertP2); p2 = wxFillCertBody(p2, cal); zip.file(smap.CertP2, p2);

  // --- write plumbing back ---
  zip.file('[Content_Types].xml', plumb.ct);
  zip.file('xl/workbook.xml', plumb.wb);
  zip.file('xl/_rels/workbook.xml.rels', plumb.rels);
  return zip;
}

async function exportWeightXlsx(cal){
  if(typeof JSZip==='undefined'){ showToast('โหลด JSZip ไม่สำเร็จ (ต้องออนไลน์ครั้งแรก)','error'); return; }
  if(!((cal&&cal.points)||[]).length){ showToast('ยังไม่มีจุดสอบเทียบ','error'); return; }
  const zip = await wxBuildZip(cal);
  const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE', mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(cal.cert_no||'weight-cert')+'.xlsx'; a.click(); URL.revokeObjectURL(a.href);
}
