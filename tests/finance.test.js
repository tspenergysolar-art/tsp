import test from 'node:test';
import assert from 'node:assert/strict';
import {financialRows,financialSummary,agingSummary,supersededInvoiceIds} from '../src/finance.js';

const invoice=(id,total,dueDate,extra={})=>({id,total,dueDate,reference:'2026-10',status:'issued',clientId:'c1',client:{name:'Cliente'},...extra});

test('fatura corrigida preserva histórico sem duplicar o contas a receber',()=>{
  const invoices=[invoice('antiga',100,'2026-10-10'),invoice('nova',120,'2026-10-20',{supersedesInvoiceId:'antiga'})];
  assert.deepEqual([...supersededInvoiceIds(invoices)],['antiga']);
  const rows=financialRows(invoices,[],'2026-10-17');
  assert.equal(rows.find(row=>row.id==='antiga').status,'superseded');
  assert.deepEqual(financialSummary(rows,'2026-10-17'),{billed:120,received:0,pending:120,overdue:0,dueSoon:120,defaultRate:0});
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
