import './styles.css';
import './portal.css';
import {onAuthStateChanged,signInWithEmailAndPassword,sendPasswordResetEmail,signOut,setPersistence,browserLocalPersistence,browserSessionPersistence} from 'firebase/auth';
import {collection,doc,getDocFromServer,getDocsFromServer,query,where} from 'firebase/firestore';
import {auth,db,isEmulator} from './firebase.js';
import {financialRows,financialSummary,financeStatusLabels} from './finance.js';
import {createInvoicePdf,downloadPdf} from './invoice-pdf.js';
import {escapeHtml as e,icon,toast,brand} from './ui.js';

const root=document.querySelector('#portal-root'),version=__APP_VERSION__;
const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
const number=value=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(Number(value)||0);
const date=value=>value?String(value).split('-').reverse().join('/'):'—';
const month=value=>value?`${String(value).slice(5,7)}/${String(value).slice(0,4)}`:'—';
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});

function loginScreen(message=''){
  root.innerHTML=`${isEmulator?'<div class="environment">AMBIENTE LOCAL DE TESTE</div>':''}<main class="portal-login"><section class="portal-login-brand"><div class="portal-login-copy"><span class="eyebrow light">ÁREA DO CLIENTE</span><h1>Sua energia,<br><em>sempre à vista.</em></h1><p>Acompanhe faturas, pagamentos e histórico de consumo em um só lugar.</p></div></section><section class="portal-login-form"><div class="portal-login-card"><a class="brand dark" href="./portal.html">${brand(false)}</a><span class="eyebrow">ACESSO DO CLIENTE</span><h2>Entre na sua conta</h2><p class="muted">Use o e-mail cadastrado pela TSP Energy Solar.</p><form id="portal-login-form"><label>E-mail<input name="email" type="email" autocomplete="username" required></label><label>Senha<input name="password" type="password" autocomplete="current-password" required></label><label class="checkbox"><input name="remember" type="checkbox" checked> Manter conectado neste dispositivo</label><div id="portal-login-error" class="notice error" ${message?'':'hidden'}>${e(message)}</div><button class="button primary full" type="submit">Entrar ${icon('arrow')}</button><button class="text-button full" id="portal-reset" type="button">Criar ou redefinir minha senha</button></form><p class="portal-help">O acesso precisa ser liberado pela TSP Energy Solar para o e-mail do seu cadastro.</p><a class="guide-link" href="./">Acesso administrativo</a></div><footer>TSP ENERGY SOLAR <span>Versão ${e(version)}</span></footer></section></main>`;
  const form=document.querySelector('#portal-login-form'),error=document.querySelector('#portal-login-error');
  form.onsubmit=async event=>{event.preventDefault();const values=new FormData(form),button=form.querySelector('[type=submit]');error.hidden=true;button.disabled=true;button.textContent='Entrando…';try{await setPersistence(auth,values.get('remember')?browserLocalPersistence:browserSessionPersistence);await signInWithEmailAndPassword(auth,String(values.get('email')).trim(),String(values.get('password')));}catch(ex){error.textContent=loginMessage(ex);error.hidden=false;button.disabled=false;button.innerHTML=`Entrar ${icon('arrow')}`;}};
  document.querySelector('#portal-reset').onclick=async()=>{const email=String(form.email.value||'').trim();if(!email){error.textContent='Informe seu e-mail para criar ou redefinir a senha.';error.hidden=false;form.email.focus();return;}try{await sendPasswordResetEmail(auth,email);toast('Enviamos o e-mail para criar ou redefinir sua senha. Confira também a caixa de spam.');}catch(ex){error.textContent=loginMessage(ex);error.hidden=false;}};
}

function loginMessage(error){
  if(['auth/invalid-credential','auth/user-not-found','auth/wrong-password'].includes(error?.code))return 'E-mail ou senha incorretos.';
  if(error?.code==='auth/too-many-requests')return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if(error?.code==='auth/invalid-email')return 'Informe um e-mail válido.';
  return error?.message||'Não foi possível entrar agora.';
}

async function loadPortal(user){
  root.innerHTML='<div class="portal-loading"><div class="spinner"></div><p>Carregando sua área…</p></div>';
  const accountSnap=await getDocFromServer(doc(db,'customerAccounts',user.uid));
  if(!accountSnap.exists()||accountSnap.data().active!==true){await signOut(auth);throw new Error('Este e-mail ainda não possui acesso ativo. Entre em contato com a TSP Energy Solar.');}
  const account=accountSnap.data(),clientRef=doc(db,'clients',account.clientId);
  const [clientSnap,consumptionSnap,invoiceSnap,paymentSnap,settingsSnap]=await Promise.all([
    getDocFromServer(clientRef),
    getDocsFromServer(query(collection(db,'consumptions'),where('clientId','==',account.clientId))),
    getDocsFromServer(query(collection(db,'invoices'),where('clientId','==',account.clientId))),
    getDocsFromServer(query(collection(db,'payments'),where('clientId','==',account.clientId))),
    getDocFromServer(doc(db,'portalSettings','company'))
  ]);
  if(!clientSnap.exists())throw new Error('Seu cadastro não foi encontrado. Entre em contato com a TSP Energy Solar.');
  const consumptions=consumptionSnap.docs.map(x=>x.data()).sort((a,b)=>b.reference.localeCompare(a.reference));
  const invoices=invoiceSnap.docs.map(x=>x.data()).sort((a,b)=>b.reference.localeCompare(a.reference));
  const payments=paymentSnap.docs.map(x=>x.data());
  renderPortal(user,clientSnap.data(),consumptions,invoices,payments,settingsSnap.exists()?settingsSnap.data():null);
}

function renderPortal(user,client,consumptions,invoices,payments,company){
  const rows=financialRows(invoices,payments,today()),summary=financialSummary(rows,today());
  const effective=rows.filter(x=>x.isEffective),paid=effective.filter(x=>x.status==='paid').length,pending=effective.filter(x=>x.balance>.009).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  const next=pending.find(x=>x.dueDate>=today())||pending[0],max=Math.max(1,...consumptions.slice(0,12).map(x=>Number(x.measuredConsumption)||0));
  root.innerHTML=`<div class="portal-shell"><header class="portal-header"><a class="brand" href="#resumo">${brand(true,company?.logo||'')}</a><div class="portal-user"><div><strong>${e(client.name)}</strong><small>${e(user.email)}</small></div><button class="button portal-logout" id="portal-logout" type="button">Sair</button></div></header><nav class="portal-nav"><a href="#resumo" class="active">${icon('grid')}<span>Resumo</span></a><a href="#faturas">${icon('file')}<span>Faturas</span></a><a href="#consumos">${icon('bolt')}<span>Consumos</span></a><a href="#cadastro">${icon('users')}<span>Cadastro</span></a></nav><main class="portal-main"><section id="resumo" class="portal-welcome"><div><span class="eyebrow light">OLÁ, ${e(client.name.split(' ')[0].toUpperCase())}</span><h1>Acompanhe sua energia</h1><p>Consulte seus valores, vencimentos e consumos atualizados.</p></div><div class="portal-unit"><span>Unidade consumidora</span><strong>${e(client.installationNumber||'—')}</strong></div></section><section class="portal-metrics"><article><span>Total pendente</span><strong>${money(summary.pending)}</strong><small>${pending.length} fatura${pending.length===1?'':'s'} com saldo</small></article><article><span>Total já pago</span><strong>${money(summary.received)}</strong><small>${paid} fatura${paid===1?'':'s'} quitada${paid===1?'':'s'}</small></article><article><span>Próximo vencimento</span><strong>${next?date(next.dueDate):'Em dia'}</strong><small>${next?`${month(next.reference)} · ${money(next.balance)}`:'Nenhuma pendência'}</small></article><article><span>Último consumo</span><strong>${consumptions[0]?`${number(consumptions[0].measuredConsumption)} kWh`:'—'}</strong><small>${consumptions[0]?month(consumptions[0].reference):'Sem lançamento'}</small></article></section><section id="faturas" class="portal-section"><div class="portal-section-head"><div><span class="eyebrow">MINHAS FATURAS</span><h2>Faturas e pagamentos</h2></div><span class="portal-count">${rows.length} registro${rows.length===1?'':'s'}</span></div>${rows.length?`<div class="portal-invoice-list">${rows.map(row=>invoiceCard(row,payments)).join('')}</div>`:'<div class="portal-empty">Nenhuma fatura emitida até o momento.</div>'}</section><section id="consumos" class="portal-section"><div class="portal-section-head"><div><span class="eyebrow">HISTÓRICO</span><h2>Consumo mensal</h2></div><span class="portal-count">kWh</span></div>${consumptions.length?`<div class="portal-chart">${consumptions.slice(0,12).reverse().map(item=>`<div><b>${number(item.measuredConsumption)}</b><span style="height:${Math.max(8,Number(item.measuredConsumption)/max*130)}px"></span><small>${month(item.reference)}</small></div>`).join('')}</div><div class="portal-consumption-list">${consumptions.map(item=>`<article><div><strong>${month(item.reference)}</strong><small>Leitura ${date(item.currentReadDate)}</small></div><b>${number(item.measuredConsumption)} kWh</b><span>${number(item.previousReading)} → ${number(item.currentReading)}</span></article>`).join('')}</div>`:'<div class="portal-empty">Nenhum consumo registrado até o momento.</div>'}</section><section id="cadastro" class="portal-section"><div class="portal-section-head"><div><span class="eyebrow">MEUS DADOS</span><h2>Unidade consumidora</h2></div></div><div class="portal-profile"><div><span>Cliente</span><strong>${e(client.name)}</strong></div><div><span>CPF/CNPJ</span><strong>${e(client.taxId||'—')}</strong></div><div><span>Instalação</span><strong>${e(client.installationNumber||'—')}</strong></div><div><span>Medidor</span><strong>${e(client.meterNumber||'—')}</strong></div><div><span>Fornecimento</span><strong>${e(client.supplyType||'—')}</strong></div><div><span>Contato</span><strong>${e(client.email||user.email)}</strong></div></div></section></main><footer class="portal-footer">TSP ENERGY SOLAR <span>Versão ${e(version)}</span></footer></div>`;
  document.querySelector('#portal-logout').onclick=()=>signOut(auth);
  document.querySelectorAll('[data-invoice]').forEach(button=>button.onclick=async()=>{const invoice=invoices.find(x=>x.id===button.dataset.invoice);if(!invoice||!company)return;button.disabled=true;button.textContent='Preparando…';try{const bytes=await createInvoicePdf(invoice,company);downloadPdf(bytes,`fatura-${invoice.reference}-${invoice.id.slice(0,8)}.pdf`);}catch(ex){toast(ex.message||'Não foi possível gerar a fatura.');}finally{button.disabled=false;button.textContent='Baixar fatura em PDF';}});
  const navLinks=[...document.querySelectorAll('.portal-nav a')];navLinks.forEach(link=>link.onclick=()=>{navLinks.forEach(x=>x.classList.remove('active'));link.classList.add('active');});
}

function invoiceCard(row,payments){
  const records=payments.filter(x=>x.invoiceId===row.id&&x.status==='active');
  return `<article class="portal-invoice-card"><div class="portal-invoice-main"><div class="portal-month"><span>${month(row.reference)}</span><small>Vence ${date(row.dueDate)}</small></div><div><span>Valor da fatura</span><strong>${money(row.total)}</strong></div><div><span>Valor pago</span><strong>${money(row.received)}</strong></div><div><span>Saldo</span><strong>${money(row.balance)}</strong></div><span class="status-badge ${e(row.status)}">${e(financeStatusLabels[row.status])}</span></div><details><summary>Ver detalhes</summary><div class="portal-invoice-detail"><div><span>Emissão</span><strong>${date(row.issueDate)}</strong></div><div><span>Consumo</span><strong>${number(row.consumption?.measuredConsumption)} kWh</strong></div><div><span>Tarifa aplicada</span><strong>${money(row.consumption?.saleTariff)}/kWh</strong></div><div><span>Identificador</span><strong>${e(row.id.slice(0,8).toUpperCase())}</strong></div></div>${records.length?`<div class="portal-payments"><strong>Pagamentos registrados</strong>${records.map(item=>`<p>${date(item.paymentDate)} · ${money(item.amount)} · ${e(item.method)}</p>`).join('')}</div>`:''}<button class="button secondary small-button" data-invoice="${e(row.id)}" ${row.status==='cancelled'?'disabled':''}>Baixar fatura em PDF</button></details></article>`;
}

let booting=true;
onAuthStateChanged(auth,async user=>{try{if(user)await loadPortal(user);else loginScreen();}catch(error){loginScreen(error.message);}finally{booting=false;}});
if('serviceWorker' in navigator&&!isEmulator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
