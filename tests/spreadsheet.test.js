import test from 'node:test';
import assert from 'node:assert/strict';
import writeXlsxFile from 'write-excel-file/node';
import {readSheet} from 'read-excel-file/node';
import {parseCsv,makeCsv,guessMapping,validateImportRows,decimalValue,monthValue} from '../src/sheet-data.js';
import {templateRows} from '../src/spreadsheets.js';

test('CSV preserva separadores, aspas e quebras de linha',()=>{const rows=[['Nome','Observações'],['Cliente; Solar','Linha 1\nLinha "2"']];assert.deepEqual(parseCsv(makeCsv(rows)),rows);});
test('associação automática reconhece cabeçalhos em português',()=>{const map=guessMapping(['NOME','CPF/CNPJ','Nº da Instalação','Telefone'],'clients');assert.equal(map.name,'0');assert.equal(map.taxId,'1');assert.equal(map.phone,'3');});
test('converte valores monetários brasileiros e referências',()=>{assert.equal(decimalValue('R$ 1.234,56'),1234.56);assert.equal(decimalValue('1234.56'),1234.56);assert.equal(monthValue('10/2026'),'2026-10');});
test('valida clientes e aponta instalação repetida na planilha',()=>{const rows=[['Cliente A','UC-1'],['Cliente B','UC-1']];const checked=validateImportRows('clients',rows,{name:'0',installationNumber:'1'});assert.equal(checked[0].valid,true);assert.equal(checked[1].valid,false);});
test('consumo exige cliente conhecido e bloqueia mês já existente',()=>{const client={id:'c1',name:'Cliente A',installationNumber:'UC-1',taxIdDigits:'',phoneDigits:'',whatsappDigits:''};const rows=[['UC-1','10/2026','15/09/2026','15/10/2026','15/11/2026','25/10/2026',100,150,50],['DESCONHECIDO','10/2026','15/09/2026','15/10/2026','15/11/2026','25/10/2026',0,10,10]];const mapping={clientLookup:'0',reference:'1',previousReadDate:'2',currentReadDate:'3',nextReadDate:'4',dueDate:'5',previousReading:'6',currentReading:'7',measuredConsumption:'8'};const checked=validateImportRows('consumptions',rows,mapping,[client],[{id:'c1--2026-10'}]);assert.match(checked[0].errors[0],/Já existe/);assert.match(checked[1].errors[0],/não encontrado/);});
test('modelo XLSX é gerado e relido com o cabeçalho completo',async()=>{const rows=templateRows('clients');const buffer=await writeXlsxFile(rows).toBuffer();const restored=await readSheet(buffer);assert.equal(restored[0].length,14);assert.equal(restored[0][0],'Nome completo ou razão social');assert.equal(restored[1][6],'UC-EXEMPLO-001');});
test('modelo de consumos inclui a próxima leitura e mantém todas as colunas alinhadas',()=>{const rows=templateRows('consumptions');assert.equal(rows[0].length,rows[1].length);assert.ok(rows[0].includes('Data da próxima leitura'));});
