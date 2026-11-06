import test from 'node:test';
import assert from 'node:assert/strict';
import {extractCpflFieldsFromPages,extractCpflOperationsFromPages,cpflFieldsToDraft,findClientForCpfl,calculateCpflCharge,findDuplicateCpfl} from '../src/cpfl-reader.js';

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
  assert.deepEqual(cpflFieldsToDraft(fields),{reference:'2026-10',measuredConsumption:'300',multiplier:1,previousReading:0,currentReading:0,operations:[],adjustmentPercent:10,publicLighting:0});
});

test('novo DANF3E extrai operações, sinais, consumo total e IP-CIP',()=>{
  const page=`THIAGO SANCHEZ PEREIRA\nR PARA 293\n5.398.354.035-00 Próxima Leitura 31/10/2026\n30/09/2026 31/08/2026 30\nSET/2026 12/11/2026 R$ 1.572,85\nConsumo Ponta [KWh] - TUSD SET/26 kWh 302,6992 1,35157000 1,71196356 518,21 518,21 18,00 93,28 2,85 12,96\nConsumo Fora Ponta [KWh]-TUSD SET/26 kWh 4.856,6554 0,16416000 0,20793117 1.009,85 1.009,85 18,00 181,77 5,55 25,26\nCons Ponta - TE SET/26 kWh 302,6992 0,43188000 0,54704473 165,59 165,59 18,00 29,81 0,91 4,14\nCons FPonta TE SET/26 kWh 4.856,6554 0,27282000 0,34556086 1.678,27 1.678,27 18,00 302,09 9,22 41,97\nAdicional Band Amarela Ponta SET/26 kWh 7,23 7,23 18,00 1,30 0,04 0,18\nUso Sist Distr Geração [kW] SET/26 kW 45,0000 6,99000000 7,26000000 326,70 2,19 9,96\nConsumo Reativo Exc Ponta SET/26 kWh 48,0073 0,29020000 0,36765242 17,65 17,65 18,00 3,18 0,10 0,44\nDemanda [kW] - TUSD SET/26 kW 30,0000 16,53000000 17,16866667 515,06 0.00 3,45 15,71\nEnergia Atv Inj Fponta TUSD SET/26 kWh 4.856,6554 0,16416000 0,17050417 828,08- 0.00 5,55- 25,26-\nSubtotal 1.552,43\nTotal Distribuidora 1.552,43\nContribuição Custeio IP-CIP SET/26 20,42\nTotal a Pagar 1.572,85`;
  const result=extractCpflOperationsFromPages([page]),fields=extractCpflFieldsFromPages([page]);
  assert.equal(result.operations.filter(item=>item.selected).length,6);
  const ponta=result.operations.find(item=>item.description.startsWith('Cons Ponta - TE'));
  assert.deepEqual(ponta,{description:'Cons Ponta - TE SET/26',unit:'kWh',quantity:302.6992,aneelTariff:.43188,taxedTariff:.54704473,value:165.59,selected:true});
  const bandeira=result.operations.find(item=>item.description.startsWith('Adicional Band'));
  assert.equal(bandeira.quantity,0);assert.equal(bandeira.aneelTariff,0);assert.equal(bandeira.taxedTariff,0);assert.equal(bandeira.value,7.23);
  assert.equal(result.operations.find(item=>item.description.startsWith('Energia Atv Inj')).value,-828.08);
  assert.equal(result.measuredConsumption,5159.3546);assert.equal(result.summary.publicLighting,20.42);assert.equal(field(fields,'installationNumber').value,'5.398.354.035-00');assert.equal(field(fields,'holderName').value,'THIAGO SANCHEZ PEREIRA');
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
