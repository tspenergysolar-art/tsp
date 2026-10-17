import {digits,normalizeClient,validateClient,normalizeConsumption,validateConsumption} from './validation.js';

export const clientColumns=[
  ['name','Nome completo ou razão social',['nome','cliente','razao social','nome completo']],['taxId','CPF ou CNPJ',['cpf','cnpj','cpf cnpj','documento']],['email','E-mail',['email','e mail']],['phone','Telefone',['telefone','fone']],['whatsapp','WhatsApp',['whatsapp','whats app']],['address','Endereço completo',['endereco','endereco completo']],['installationNumber','Número da instalação',['instalacao','numero da instalacao','uc','unidade consumidora']],['meterNumber','Número do medidor',['medidor','numero do medidor']],['supplyType','Tipo de fornecimento',['tipo de fornecimento','fornecimento']],['contractStart','Data de início do contrato',['inicio do contrato','data de inicio do contrato']],['tariff','Tarifa contratual',['tarifa','tarifa contratual']],['discountPercent','Percentual de desconto',['desconto','percentual de desconto']],['notes','Observações',['observacoes','observacao']],['status','Situação',['situacao','status']]
];
export const consumptionColumns=[
  ['clientLookup','Cliente / instalação',['cliente','instalacao','numero da instalacao','cpf cnpj','documento']],['reference','Mês de referência',['referencia','mes de referencia','mes ano']],['previousReadDate','Data da leitura anterior',['data leitura anterior','data da leitura anterior']],['currentReadDate','Data da leitura atual',['data leitura atual','data da leitura atual']],['previousReading','Leitura anterior',['leitura anterior']],['currentReading','Leitura atual',['leitura atual']],['multiplier','Fator multiplicador',['fator','fator multiplicador']],['measuredConsumption','Consumo medido em kWh',['consumo','consumo medido','consumo kwh']],['injectedEnergy','Energia injetada',['energia injetada']],['saleTariff','Tarifa de venda TSP por kWh',['tarifa tsp','tarifa de venda','valor kwh','valor do kwh']],['tusdConsumption','Consumo TUSD',['tusd','consumo tusd']],['teConsumption','Consumo TE',['te','consumo te']],['solarCreditDiscount','Desconto de crédito solar',['desconto solar','credito solar','desconto de credito solar']],['tariffFlag','Adicional de bandeira tarifária',['bandeira','bandeira tarifaria']],['publicLighting','Contribuição de iluminação pública',['iluminacao publica','contribuicao de iluminacao publica']],['taxes','Tributos e encargos',['tributos','encargos','tributos e encargos']],['otherCharges','Outros lançamentos',['outros','outros lancamentos']],['notes','Observações',['observacoes','observacao']],['dueDate','Data de vencimento',['vencimento','data de vencimento']]
];
export const columnsFor=type=>type==='clients'?clientColumns:consumptionColumns;
export const normalizeHeader=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g,' ').trim();
export function guessMapping(headers,type){
  const result={};
  for(const [key,label,aliases] of columnsFor(type)){
    const accepted=[label,...aliases].map(normalizeHeader);const index=headers.findIndex(header=>accepted.includes(normalizeHeader(header)));
    result[key]=index<0?'':String(index);
  }
  return result;
}
export function parseCsv(text){
  const source=String(text).replace(/^\uFEFF/,'');const firstLine=source.split(/\r?\n/,1)[0];
  const delimiter=(firstLine.match(/;/g)||[]).length>(firstLine.match(/,/g)||[]).length?';':',';
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<source.length;i++){
    const char=source[i];
    if(char==='"'){if(quoted&&source[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(char===delimiter&&!quoted){row.push(cell);cell='';}
    else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&source[i+1]==='\n')i++;row.push(cell);if(row.some(value=>String(value).trim()!==''))rows.push(row);row=[];cell='';}
    else cell+=char;
  }
  row.push(cell);if(row.some(value=>String(value).trim()!==''))rows.push(row);
  return rows;
}
export function makeCsv(rows){return '\uFEFF'+rows.map(row=>row.map(value=>{const text=value instanceof Date?isoDate(value):String(value??'');return /[;"\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;}).join(';')).join('\r\n');}
export function isoDate(value){
  if(!value)return '';
  if(value instanceof Date&&!Number.isNaN(value.valueOf()))return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;
  const text=String(value).trim();let match=text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(match)return `${match[3]}-${match[2]}-${match[1]}`;
  match=text.match(/^(\d{4})-(\d{2})-(\d{2})/);return match?`${match[1]}-${match[2]}-${match[3]}`:text;
}
export function monthValue(value){
  if(value instanceof Date)return isoDate(value).slice(0,7);
  const text=String(value??'').trim();let match=text.match(/^(0[1-9]|1[0-2])[\/\-](\d{4})$/);if(match)return `${match[2]}-${match[1]}`;
  match=text.match(/^(\d{4})[\/\-](0[1-9]|1[0-2])$/);return match?`${match[1]}-${match[2]}`:text;
}
export function decimalValue(value){
  if(typeof value==='number')return value;if(value===null||value===undefined||String(value).trim()==='')return 0;
  let text=String(value).trim().replace(/\s/g,'').replace(/^R\$/i,'');
  if(text.includes(',')&&text.includes('.'))text=text.lastIndexOf(',')>text.lastIndexOf('.')?text.replace(/\./g,'').replace(',','.'):text.replace(/,/g,'');
  else if(text.includes(','))text=text.replace(',','.');
  return Number(text);
}
export function mappedRow(row,mapping){const result={};for(const [key,index] of Object.entries(mapping))if(index!=='')result[key]=row[Number(index)]??'';return result;}
export function clientFromMapped(raw){return normalizeClient({...raw,contractStart:isoDate(raw.contractStart),tariff:decimalValue(raw.tariff),discountPercent:decimalValue(raw.discountPercent),status:normalizeHeader(raw.status)==='inativo'?'inactive':'active'});}
export function consumptionFromMapped(raw){return normalizeConsumption({...raw,reference:monthValue(raw.reference),previousReadDate:isoDate(raw.previousReadDate),currentReadDate:isoDate(raw.currentReadDate),dueDate:isoDate(raw.dueDate),previousReading:decimalValue(raw.previousReading),currentReading:decimalValue(raw.currentReading),multiplier:raw.multiplier===''||raw.multiplier===undefined?1:decimalValue(raw.multiplier),measuredConsumption:decimalValue(raw.measuredConsumption),injectedEnergy:decimalValue(raw.injectedEnergy),saleTariff:decimalValue(raw.saleTariff),tusdConsumption:decimalValue(raw.tusdConsumption),teConsumption:decimalValue(raw.teConsumption),solarCreditDiscount:decimalValue(raw.solarCreditDiscount),tariffFlag:decimalValue(raw.tariffFlag),publicLighting:decimalValue(raw.publicLighting),taxes:decimalValue(raw.taxes),otherCharges:decimalValue(raw.otherCharges)});}
export function resolveClient(lookup,clients){
  const raw=String(lookup??'').trim(), normalized=normalizeHeader(raw), onlyDigits=digits(raw);
  const matches=clients.filter(client=>normalizeHeader(client.installationNumber)===normalized||normalizeHeader(client.name)===normalized||(onlyDigits&&[client.taxIdDigits,client.phoneDigits,client.whatsappDigits].includes(onlyDigits)));
  return matches.length===1?matches[0]:null;
}
export function validateImportRows(type,rows,mapping,existingClients=[],existingConsumptions=[]){
  const seen=new Set();return rows.map((row,index)=>{
    const raw=mappedRow(row,mapping),errors=[],warnings=[];let value=null,client=null;
    try{
      if(type==='clients'){
        value=validateClient(clientFromMapped(raw));const identity=value.installationNumber.toLocaleLowerCase('pt-BR');
        if(seen.has(identity))errors.push('Instalação repetida dentro da planilha.');seen.add(identity);
        const tax=digits(value.taxId),phone=digits(value.phone);const duplicate=existingClients.find(item=>(tax&&item.taxIdDigits===tax)||(phone&&item.phoneDigits===phone)||item.installationNumber.toLocaleLowerCase('pt-BR')===identity);
        if(duplicate)warnings.push(`Possível duplicidade com ${duplicate.name}.`);
      }else{
        client=resolveClient(raw.clientLookup,existingClients);if(!client)throw new Error('Cliente não encontrado ou referência ambígua.');
        value=validateConsumption(consumptionFromMapped(raw));const identity=`${client.id}--${value.reference}`;
        if(seen.has(identity))errors.push('Cliente e referência repetidos dentro da planilha.');seen.add(identity);
        if(existingConsumptions.some(item=>item.id===identity))errors.push('Já existe lançamento para este cliente e mês.');
      }
    }catch(error){errors.push(error.message);}
    return {line:index+2,raw,value,client,errors,warnings,valid:errors.length===0};
  });
}
