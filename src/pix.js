const field=(id,value)=>`${id}${String(value).length.toString().padStart(2,'0')}${value}`;
const ascii=(value,max)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 .-]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);

export function normalizePixKey(value){
  const key=String(value||'').trim(),digits=key.replace(/\D/g,'');
  if(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(key)||/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(key))return digits;
  if(/^\+[\d\s().-]+$/.test(key))return `+${digits}`;
  return key;
}

function crc16(value){
  let crc=0xffff;
  for(let i=0;i<value.length;i++){
    crc^=value.charCodeAt(i)<<8;
    for(let bit=0;bit<8;bit++)crc=(crc&0x8000)?(crc<<1)^0x1021:crc<<1;
    crc&=0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4,'0');
}

export function buildPixPayload(invoice,profile){
  const key=normalizePixKey(profile?.pixKey),name=ascii(profile?.pixBeneficiary,25),city=ascii(profile?.city,15),amount=Number(invoice?.total),txid=ascii(String(invoice?.id||'').replace(/-/g,''),25)||'***';
  if(!key||!name||!city||!Number.isFinite(amount)||amount<=0)return '';
  const merchant=field('00','BR.GOV.BCB.PIX')+field('01',key);
  const payload=field('00','01')+field('26',merchant)+field('52','0000')+field('53','986')+field('54',amount.toFixed(2))+field('58','BR')+field('59',name)+field('60',city)+field('62',field('05',txid))+'6304';
  return payload+crc16(payload);
}

export async function createPixQrDataUrl(invoice,profile){
  const payload=buildPixPayload(invoice,profile);
  if(!payload)return '';
  const {default:QRCode}=await import('qrcode');
  return QRCode.toDataURL(payload,{errorCorrectionLevel:'M',margin:2,width:420,color:{dark:'#123a30',light:'#ffffff'}});
}
