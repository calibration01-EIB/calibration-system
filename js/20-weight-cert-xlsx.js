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

async function exportWeightXlsx(cal){
  if(typeof JSZip==='undefined'){ showToast('โหลด JSZip ไม่สำเร็จ (ต้องออนไลน์ครั้งแรก)','error'); return; }
  const buf = await fetch('assets/weight-cert-template.xlsx').then(r=>r.arrayBuffer());
  const zip = await JSZip.loadAsync(buf);
  const rd = n => zip.file(n).async('string');
  // sheet file paths resolved via workbook.xml + rels (Task 3 adds a resolver); for now assume Cover=sheet1, CertP2=sheet2
  let cover = await rd('xl/worksheets/sheet1.xml'); cover = wxFillCover(cover, cal); zip.file('xl/worksheets/sheet1.xml', cover);
  let p2 = await rd('xl/worksheets/sheet2.xml'); p2 = wxFillCertBody(p2, cal); zip.file('xl/worksheets/sheet2.xml', p2);
  const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE', mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(cal.cert_no||'weight-cert')+'.xlsx'; a.click(); URL.revokeObjectURL(a.href);
}
