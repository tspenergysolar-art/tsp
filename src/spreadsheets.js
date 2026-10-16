import {clientColumns,consumptionColumns,parseCsv,makeCsv,isoDate} from './sheet-data.js';

const labels=columns=>columns.map(([,label])=>label);
export const templateRows=type=>type==='clients'?[labels(clientColumns),['Exemplo Cliente Solar','','cliente@exemplo.com.br','11999990000','11999990000','Rua Exemplo, 100','UC-EXEMPLO-001','MED-001','Bifásico','2026-01-01',0.8,10,'Remova esta linha antes de importar','Ativo']]:[labels(consumptionColumns),['UC-EXEMPLO-001','10/2026','15/09/2026','15/10/2026',1000,1120,1,120,0,0,0,0,0,0,0,0,'Remova esta linha antes de importar','25/10/2026']];
function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function readSpreadsheet(file){
  if(file.size>5_000_000)throw new Error('A planilha excede o limite de 5 MB.');
  const extension=file.name.split('.').pop()?.toLowerCase();let rows;
  if(extension==='csv')rows=parseCsv(await file.text());
  else if(extension==='xlsx'){const {readSheet}=await import('read-excel-file/browser');rows=await readSheet(file);}
  else throw new Error('Use um arquivo XLSX ou CSV.');
  if(rows.length<2)throw new Error('A planilha precisa ter cabeçalho e pelo menos uma linha de dados.');
  if(rows.length>501)throw new Error('Importe no máximo 500 registros por arquivo para preservar a cota gratuita.');
  const width=Math.max(...rows.map(row=>row.length));return rows.map(row=>Array.from({length:width},(_,index)=>row[index]??''));
}
function styled(rows){return rows.map((row,rowIndex)=>row.map(value=>rowIndex===0?{value,fontWeight:'bold',backgroundColor:'#173B36',textColor:'#FFFFFF',wrap:true}:{value:value instanceof Date?value:String(value??''),wrap:true}));}
export async function downloadRows(rows,name,format,sheet='Dados'){
  if(format==='csv'){download(new Blob([makeCsv(rows)],{type:'text/csv;charset=utf-8'}),`${name}.csv`);return;}
  const {default:writeXlsxFile}=await import('write-excel-file/browser');
  await writeXlsxFile(styled(rows),{sheet,columns:rows[0].map((_,index)=>({width:Math.min(35,Math.max(14,...rows.slice(0,50).map(row=>String(row[index]??'').length+2)))})),stickyRowsCount:1}).toFile(`${name}.xlsx`);
}
export const downloadTemplate=(type,format)=>downloadRows(templateRows(type),`modelo-${type==='clients'?'clientes':'consumos'}`,format,type==='clients'?'Clientes':'Consumos');
export function clientExportRows(records){return [labels(clientColumns),...records.map(item=>[item.name,item.taxId,item.email,item.phone,item.whatsapp,item.address,item.installationNumber,item.meterNumber,item.supplyType,isoDate(item.contractStart),item.tariff,item.discountPercent,item.notes,item.status==='active'?'Ativo':'Inativo'])];}
export function consumptionExportRows(records){return [labels(consumptionColumns),...records.map(item=>[item.installationNumber,item.reference,item.previousReadDate,item.currentReadDate,item.previousReading,item.currentReading,item.multiplier,item.measuredConsumption,item.injectedEnergy,item.tusdConsumption,item.teConsumption,item.solarCreditDiscount,item.tariffFlag,item.publicLighting,item.taxes,item.otherCharges,item.notes,item.dueDate])];}
