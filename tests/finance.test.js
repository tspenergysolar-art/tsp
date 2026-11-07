import test from 'node:test';
import assert from 'node:assert/strict';
import {financialRows,financialSummary,agingSummary,supersededInvoiceIds,activeInvoiceByConsumption,invoiceNeedsRefresh,latePaymentQuote,buildLateInvoiceVersion} from '../src/finance.js';

const invoice=(id,total,dueDate,extra={})=>({id,total,dueDate,reference:'2026-10',status:'issued',clientId:'c1',client:{name:'Cliente'},...extra});

test('fatura corrigida preserva histórico sem duplicar o contas a receber',()=>{
  const invoices=[invoice('antiga',100,'2026-10-10'),invoice('nova',120,'2026-10-20',{supersedesInvoiceId:'antiga'})];
  assert.deepEqual([...supersededInvoiceIds(invoices)],['antiga']);
  const rows=financialRows(invoices,[],'2026-10-17');
  assert.equal(rows.find(row=>row.id==='antiga').status,'superseded');
  assert.deepEqual(financialSummary(rows,'2026-10-17'),{billed:120,received:0,pending:120,overdue:0,dueSoon:120,defaultRate:0});
});

test('cadastro mensal corrigido depois da emissão volta a pedir nova fatura',()=>{
  const old=invoice('antiga',100,'2026-10-10',{consumptionId:'c1',issuedAt:{seconds:100}}),replacement=invoice('nova',120,'2026-10-20',{consumptionId:'c1',supersedesInvoiceId:'antiga',issuedAt:{seconds:200}});
  const active=activeInvoiceByConsumption([replacement,old]);
  assert.equal(active.get('c1').id,'nova');
  assert.equal(invoiceNeedsRefresh({updatedAt:{seconds:250}},replacement),true);
  assert.equal(invoiceNeedsRefresh({updatedAt:{seconds:150}},replacement),false);
});

test('resume pagamentos parciais, atraso e faixas de vencimento',()=>{
  const invoices=[invoice('a',100,'2026-10-16'),invoice('b',200,'2026-09-20'),invoice('c',50,'2026-11-01')];
  const payments=[{invoiceId:'a',amount:40,status:'active'},{invoiceId:'a',amount:10,status:'cancelled'},{invoiceId:'c',amount:50,status:'active'}];
  const rows=financialRows(invoices,payments,'2026-10-17'),summary=financialSummary(rows,'2026-10-17');
  assert.equal(rows.find(row=>row.id==='a').status,'overdue');
  assert.equal(rows.find(row=>row.id==='c').status,'paid');
  assert.equal(summary.billed,350);assert.equal(summary.received,90);assert.equal(summary.pending,260);assert.equal(summary.overdue,260);
  assert.deepEqual(agingSummary(rows),{current:0,days1to7:60,days8to30:200,days31to60:0,over60:0});
});

test('calcula multa única de 2% e juros simples de 0,33% ao dia sobre o saldo',()=>{
  const row={...invoice('vencida',1000,'2026-10-01'),balance:600,received:400};
  const quote=latePaymentQuote(row,'2026-10-11');
  assert.deepEqual(quote,{eligible:true,asOf:'2026-10-11',daysOverdue:10,base:600,fine:12,interest:19.8,total:631.8});
  const updated=buildLateInvoiceVersion(row,'2026-10-11');
  assert.equal(updated.reference,'2026-10');
  assert.equal(updated.dueDate,'2026-10-11');
  assert.equal(updated.total,631.8);
  assert.deepEqual(updated.items.map(item=>item.value),[600,12,19.8]);
  assert.equal(updated.lateAdjustment.originalInvoiceId,'vencida');
});

test('não atualiza fatura antes do vencimento ou sem saldo',()=>{
  assert.equal(latePaymentQuote({...invoice('aberta',100,'2026-10-20'),balance:100},'2026-10-11').eligible,false);
  assert.throws(()=>buildLateInvoiceVersion({...invoice('paga',100,'2026-10-01'),balance:0},'2026-10-11'),/não está vencida/);
});
