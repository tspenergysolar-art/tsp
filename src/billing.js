export const emptyBillingSettings=()=>({
  useClientTariff:true,
  injectedRate:0,
  tusdRate:0,
  teRate:0,
  icmsRate:0,
  pisRate:0,
  cofinsRate:0,
});

const round=(value,digits=2)=>Number((Number(value)||0).toFixed(digits));
export function normalizeBillingSettings(raw={}){
  const result=emptyBillingSettings();
  result.useClientTariff=raw.useClientTariff===true||raw.useClientTariff==='on'||raw.useClientTariff==='true';
  for(const key of ['injectedRate','tusdRate','teRate','icmsRate','pisRate','cofinsRate'])result[key]=Number(raw[key]||0);
  return result;
}
export function validateBillingSettings(value){
  for(const key of ['injectedRate','tusdRate','teRate'])if(!Number.isFinite(value[key])||value[key]<0)throw new Error('As tarifas devem ser números iguais ou maiores que zero.');
  for(const key of ['icmsRate','pisRate','cofinsRate'])if(!Number.isFinite(value[key])||value[key]<0||value[key]>100)throw new Error('As alíquotas devem ficar entre 0% e 100%.');
  if(typeof value.useClientTariff!=='boolean')throw new Error('Selecione a origem da tarifa de energia injetada.');
  return value;
}

export function calculateInvoice(consumption,client,settings,override=''){
  validateBillingSettings(settings);
  const injectedRate=settings.useClientTariff?Number(client.tariff||0):settings.injectedRate;
  const grossEnergy=round(Number(consumption.injectedEnergy||0)*injectedRate);
  const contractDiscount=round(grossEnergy*Number(client.discountPercent||0)/100);
  const items=[
    {code:'ENERGIA',description:'Energia injetada',quantity:Number(consumption.injectedEnergy||0),unit:'kWh',rate:injectedRate,value:grossEnergy},
    {code:'TUSD',description:'Consumo TUSD',quantity:Number(consumption.tusdConsumption||0),unit:'kWh',rate:settings.tusdRate,value:round(Number(consumption.tusdConsumption||0)*settings.tusdRate)},
    {code:'TE',description:'Consumo TE',quantity:Number(consumption.teConsumption||0),unit:'kWh',rate:settings.teRate,value:round(Number(consumption.teConsumption||0)*settings.teRate)},
    {code:'BANDEIRA',description:'Adicional de bandeira tarifária',quantity:1,unit:'un',rate:Number(consumption.tariffFlag||0),value:round(consumption.tariffFlag)},
    {code:'ILUMINACAO',description:'Contribuição de iluminação pública',quantity:1,unit:'un',rate:Number(consumption.publicLighting||0),value:round(consumption.publicLighting)},
    {code:'ENCARGOS',description:'Tributos e encargos informados',quantity:1,unit:'un',rate:Number(consumption.taxes||0),value:round(consumption.taxes)},
    {code:'OUTROS',description:'Outros lançamentos',quantity:1,unit:'un',rate:Number(consumption.otherCharges||0),value:round(consumption.otherCharges)},
    {code:'DESCONTO_CONTRATO',description:`Desconto contratual (${round(client.discountPercent||0)}%)`,quantity:1,unit:'un',rate:contractDiscount,value:-contractDiscount},
    {code:'CREDITO_SOLAR',description:'Desconto de crédito solar',quantity:1,unit:'un',rate:Number(consumption.solarCreditDiscount||0),value:-round(consumption.solarCreditDiscount)},
  ];
  const calculatedTotal=round(items.reduce((sum,item)=>sum+item.value,0));
  const hasOverride=String(override).trim()!=='';
  const total=hasOverride?round(Number(override)):Math.max(0,calculatedTotal);
  if(!Number.isFinite(total)||total<0)throw new Error('O total manual deve ser um valor válido e não negativo.');
  const taxBase=Math.max(0,round(items.filter(i=>['ENERGIA','TUSD','TE'].includes(i.code)).reduce((s,i)=>s+i.value,0)));
  const taxes=['icms','pis','cofins'].map(name=>({name:name.toUpperCase(),base:taxBase,rate:settings[`${name}Rate`],value:round(taxBase*settings[`${name}Rate`]/100)}));
  return {items,calculatedTotal:Math.max(0,calculatedTotal),total,manualOverride:hasOverride&&Math.abs(total-calculatedTotal)>.009,taxes,formulaVersion:1};
}

export function buildInvoiceSnapshot({id,client,consumption,company,settings,calculation,history=[],issueDate,dueDate,line='',barcode='',notes='',supersedesInvoiceId=''}){
  return {schemaVersion:1,id,status:'issued',reference:consumption.reference,issueDate,dueDate,companyVersionId:company.versionId,clientId:client.id,consumptionId:consumption.id,
    client:{name:client.name,taxId:client.taxId,email:client.email,phone:client.phone,whatsapp:client.whatsapp,address:client.address,installationNumber:client.installationNumber,meterNumber:client.meterNumber,supplyType:client.supplyType,tariff:Number(client.tariff||0),discountPercent:Number(client.discountPercent||0)},
    consumption:{previousReadDate:consumption.previousReadDate,currentReadDate:consumption.currentReadDate,previousReading:Number(consumption.previousReading),currentReading:Number(consumption.currentReading),multiplier:Number(consumption.multiplier),measuredConsumption:Number(consumption.measuredConsumption),injectedEnergy:Number(consumption.injectedEnergy),manualOverride:consumption.manualOverride===true},
    billingSettings:{...settings},items:calculation.items,taxes:calculation.taxes,calculatedTotal:calculation.calculatedTotal,total:calculation.total,totalManualOverride:calculation.manualOverride,formulaVersion:calculation.formulaVersion,
    history:history.slice(0,6).map(c=>({reference:c.reference,consumption:Number(c.measuredConsumption||0)})),line:String(line).trim(),barcode:String(barcode).trim(),notes:String(notes).trim(),supersedesInvoiceId:String(supersedesInvoiceId||'')};
}
