import test from 'node:test';
import assert from 'node:assert/strict';
import {extractCpflFieldsFromPages,cpflFieldsToDraft,findClientForCpfl,calculateCpflCharge,findDuplicateCpfl} from '../src/cpfl-reader.js';

const field=(fields,key)=>fields.find(item=>item.key===key);

test('extrai campos principais de uma conta CPFL digital sem confundir energia injetada',()=>{
  const fields=extractCpflFieldsFromPages([`CPFL PAULISTA
NOME DO CLIENTE: MARIA DA SILVA
CPF: 123.456.789-00
NÚMERO DA INSTALAÇÃO: 4000123456
REFERÊNCIA: OUTUBRO/2026
VENCIMENTO: 25/10/2026
DATA DA LEITURA ANTERIOR: 15/09/2026
DATA DA LEITURA ATUAL: 15/10/2026
DATA DA PRÓXIMA LEITURA: 15/11/2026
LEITURA ANTERIOR: 1200
LEITURA ATUAL: 1480
FATOR MULTIPLICADOR: 1
CONSUMO FATURADO: 280 kWh
ENERGIA INJETADA: 175 kWh
CONTRIBUIÇÃO ILUMINAÇÃO PÚBLICA R$ 18,50
TOTAL A PAGAR: R$ 205,85`]);
  assert.equal(field(fields,'installationNumber').value,'4000123456');
  assert.equal(field(fields,'reference').value,'2026-10');
  assert.equal(field(fields,'dueDate').value,'2026-10-25');
  assert.equal(field(fields,'nextReadDate').value,'2026-11-15');
  assert.equal(field(fields,'billedConsumption').value,'280');
  assert.equal(field(fields,'injectedEnergy').value,'175');
  assert.equal(field(fields,'publicLighting').value,'18.5');
  assert.equal(field(fields,'totalAmount').value,'205.85');
});

test('preenche somente campos selecionados e mantém fator padrão',()=>{
  const fields=extractCpflFieldsFromPages(['REFERÊNCIA: 10/2026\nCONSUMO FATURADO: 300 kWh\nENERGIA INJETADA: 120 kWh']);
  field(fields,'injectedEnergy').selected=false;
  assert.deepEqual(cpflFieldsToDraft(fields),{reference:'2026-10',measuredConsumption:'300',multiplier:1});
});

test('associa cliente somente quando a instalação tem correspondência única',()=>{
  const fields=extractCpflFieldsFromPages(['NÚMERO DA INSTALAÇÃO: 00123']);
  assert.equal(findClientForCpfl(fields,[{id:'a',installationNumber:'00123'},{id:'b',installationNumber:'999'}]).id,'a');
  assert.equal(findClientForCpfl(fields,[{id:'a',installationNumber:'00123'},{id:'b',installationNumber:'00123'}]),null);
});

test('calcula prévia contratual e detecta cadastro duplicado',()=>{
  assert.equal(calculateCpflCharge('280','0.7352'),205.86);
  assert.equal(calculateCpflCharge('inválido','0.7'),null);
  const existing={clientId:'c1',reference:'2026-10',revision:2};
  assert.equal(findDuplicateCpfl([existing],'c1','2026-10'),existing);
  assert.equal(findDuplicateCpfl([existing],'c1','2026-11'),null);
});

test('marca campos ausentes como não identificados e desmarcados',()=>{
  const fields=extractCpflFieldsFromPages(['CPFL PAULISTA']);
  assert.equal(field(fields,'dueDate').status,'unidentified');
  assert.equal(field(fields,'dueDate').selected,false);
});

test('reconhece a estrutura tabular da conta CPFL atual',()=>{
  const fields=extractCpflFieldsFromPages([`CLIENTE EXEMPLO 1.234.567.890-12
08/10/2026 09/09/2026 29
OUT/2026 23/10/2026 R$ 2.289,30
Consumo Uso Sistema [KWh]-TUSD OUT/26 kWh 2.387,0000 0,44925000 0,56903226 1.358,28
Consumo - TE OUT/26 kWh 2.387,0000 0,29020000 0,36757437 877,40
Adicional de Bandeira Amarela OUT/26 kWh 41,27 41,27
Contribuição Custeio IP-CIP OUT/26 12,35
30955542 Energia Ativa-kWh único 11648 14035 1,00 2.387 Amarela 21 Dias
836300000228893000403053284288390032101391295256`]);
  assert.equal(field(fields,'holderName').value,'CLIENTE EXEMPLO');
  assert.equal(field(fields,'installationNumber').value,'1.234.567.890-12');
  assert.equal(field(fields,'reference').value,'2026-10');
  assert.equal(field(fields,'dueDate').value,'2026-10-23');
  assert.equal(field(fields,'billedConsumption').value,'2387');
  assert.equal(field(fields,'previousReading').value,'11648');
  assert.equal(field(fields,'currentReading').value,'14035');
  assert.equal(field(fields,'tusdRate').value,'0.56903226');
  assert.equal(field(fields,'teRate').value,'0.36757437');
  assert.equal(field(fields,'publicLighting').value,'12.35');
  assert.equal(field(fields,'tariffFlag').value,'41.27');
  assert.equal(field(fields,'totalAmount').value,'2289.3');
  assert.equal(field(fields,'barcode').value,'836300000228893000403053284288390032101391295256');
});
