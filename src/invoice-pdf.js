import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {createPixQrDataUrl} from './pix.js';

const A4=[595.28,841.89], blue=rgb(.04,.33,.62), lightBlue=rgb(.88,.95,1), green=rgb(.08,.43,.22), lime=rgb(.74,.86,.45), pale=rgb(.94,.98,.94), ink=rgb(.12,.15,.14), gray=rgb(.35,.39,.37), border=rgb(.55,.76,.91), yellow=rgb(1,.98,.87), orange=rgb(.98,.37,.03);
const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const num=(v,d=3)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:d}).format(Number(v)||0);
const date=v=>v?v.split('-').reverse().join('/'):'-';
const ref=v=>v?`${v.slice(5,7)}/${v.slice(0,4)}`:'-';
const clean=v=>String(v??'').replace(/[\u2013\u2014]/g,'-').replace(/[^\x20-\x7E\xA0-\xFF]/g,'');

function wrap(text,font,size,max){const words=clean(text).split(/\s+/),lines=[];let line='';for(const word of words){const next=line?`${line} ${word}`:word;if(font.widthOfTextAtSize(next,size)<=max)line=next;else{if(line)lines.push(line);line=word;}}if(line)lines.push(line);return lines;}
function text(page,font,value,x,y,size=7,color=ink,options={}){page.drawText(clean(value),{x,y,size,font,color,...options});}
function box(page,x,y,w,h,fill=rgb(1,1,1),stroke=border){page.drawRectangle({x,y,width:w,height:h,color:fill,borderColor:stroke,borderWidth:.6});}
function gradient(page,x,y,w,h,start,end,steps=96){
  const sw=w/steps;
  for(let i=0;i<steps;i++){
    const ratio=i/(steps-1),color=rgb(start[0]+(end[0]-start[0])*ratio,start[1]+(end[1]-start[1])*ratio,start[2]+(end[2]-start[2])*ratio);
    page.drawRectangle({x:x+i*sw,y,width:sw+.25,height:h,color});
  }
}
function center(page,font,value,x,y,w,size=7,color=ink){const v=clean(value),tw=font.widthOfTextAtSize(v,size);text(page,font,v,x+Math.max(3,(w-tw)/2),y,size,color);}
function right(page,font,value,x,y,w,size=7,color=ink){const v=clean(value),tw=font.widthOfTextAtSize(v,size);text(page,font,v,x+w-tw-4,y,size,color);}
function labelValue(page,bold,regular,label,value,x,y,w){text(page,bold,label.toUpperCase(),x,y,6.2,gray);wrap(value||'-',regular,8.2,w).slice(0,2).forEach((line,i)=>text(page,regular,line,x,y-11-i*9,8.2,ink));}
function dataUrlBytes(value){if(!value)return null;return Uint8Array.from(atob(value.split(',')[1]),c=>c.charCodeAt(0));}
async function embedLogo(pdf,value){
  const bytes=dataUrlBytes(value);if(!bytes)return null;
  if(value.startsWith('data:image/png'))return pdf.embedPng(bytes);
  if(value.startsWith('data:image/jpeg'))return pdf.embedJpg(bytes);
  if(value.startsWith('data:image/webp')){
    const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/webp'}));
    try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);return pdf.embedPng(dataUrlBytes(canvas.toDataURL('image/png')));}finally{bitmap.close();}
  }
  return null;
}

export async function createInvoicePdf(invoice,company){
  const pdf=await PDFDocument.create(),page=pdf.addPage(A4),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),{width}=page.getSize(),p=company.profile;
  const margin=28,content=width-margin*2;
  gradient(page,margin,766,content,55,[.04,.33,.62],[.08,.43,.22]);
  let logo=null;try{logo=await embedLogo(pdf,company.logo);}catch{}
  let titleX=margin+13,titleWidth=260;
  if(logo){const s=logo.scaleToFit(43,43);page.drawImage(logo,{x:margin+10,y:772+(43-s.height)/2,width:s.width,height:s.height});titleX=margin+61;titleWidth=212;}
  const companyTitle=String(p.tradeName||'TSP ENERGY SOLAR').toUpperCase(),companySize=Math.min(16,titleWidth/Math.max(1,companyTitle.length)*1.55);
  text(page,bold,companyTitle,titleX,801,companySize,rgb(1,1,1));
  text(page,bold,'SOLAR & ENERGIA SUSTENTÁVEL',titleX,787,6.8,rgb(.8,.94,.28));
  text(page,regular,'Documento de Cobrança / Demonstrativo de Consumo',titleX,775,5.4,rgb(.9,.96,.94));
  const invoiceNumber=clean(invoice.id).replace(/[^A-Za-z0-9]/g,'').slice(-8).toUpperCase()||'-';
  right(page,bold,'FATURA DE ENERGIA ELÉTRICA',margin+300,801,content-310,8.7,rgb(1,1,1));
  right(page,bold,'REPASSE SOLAR',margin+300,787,content-310,8.7,rgb(.8,.94,.28));
  right(page,regular,`Fatura ${invoiceNumber}`,margin+300,775,content-310,5.8,rgb(.9,.96,.94));
  const gap=8,leftW=276,rightX=margin+leftW+gap,rightW=content-leftW-gap;box(page,margin,694,leftW,63,pale,green);box(page,rightX,694,rightW,63,rgb(.96,.98,1),blue);
  text(page,bold,'DADOS DO CLIENTE / UNIDADE CONSUMIDORA',margin+8,744,7,green);page.drawLine({start:{x:margin+8,y:739},end:{x:margin+leftW-8,y:739},color:rgb(.4,.72,.46),thickness:1});
  text(page,bold,invoice.client.name,margin+8,727,8.5);text(page,regular,`CPF/CNPJ: ${invoice.client.taxId||'-'}`,margin+8,715,7.2);wrap(invoice.client.address||'-',regular,7,leftW-16).slice(0,2).forEach((line,i)=>text(page,regular,line,margin+8,704-i*8,7));
  text(page,bold,'DADOS DO GERADOR / EMPRESA',rightX+8,744,7,blue);page.drawLine({start:{x:rightX+8,y:739},end:{x:rightX+rightW-8,y:739},color:rgb(.38,.68,.91),thickness:1});
  text(page,bold,p.legalName||p.tradeName,rightX+8,727,8.3);text(page,bold,'CNPJ:',rightX+8,715,7);text(page,regular,p.cnpj||'-',rightX+38,715,7);text(page,bold,'E-mail:',rightX+8,705,7);text(page,regular,p.email||'-',rightX+42,705,7);text(page,bold,'Contato:',rightX+8,697,6);text(page,regular,p.phone||p.whatsapp||'-',rightX+43,697,6);
  const cols=[['Instalação',invoice.client.installationNumber],['Medidor',invoice.client.meterNumber],['Fornecimento',invoice.client.supplyType],['Apresentação',date(invoice.issueDate)],['Leitura anterior',date(invoice.consumption.previousReadDate)],['Leitura atual',date(invoice.consumption.currentReadDate)],['Próxima leitura',date(invoice.consumption.nextReadDate)]];
  const cw=content/cols.length;cols.forEach(([l,v],i)=>{page.drawRectangle({x:margin+i*cw,y:657,width:cw,height:34,color:i?rgb(.97,.98,.98):rgb(1,1,1),borderColor:blue,borderWidth:.55});page.drawRectangle({x:margin+i*cw,y:676,width:cw,height:15,color:blue});center(page,bold,l.toUpperCase(),margin+i*cw,681,cw,6.1,rgb(1,1,1));center(page,bold,v||'-',margin+i*cw,661,cw,7.1,ink);});
  [['MÊS DE REFERÊNCIA',ref(invoice.reference),blue],['VENCIMENTO',date(invoice.dueDate),rgb(.42,.61,.38)],['TOTAL A PAGAR (R$)',brl(invoice.total),rgb(1,.77,0)]].forEach(([l,v,c],i)=>{const x=margin+i*content/3;page.drawRectangle({x,y:610,width:content/3,height:38,color:c});center(page,bold,l,x,634,content/3,7.4,i===2?blue:rgb(1,1,1));center(page,bold,v,x,616,content/3,11.5,i===2?blue:rgb(1,1,1));});
  box(page,margin,557,content,43,yellow,rgb(1,.67,.05));page.drawRectangle({x:margin,y:557,width:4,height:43,color:rgb(1,.67,.05)});text(page,bold,'AVISOS E INFORMAÇÕES IMPORTANTES',margin+11,588,7.1,orange);const notices=[p.notices,invoice.notes].filter(Boolean).join(' • ')||'Confira os dados desta fatura antes do pagamento.';wrap(notices,regular,7.1,content-22).slice(0,3).forEach((l,i)=>text(page,regular,`• ${l}`,margin+11,575-i*9,7.1,gray));
  const tableW=364,sideX=margin+tableW+8,sideW=content-tableW-8,top=545,bottom=340,rowH=25,headers=[['DESCRIÇÃO DA OPERAÇÃO',0,175],['UNID.',175,29],['QUANT.',204,38],['TARIFA (R$)',242,48],['VALOR (R$)',290,74]];box(page,margin,bottom,tableW,top-bottom,rgb(.995,.995,.995),border);headers.forEach(([h,off,w])=>{page.drawRectangle({x:margin+off,y:top-18,width:w,height:18,color:lightBlue,borderColor:border,borderWidth:.5});center(page,bold,h,margin+off,top-12,w,5.9,blue);});
  const items=invoice.items.filter(i=>Math.abs(i.value)>.0001||['ENERGIA','TUSD','TE'].includes(i.code)).slice(0,7);items.forEach((item,i)=>{const y=top-18-(i+1)*rowH;page.drawLine({start:{x:margin,y},end:{x:margin+tableW,y},color:border,thickness:.35});wrap(item.description,regular,7,166).slice(0,2).forEach((l,j)=>text(page,i===0?bold:regular,l,margin+4,y+rowH-9-j*7.5,7,i===0?green:ink));center(page,regular,item.unit||'-',margin+175,y+9,29,6.6);right(page,regular,num(item.quantity),margin+204,y+9,38,6.6);right(page,regular,num(item.rate,6),margin+242,y+9,48,6.3);right(page,bold,brl(item.value),margin+290,y+9,74,6.5);});
  page.drawRectangle({x:margin,y:bottom,width:tableW,height:19,color:rgb(.9,.96,.9)});text(page,bold,'TOTAL CONSOLIDADO (R$)',margin+157,bottom+7,6.7,green);right(page,bold,brl(invoice.total),margin+290,bottom+7,74,6.7,green);
  box(page,sideX,450,sideW,95,pale,rgb(.49,.75,.49));center(page,bold,'TRIBUTOS E ENCARGOS',sideX,531,sideW,7.2,green);page.drawRectangle({x:sideX+5,y:510,width:sideW-10,height:14,color:rgb(.78,.9,.78)});text(page,bold,'TRIBUTO',sideX+8,515,5.8,green);text(page,bold,'BASE',sideX+52,515,5.8,green);text(page,bold,'ALÍQ.',sideX+99,515,5.8,green);text(page,bold,'VALOR',sideX+134,515,5.8,green);invoice.taxes.slice(0,4).forEach((tax,i)=>{const y=497-i*13;text(page,regular,tax.name,sideX+8,y,6.3);right(page,regular,brl(tax.base),sideX+42,y,48,5.9);right(page,regular,`${num(tax.rate,3)}%`,sideX+91,y,36,5.9);right(page,regular,brl(tax.value),sideX+128,y,39,5.9);});
  box(page,sideX,340,sideW,101,rgb(.96,.98,1),rgb(.32,.68,1));center(page,bold,'HISTÓRICO DE CONSUMO (kWh)',sideX,427,sideW,6.2,blue);const bars=[...invoice.history.slice(0,5).reverse().map(h=>({reference:h.reference,consumption:h.consumption})),{reference:invoice.reference,consumption:invoice.consumption.measuredConsumption}],max=Math.max(1,...bars.map(h=>h.consumption));bars.forEach((h,i)=>{const slot=(sideW-18)/Math.max(1,bars.length),x=sideX+10+i*slot,bh=Math.max(3,h.consumption/max*48);page.drawRectangle({x:x+slot/2-4,y:360,width:8,height:bh,color:i===bars.length-1?blue:rgb(.39,.68,.91)});center(page,regular,ref(h.reference),x,349,slot,4.5,i===bars.length-1?blue:gray);});page.drawLine({start:{x:sideX+7,y:358},end:{x:sideX+sideW-7,y:358},color:blue,thickness:1});
  const meterHeaders=[['MEDIDOR',0,47],['GRANDEZAS',47,100],['POSTO HORÁRIO',147,78],['LEITURA ANTERIOR',225,87],['LEITURA ATUAL',312,72],['FATOR MULT.',384,64],['CONSUMO MEDIDO',448,91]];meterHeaders.forEach(([h,off,w])=>{page.drawRectangle({x:margin+off,y:306,width:w,height:18,color:lightBlue,borderColor:border,borderWidth:.45});center(page,bold,h,margin+off,312,w,5.8,blue);page.drawRectangle({x:margin+off,y:288,width:w,height:18,color:rgb(1,1,1),borderColor:rgb(.86,.9,.92),borderWidth:.35});});center(page,bold,invoice.client.meterNumber||'-',margin,295,47,6.4);center(page,regular,'Energia Ativa (kWh)',margin+47,295,100,6.4);center(page,regular,'Único',margin+147,295,78,6.4);center(page,bold,num(invoice.consumption.previousReading),margin+225,295,87,6.4);center(page,bold,num(invoice.consumption.currentReading),margin+312,295,72,6.4);center(page,regular,num(invoice.consumption.multiplier),margin+384,295,64,6.4);center(page,bold,`${num(invoice.consumption.measuredConsumption)} kWh`,margin+448,295,91,6.4);
  for(let x=margin;x<margin+content;x+=10)page.drawLine({start:{x,y:278},end:{x:x+5,y:278},color:blue,thickness:1.4});
  let qr=null,dynamicPix=false;try{const source=await createPixQrDataUrl(invoice,p);dynamicPix=Boolean(source);const bytes=dataUrlBytes(source);if(bytes)qr=await pdf.embedPng(bytes);}catch{}box(page,margin+19,207,58,58,pale,green);if(qr){const s=qr.scaleToFit(52,52);page.drawImage(qr,{x:margin+22,y:210,width:s.width,height:s.height});}else{center(page,bold,'PIX',margin+19,236,58,7,green);center(page,regular,'QR CODE',margin+19,223,58,5.5,green);}
  text(page,bold,'PAGAMENTO VIA PIX / DADOS BANCÁRIOS',margin+103,251,9,blue);text(page,bold,'• Chave PIX:',margin+103,235,7.2);text(page,bold,p.pixKey||'-',margin+164,235,7.2,green);text(page,bold,'• Beneficiário:',margin+103,223,7.2);text(page,regular,p.pixBeneficiary||'-',margin+171,223,7.2);text(page,bold,'• Empresa / Usina:',margin+103,211,7.2);text(page,regular,p.legalName||p.tradeName||'-',margin+184,211,7.2);
  box(page,margin+378,207,161,58,rgb(.96,.98,1),blue);labelValue(page,bold,regular,'Total a pagar',brl(invoice.total),margin+386,251,140);labelValue(page,bold,regular,'Data de vencimento',date(invoice.dueDate),margin+386,226,140);text(page,regular,dynamicPix?'QR com valor desta fatura':'PIX não configurado',margin+386,211,5.2,gray);
  box(page,margin,125,content,67,rgb(.97,.99,1),blue);center(page,bold,'CÓDIGO DE BARRAS / LINHA DIGITÁVEL',margin,176,content,8.5,blue);center(page,regular,invoice.line||'Espaço reservado - este documento não é um boleto bancário registrado.',margin,157,content,7.2,gray);if(invoice.barcode){for(let i=0;i<Math.min(invoice.barcode.length,80);i++){const x=margin+35+i*5.6,wid=(Number(invoice.barcode[i])%3+1)*.52;page.drawRectangle({x,y:132,width:wid,height:20,color:ink});}}
  text(page,regular,`Fatura ${invoice.id.slice(0,8).toUpperCase()} • Emissão ${date(invoice.issueDate)} • Pagamento não confirmado automaticamente.`,margin,104,6.2,gray);right(page,regular,'TSP ENERGY SOLAR',margin,104,content,6.2,gray);
  pdf.setTitle(`Fatura ${ref(invoice.reference)} - ${invoice.client.name}`);pdf.setAuthor(p.tradeName||'TSP Energy Solar');pdf.setSubject('Fatura de energia elétrica / repasse solar');return pdf.save();
}

export function downloadPdf(bytes,name){const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export function openPdf(bytes){const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),120000);}
