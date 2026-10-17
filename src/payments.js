import {listInvoices,listPayments,savePayment,cancelPayment} from './database.js';
import {downloadRows} from './spreadsheets.js';
import {financialRows,financialSummary,agingSummary,financeStatusLabels} from './finance.js';
import {escapeHtml as e,toast,icon,formatTime} from './ui.js';

const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
const decimal=value=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(value)||0);
const date=value=>value?value.split('-').reverse().join('/'):'—';
const month=value=>value?`${value.slice(5,7)}/${value.slice(0,4)}`:'—';
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
const openStatuses=new Set(['pending','partial','overdue']);
const statusClass=status=>['overdue','cancelled','superseded'].includes(status)?'inactive':status;

export async function mountPayments(container){
  container.innerHTML='<div class="loading-card"><div class="spinner"></div><p>Carregando gestão financeira…</p></div>';
  try{render(container,...await Promise.all([listInvoices(),listPayments()]));}
  catch(error){container.innerHTML=`<div class="notice error">${e(error.message)}</div>`;}
}

function render(container,invoices,payments){
  const currentDay=today(),rows=financialRows(invoices,payments,currentDay);
  const references=[...new Set(rows.map(row=>row.reference).filter(Boolean))].sort().reverse();
  const clients=[...new Map(rows.map(row=>[row.clientId,{id:row.clientId,name:row.client?.name||'Cliente sem nome'}])).values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  const state={view:'open',reference:'',clientId:'',term:''};

  container.innerHTML=`<div class="page-heading"><div><span class="eyebrow">GESTÃO FINANCEIRA</span><h1>Contas a receber</h1><p>Controle cobranças, pagamentos, atrasos e o extrato de cada cliente.</p></div><div class="finance-export"><button class="button secondary small-button" id="finance-csv">CSV</button><button class="button secondary small-button" id="finance-xlsx">${icon('file')} Excel</button></div></div><div id="finance-content"></div>`;
  const host=container.querySelector('#finance-content');
  const filteredRows=()=>rows.filter(row=>{
    const matchesView=state.view==='all'||(state.view==='open'?openStatuses.has(row.status):row.status===state.view);
    const haystack=`${row.client?.name||''} ${row.id||''} ${row.reference||''} ${row.client?.installationNumber||''}`.toLocaleLowerCase('pt-BR');
    return matchesView&&(!state.reference||row.reference===state.reference)&&(!state.clientId||row.clientId===state.clientId)&&(!state.term||haystack.includes(state.term));
  });
  const exportReport=async format=>{
    const exportRows=filteredRows();if(!exportRows.length){toast('Não há registros no filtro atual.');return;}
    await downloadRows([['Cliente','Instalação','Fatura','Referência','Vencimento','Total','Recebido','Saldo','Situação','Dias em atraso'],...exportRows.map(row=>[row.client?.name||'',row.client?.installationNumber||'',row.id,row.reference,row.dueDate,row.total,row.received,row.balance,financeStatusLabels[row.status],row.daysOverdue||0])],`contas-a-receber-${currentDay}`,format,'Contas a receber');
  };
  container.querySelector('#finance-csv').onclick=()=>exportReport('csv');
  container.querySelector('#finance-xlsx').onclick=()=>exportReport('xlsx');

  function draw(){
    const visible=filteredRows(),summary=financialSummary(rows,currentDay),aging=agingSummary(rows);
    const supersededWithPayment=rows.filter(row=>row.status==='superseded'&&row.received>.009).length;
    host.innerHTML=`<div class="metrics-grid finance-metrics">${[['Faturado',money(summary.billed)],['Recebido',money(summary.received)],['Em aberto',money(summary.pending)],['Vencido',money(summary.overdue)],['Vence em 7 dias',money(summary.dueSoon)],['Inadimplência',`${decimal(summary.defaultRate)}%`]].map(([label,value])=>`<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`).join('')}</div>
      <section class="aging-panel" aria-label="Faixas de atraso">${[['A vencer',aging.current],['1 a 7 dias',aging.days1to7],['8 a 30 dias',aging.days8to30],['31 a 60 dias',aging.days31to60],['Mais de 60 dias',aging.over60]].map(([label,value])=>`<div><span>${label}</span><strong>${money(value)}</strong></div>`).join('')}</section>
      ${supersededWithPayment?`<div class="notice warning">${supersededWithPayment} fatura substituída possui pagamento registrado. Revise o histórico antes de fazer qualquer correção.</div>`:''}
      <section class="finance-controls"><div class="finance-tabs" role="tablist" aria-label="Situação financeira">${[['open','Em aberto'],['overdue','Vencidas'],['partial','Parciais'],['paid','Pagas'],['superseded','Substituídas'],['cancelled','Canceladas'],['all','Todas']].map(([value,label])=>`<button class="finance-tab ${state.view===value?'active':''}" data-view="${value}">${label}</button>`).join('')}</div><div class="finance-filters"><label class="search-field">${icon('search')}<input id="finance-search" value="${e(state.term)}" placeholder="Cliente, instalação ou fatura"></label><select id="finance-reference" aria-label="Filtrar referência"><option value="">Todas as referências</option>${references.map(ref=>`<option value="${ref}" ${ref===state.reference?'selected':''}>${month(ref)}</option>`).join('')}</select><select id="finance-client" aria-label="Filtrar cliente"><option value="">Todos os clientes</option>${clients.map(client=>`<option value="${e(client.id)}" ${client.id===state.clientId?'selected':''}>${e(client.name)}</option>`).join('')}</select></div></section>
      <div id="payment-editor"></div><div class="finance-result"><strong>${visible.length}</strong> registro${visible.length===1?'':'s'} no filtro atual</div>
      ${visible.length?`<div class="table-wrap"><table class="finance-table"><thead><tr><th>Cliente</th><th>Fatura</th><th>Vencimento</th><th>Total</th><th>Recebido</th><th>Saldo</th><th>Situação</th><th></th></tr></thead><tbody>${visible.map(row=>`<tr><td><strong>${e(row.client?.name||'—')}</strong><small>${e(row.client?.installationNumber||'Sem instalação')}</small></td><td>${e(row.id.slice(0,8).toUpperCase())}<small>${month(row.reference)}</small></td><td>${date(row.dueDate)}${row.daysOverdue?`<small>${row.daysOverdue} dia${row.daysOverdue===1?'':'s'} em atraso</small>`:''}</td><td>${money(row.total)}</td><td>${money(row.received)}</td><td><strong>${money(row.balance)}</strong></td><td><span class="status-badge ${statusClass(row.status)}">${financeStatusLabels[row.status]}</span></td><td><button class="text-button" data-open="${e(row.id)}">${row.balance>.009&&row.isEffective?'Registrar':'Detalhes'}</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><h2>Nenhum registro encontrado</h2><p>Altere os filtros para consultar outras cobranças.</p></div>'}`;

    host.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{state.view=button.dataset.view;draw();});
    host.querySelector('#finance-search').oninput=event=>{state.term=event.target.value.trim().toLocaleLowerCase('pt-BR');draw();const input=host.querySelector('#finance-search');input.focus();input.setSelectionRange(input.value.length,input.value.length);};
    host.querySelector('#finance-reference').onchange=event=>{state.reference=event.target.value;draw();};
    host.querySelector('#finance-client').onchange=event=>{state.clientId=event.target.value;draw();};
    host.querySelectorAll('[data-open]').forEach(button=>button.onclick=()=>openEditor(rows.find(row=>row.id===button.dataset.open)));
  }

  function openEditor(invoice){
    const editorHost=host.querySelector('#payment-editor'),records=payments.filter(payment=>payment.invoiceId===invoice.id);
    const clientRows=rows.filter(row=>row.clientId===invoice.clientId).sort((a,b)=>String(b.reference).localeCompare(String(a.reference)));
    const canReceive=invoice.isEffective&&invoice.balance>.009;
    editorHost.innerHTML=`<section class="form-section payment-editor"><div class="section-heading"><span class="section-number">R$</span><div><h2>${e(invoice.client?.name||'Cliente')}</h2><p>Fatura ${e(invoice.id.slice(0,8).toUpperCase())} · ${month(invoice.reference)} · saldo ${money(invoice.balance)}</p></div><button class="text-button editor-close" type="button">Fechar</button></div><div class="invoice-summary finance-detail-summary"><span>Total<strong>${money(invoice.total)}</strong></span><span>Recebido<strong>${money(invoice.received)}</strong></span><span>Saldo<strong>${money(invoice.balance)}</strong></span><span>Vencimento<strong>${date(invoice.dueDate)}</strong></span></div>
      ${invoice.status==='superseded'?'<div class="notice info">Esta versão foi substituída por uma fatura corrigida. Ela permanece somente no histórico e não compõe o saldo financeiro.</div>':''}${invoice.status==='cancelled'?`<div class="notice info">Fatura cancelada. ${e(invoice.cancellationReason||'')}</div>`:''}
      ${canReceive?`<form id="payment-form"><div class="form-grid"><label class="field">Data do pagamento<input name="paymentDate" type="date" value="${currentDay}" required></label><label class="field">Valor recebido<input name="amount" type="number" min="0.01" max="${invoice.balance.toFixed(2)}" step="0.01" value="${invoice.balance.toFixed(2)}" required></label><label class="field">Forma de pagamento<select name="method"><option>PIX</option><option>Transferência</option><option>Dinheiro</option><option>Cartão</option><option>Depósito</option><option>Outro</option></select></label><label class="field span-two">Observações<textarea name="notes" maxlength="3000" placeholder="Ex.: comprovante conferido pelo administrador"></textarea></label></div><div id="payment-error" class="notice error" hidden></div><div class="form-actions"><button class="button secondary" type="button" id="fill-balance">Preencher saldo</button><button class="button primary" data-online type="submit">${icon('check')} Registrar pagamento</button></div></form>`:invoice.isEffective&&invoice.status==='paid'?'<div class="notice info">Pagamento integral registrado.</div>':''}
      <h3>Histórico desta fatura</h3>${records.length?`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Valor</th><th>Forma</th><th>Situação</th><th></th></tr></thead><tbody>${records.map(payment=>`<tr><td>${date(payment.paymentDate)}<small>${e(formatTime(payment.createdAt))}</small></td><td>${money(payment.amount)}</td><td>${e(payment.method)}</td><td>${payment.status==='active'?'Ativo':`Cancelado: ${e(payment.cancellationReason)}`}</td><td>${payment.status==='active'?`<button class="text-button" data-cancel="${e(payment.id)}">Cancelar registro</button>`:'—'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">Nenhum pagamento registrado.</p>'}
      <details class="client-statement" open><summary>Extrato financeiro do cliente</summary><div class="table-wrap"><table><thead><tr><th>Referência</th><th>Vencimento</th><th>Total</th><th>Recebido</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>${clientRows.map(row=>`<tr><td>${month(row.reference)}</td><td>${date(row.dueDate)}</td><td>${money(row.total)}</td><td>${money(row.received)}</td><td>${money(row.balance)}</td><td>${financeStatusLabels[row.status]}</td></tr>`).join('')}</tbody></table></div></details></section>`;
    editorHost.scrollIntoView({behavior:'smooth',block:'start'});editorHost.querySelector('.editor-close').onclick=()=>editorHost.innerHTML='';
    const form=editorHost.querySelector('#payment-form');if(form){editorHost.querySelector('#fill-balance').onclick=()=>{form.elements.amount.value=invoice.balance.toFixed(2);};form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type=submit]'),error=editorHost.querySelector('#payment-error'),data=Object.fromEntries(new FormData(form));error.hidden=true;if(Number(data.amount)>invoice.balance+.009){error.textContent='O valor não pode ser maior que o saldo da fatura.';error.hidden=false;return;}try{button.disabled=true;await savePayment(invoice.id,data);toast('Pagamento registrado com sucesso.');await mountPayments(container);}catch(ex){error.textContent=ex.message;error.hidden=false;button.disabled=false;}};}
    editorHost.querySelectorAll('[data-cancel]').forEach(button=>button.onclick=async()=>{const reason=prompt('Informe o motivo do cancelamento deste registro:');if(!reason?.trim())return;try{button.disabled=true;await cancelPayment(button.dataset.cancel,reason);toast('Pagamento cancelado com histórico preservado.');await mountPayments(container);}catch(ex){toast(ex.message);button.disabled=false;}});
  }
  draw();
}
