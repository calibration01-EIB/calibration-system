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
// วันที่ ISO (YYYY-MM-DD) → Excel serial (1899-12-30 = 0) เพื่อคงรูปแบบวันที่ในเซลล์
function wxDateSerial(s){
  if(!s) return null;
  const m=String(s).match(/(\d{4})-(\d{2})-(\d{2})/); if(!m) return null;
  return Math.round(Date.UTC(+m[1],+m[2]-1,+m[3])/86400000)+25569;
}
const WX_UNIT_MG={ mg:1, g:1000, kg:1e6 };
function wxNominalMg(pt){ return Number(pt.nominal_value||0)*(WX_UNIT_MG[pt.unit]||1); }
function wxNominalG(pt){ return wxNominalMg(pt)/1000; }
// เขียนวันที่ (serial) ถ้าแปลงได้ ไม่งั้นเขียนเป็นข้อความเดิม
function wxSetCellDate(x, addr, iso){ const s=wxDateSerial(iso); return s!=null ? wxSetCellNum(x,addr,s) : wxSetCellText(x,addr,iso); }
// เคลียร์เซลล์ (เขียน inlineStr ว่าง) — ใช้ล้างค่าตัวอย่างที่เหลือใน template
function wxClearCell(x, addr){ return wxSetCell(x, addr, '<is><t xml:space="preserve"></t></is>', ' t="inlineStr"'); }

function wxFillCertBody(x, cal){
  const env=cal.env||{};
  x=wxSetCellText(x,'K1',cal.cert_no);
  // page 2 identity
  x=wxSetCellText(x,'C4',cal.equipment); x=wxSetCellText(x,'F5',cal.manufacturer);
  x=wxSetCellText(x,'F6',cal.model); x=wxSetCellText(x,'F7',cal.serial); x=wxSetCellText(x,'F8',cal.id_no);
  x=wxSetCellDate(x,'C9',env.date_cal);
  // page 3 identity (restated)
  x=wxSetCellText(x,'C43',cal.equipment); x=wxSetCellText(x,'F44',cal.manufacturer);
  x=wxSetCellText(x,'F45',cal.model); x=wxSetCellText(x,'F46',cal.serial); x=wxSetCellText(x,'F47',cal.id_no);
  x=wxSetCellDate(x,'C48',env.date_cal);
  return x;
}

// แถวมาตรฐานอ้างอิง (CertP2 rows 21..) — n = ลำดับ (1-based)
function wxFillStdRow(x, ref, n){
  const r=20+n;
  x=wxSetCellText(x,'A'+r, '    '+n+'.) STANDARD WEIGHT');
  x=wxSetCellText(x,'D'+r, ref.model);
  x=wxSetCellText(x,'G'+r, ref.serial);
  x=wxSetCellText(x,'I'+r, ref.due);
  x=wxSetCellText(x,'K'+r, ref.cert);
  return x;
}
// แถว mass comparator (ต่อลำดับจากมาตรฐาน)
function wxFillCompRow(x, comp, n){
  const r=20+n;
  x=wxSetCellText(x,'A'+r, '    '+n+'.) MASS COMPARATOR');
  x=wxSetCellText(x,'D'+r, comp.name);
  x=wxSetCellText(x,'G'+r, comp.serial);
  x=wxSetCellText(x,'I'+r, comp.due||'-');
  x=wxSetCellText(x,'K'+r, comp.cert||'-');
  return x;
}
// แถวผลสรุป (CertP2 rows 55..66) — i = index 0-based
function wxFillResultsRow(x, pt, i){
  const r=55+i;
  x=wxSetCellText(x,'B'+r, pt.nominal_value+'  '+pt.unit);
  x=wxSetCellText(x,'D'+r, pt.marking);
  const cm = pt.conventional_mass_str || (pt.nominal_value+' '+pt.unit+'   '+((pt.correction_mg>=0?'+ ':'- ')+Math.abs(pt.correction_mg)));
  x=wxSetCellText(x,'F'+r, cm);
  x=wxSetCellText(x,'H'+r, pt.unit);
  const un = pt.uncertainty_str || (pt.uncertainty_mg+' '+pt.unit);
  x=wxSetCellText(x,'I'+r, un);
  return x;
}

// ใบบันทึกผลการสอบเทียบ ABBA (5040101-03) รายจุด
function wxFillRec(x, pt, cal){
  const env=cal.env||{}, std=pt.std||{}, comp=pt.comparator||{}, unk=pt.unknown||{}, b=pt._budget||{};
  x=wxSetCellText(x,'M2',cal.cert_no);
  // comparator
  x=wxSetCellText(x,'B3',comp.name); x=wxSetCellText(x,'F3',comp.id_code); x=wxSetCellText(x,'L3',comp.serial);
  x=wxSetCellNum(x,'C4',comp.repeatability); x=wxSetCellNum(x,'M4',comp.linearity);
  // reference standard
  x=wxSetCellNum(x,'B6',std.nominal_value); x=wxSetCellText(x,'D6','g /'+(std.class_grade||''));
  x=wxSetCellText(x,'F6',std.id_code); x=wxSetCellText(x,'M6',std.serial);
  x=wxSetCellNum(x,'B7',std.correction); x=wxSetCellNum(x,'N7',std.uncertainty);
  x=wxSetCellText(x,'B8',std.cert_no); x=wxSetCellDate(x,'M8',std.due_date);
  x=wxSetCellText(x,'B9','Stainless'); x=wxSetCellNum(x,'F9',std.density);
  // unknown weight
  x=wxSetCellNum(x,'B11',pt.nominal_value); x=wxSetCellText(x,'D11',pt.unit);
  x=wxSetCellText(x,'G11',unk.manufacturer); x=wxSetCellText(x,'B12',unk.id_code); x=wxSetCellText(x,'F12',unk.serial||'N/A');
  x=wxSetCellText(x,'B13',unk.material||'Stainless'); x=wxSetCellNum(x,'F13',unk.density||7950);
  // environment
  x=wxSetCellDate(x,'D15',env.date_cal);
  x=wxSetCellNum(x,'E17',env.temp_lo); x=wxSetCellNum(x,'H17',env.temp_hi); x=wxSetCellNum(x,'L17',env.temp_avg);
  x=wxSetCellNum(x,'E18',env.rh_lo); x=wxSetCellNum(x,'H18',env.rh_hi); x=wxSetCellNum(x,'M18',env.rh_avg);
  x=wxSetCellNum(x,'E19',env.press_lo); x=wxSetCellNum(x,'H19',env.press_hi); x=wxSetCellNum(x,'L19',env.press_avg);
  x=wxSetCellNum(x,'C20',pt._rhoA); x=wxSetCellDate(x,'I20',env.due_date);
  // ABBA rows 28-30 (grams) + per-cycle Δ (J) and mci (N)
  const abba=pt.abba||{r1:[],t1:[],t2:[],r2:[]};
  const ci=Number(pt.ci||0), mcr=wxNominalG(pt)+Number(std.correction||0)/1000;
  const rows=[28,29,30];
  for(let i=0;i<3;i++){ const r=rows[i];
    const r1=Number((abba.r1||[])[i]||0), t1=Number((abba.t1||[])[i]||0), t2=Number((abba.t2||[])[i]||0), r2=Number((abba.r2||[])[i]||0);
    x=wxSetCellNum(x,'B'+r,r1); x=wxSetCellNum(x,'D'+r,t1); x=wxSetCellNum(x,'F'+r,t2); x=wxSetCellNum(x,'H'+r,r2);
    const d=(t1-r1-r2+t2)/2;
    x=wxSetCellNum(x,'J'+r,d); x=wxSetCellNum(x,'N'+r,d+ci*mcr);
  }
  x=wxSetCellNum(x,'N31',pt.mc_bar); x=wxSetCellNum(x,'N32',pt.conventional_mass);
  x=wxSetCellNum(x,'L33',pt.correction_mg); x=wxSetCellNum(x,'K38',ci);
  return x;
}

// ใบหาค่าความไม่แน่นอน (uncer) รายจุด — I15/I16 = u/U ดิบ (ก่อนปัด 2sf ที่รายงานบน cert)
function wxFillUnc(x, pt, cal){
  const std=pt.std||{}, comp=pt.comparator||{}, unk=pt.unknown||{}, b=pt._budget||{}, bud=pt.budget||{};
  x=wxSetCellNum(x,'B2',pt.nominal_value); x=wxSetCellText(x,'C2',pt.unit);
  x=wxSetCellText(x,'H2',unk.id_code); x=wxSetCellText(x,'C3',cal.cert_no);
  const ab=wxNominalMg(pt)*Number(pt.ppm||1)/1e6;
  // rows 9-14: E=source magnitude (±mg), I=ui(mg)
  x=wxSetCellNum(x,'E9',std.uncertainty);            x=wxSetCellNum(x,'I9',b.ws);
  x=wxSetCellNum(x,'E10',std.ds!=null?std.ds:std.uncertainty); x=wxSetCellNum(x,'I10',b.ds);
  x=wxSetCellNum(x,'E11',Number(comp.resolution||0)*1000);     x=wxSetCellNum(x,'I11',b.did);
  x=wxSetCellNum(x,'E12',comp.linearity);            x=wxSetCellNum(x,'I12',b.dc);
  x=wxSetCellNum(x,'K12',pt.mpe_mg);                 x=wxSetCellNum(x,'L12',pt.mpe_mg!=null?pt.mpe_mg/3:null);
  x=wxSetCellNum(x,'E13',ab);                        x=wxSetCellNum(x,'I13',b.ab);
  x=wxSetCellNum(x,'E14',b.wr);                      x=wxSetCellNum(x,'I14',b.wr);
  x=wxSetCellNum(x,'I15',bud.u);  x=wxSetCellNum(x,'J15',bud.veff);
  x=wxSetCellNum(x,'I16',bud.U);
  // derivation footnotes
  x=wxSetCellNum(x,'O24',ab); x=wxSetCellNum(x,'M26',comp.repeatability); x=wxSetCellNum(x,'O26',b.wr);
  return x;
}

// ใบประเมินผลการสอบเทียบ รายจุด — ตารางแถว 14 (หน่วยกรัม)
function wxFillEval(x, pt, cal){
  const unk=pt.unknown||{};
  x=wxSetCellText(x,'H7',cal.cert_no); x=wxSetCellText(x,'H8',unk.id_code);
  const errG=Number(pt.correction_mg||0)/1000, Ug=Number(pt.uncertainty_mg||0)/1000;
  const tolG=(pt.mpe_mg!=null?pt.mpe_mg/1000:null);
  x=wxSetCellNum(x,'A14',wxNominalG(pt));
  x=wxSetCellNum(x,'B14',errG); x=wxSetCellNum(x,'C14',Ug);
  x=wxSetCellNum(x,'D14',errG+Ug); x=wxSetCellNum(x,'F14',errG-Ug);
  if(tolG!=null) x=wxSetCellNum(x,'H14',tolG); else x=wxSetCellText(x,'H14','-');
  x=wxSetCellText(x,'I14', tolG==null?'-':(pt.pass?'PASS':'FAIL'));
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

  // --- fill Cover ---
  let cover = await rd(smap.Cover); cover = wxFillCover(cover, cal); zip.file(smap.Cover, cover);

  // --- fill CertP2: identity + reference-standard/comparator table + results table ---
  let p2 = await rd(smap.CertP2); p2 = wxFillCertBody(p2, cal);
  let n=1;
  (cal.procedure_refs||[]).forEach(ref=>{ p2=wxFillStdRow(p2, ref, n); n++; });
  (cal.comparators||[]).forEach(c=>{ p2=wxFillCompRow(p2, c, n); n++; });
  for(let r=20+n; r<=30; r++){ ['A','D','G','I','K'].forEach(col=>{ p2=wxClearCell(p2, col+r); }); } // ล้างแถวตัวอย่างที่เหลือ
  points.forEach((pt,i)=>{ p2=wxFillResultsRow(p2, pt, i); });
  for(let r=55+points.length; r<=66; r++){ ['B','D','F','H','I'].forEach(col=>{ p2=wxClearCell(p2, col+r); }); }
  zip.file(smap.CertP2, p2);

  // --- fill per-point Rec/Unc/Eval ---
  for(let i=0;i<points.length;i++){
    const ps=ptSheets[i], pt=points[i];
    let rec = await rd(ps.rec);  rec  = wxFillRec(rec, pt, cal);   zip.file(ps.rec, rec);
    let unc = await rd(ps.unc);  unc  = wxFillUnc(unc, pt, cal);   zip.file(ps.unc, unc);
    let evl = await rd(ps.eval); evl  = wxFillEval(evl, pt, cal);  zip.file(ps.eval, evl);
  }

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
