import './styles.css';
import { onAuthStateChanged, signInWithEmailAndPassword, setPersistence, browserSessionPersistence, browserLocalPersistence, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, isEmulator } from './firebase.js';
import { loadCompany, saveCompany } from './database.js';
import { emptyProfile, profileFields, longFields, normalizeProfile, readBackup, errorMessage } from './validation.js';
import { prepareImage } from './assets.js';
import { icon, brand, escapeHtml as e, toast, downloadJson } from './ui.js';
import { mountClients, mountConsumption } from './clients.js';
import { mountImport } from './imports.js';
import { mountInvoices } from './invoices.js';
import { mountPayments } from './payments.js';
import { mountDashboard } from './dashboard.js';
import { registerPwa, mountInstall } from './pwa.js';

const root=document.querySelector('#app');
const baseUrl=import.meta.env.BASE_URL;
registerPwa();
let company=null, user=null, authorized=false, dirty=false, busy=false, stopAdmin, generation=0;
let images={logo:''};
const $=selector=>root.querySelector(selector);
const emulatorLabel=isEmulator?'<div class="environment">AMBIENTE LOCAL DE TESTES · sem dados de produção</div>':'';
function clearData() {company=null;images={logo:''};authorized=false;dirty=false;busy=false;}
function alertIn(id,message) {const el=$(id);if(el){el.textContent=message;el.hidden=!message;}}
function canLeave() {return !dirty || confirm('Há alterações não salvas. Deseja sair desta tela e descartá-las?');}
function network() {
  const offline=!navigator.onLine;
  root.querySelectorAll('[data-online]').forEach(el=>el.disabled=offline||busy);
  const banner=$('#network');if(banner)banner.hidden=!offline;
}
window.addEventListener('offline',network);window.addEventListener('online',network);
window.addEventListener('beforeunload',event=>{if(dirty||busy){event.preventDefault();event.returnValue='';}});

function loginScreen(message='') {
  root.innerHTML=`${emulatorLabel}<div class="login-layout">
    <section class="login-story"><a class="brand" href="#">${brand()}</a><div class="story-copy"><span class="eyebrow light">ENERGIA QUE APROXIMA</span><h1>Uma gestão clara.<br>Um futuro<br><em>mais sustentável.</em></h1><p>O espaço da TSP Energy Solar para organizar sua operação, com tudo no lugar.</p></div><div class="solar-scene" aria-hidden="true"><div class="sun-disc"></div><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="panel-grid"></div></div><div class="story-footer"><span class="tiny-dot"></span> SOLAR & ENERGIA SUSTENTÁVEL <span>01 / ACESSO</span></div></section>
    <section class="login-side"><div class="login-card"><div class="lock-mark">${icon('lock')}</div><span class="eyebrow">ÁREA ADMINISTRATIVA</span><h2>Bem-vindo de volta.</h2><p class="muted">Entre com sua conta para cuidar da sua operação.</p><form id="login-form"><label>E-mail<input name="email" type="email" autocomplete="username" placeholder="voce@empresa.com.br" required maxlength="200"></label><label>Senha<div class="password-wrap"><input name="password" id="password" type="password" autocomplete="current-password" required><button type="button" id="show-password" aria-controls="password" aria-pressed="false">Mostrar</button></div></label><div class="login-options"><label class="checkbox"><input name="remember" type="checkbox"> Manter conectado neste dispositivo</label></div><div id="login-error" class="notice error" role="alert" ${message?'':'hidden'}>${e(message)}</div><button class="button primary full" data-online type="submit">Entrar no sistema ${icon('arrow')}</button><button class="text-button full" id="reset-password" type="button">Esqueci minha senha</button></form><div class="access-note">${icon('shield')}<span>Acesso exclusivo a administradores autorizados.</span></div><a class="guide-link" href="${baseUrl}configuracao.html" target="_blank" rel="noopener">Consulte o manual de uso</a></div><footer class="login-footer">TSP ENERGY SOLAR</footer></section></div><div id="network" class="offline-banner" hidden>Sem conexão. Reconecte para entrar ou salvar alterações.</div>`;
  $('#show-password').onclick=()=>{const input=$('#password');const visible=input.type==='password';input.type=visible?'text':'password';$('#show-password').textContent=visible?'Ocultar':'Mostrar';$('#show-password').setAttribute('aria-pressed',String(visible));};
  $('#login-form').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget;if(!navigator.onLine)return network();
    const email=form.elements.email.value.trim(), password=form.elements.password.value;
    const button=form.querySelector('[type=submit]');button.disabled=true;button.textContent='Entrando…';alertIn('#login-error','');
    try {await setPersistence(auth,form.elements.remember.checked?browserLocalPersistence:browserSessionPersistence);await signInWithEmailAndPassword(auth,email,password);}
    catch(error){alertIn('#login-error',errorMessage(error));button.disabled=false;button.innerHTML=`Entrar no sistema ${icon('arrow')}`;}
    finally {form.elements.password.value='';}
  };
  $('#reset-password').onclick=async()=>{
    const input=$('#login-form').elements.email;
    if(!input.reportValidity())return;
    if(!navigator.onLine)return alertIn('#login-error','Reconecte para solicitar a recuperação.');
    const button=$('#reset-password');button.disabled=true;
    try {await sendPasswordResetEmail(auth,input.value.trim());toast('Se houver uma conta para esse e-mail, você receberá as instruções de recuperação.');}
    catch(error){alertIn('#login-error',errorMessage(error));}finally{button.disabled=false;}
  };
  network();
}

function accessScreen(title,message,loading=false) {
  root.innerHTML=`${emulatorLabel}<div class="access-page"><a class="brand dark" href="#">${brand()}</a><section class="access-card"><div class="lock-mark">${icon('shield')}</div><h1>${e(title)}</h1><p>${e(message)}</p>${loading?'<div class="spinner" role="status" aria-label="Verificando autorização"></div>':`<p class="muted small">Conta: ${e(user?.email)}</p><button id="retry-access" class="button primary">Verificar novamente</button><a class="button secondary" href="${baseUrl}configuracao.html" target="_blank" rel="noopener">Manual de uso</a>`}<button id="logout" class="text-button">Sair da conta</button></section></div>`;
  $('#logout').onclick=logout;
  if($('#retry-access'))$('#retry-access').onclick=()=>authorize(user);
}
async function logout() {
  if(busy){toast('Aguarde a conclusão do salvamento.');return;}
  if(!canLeave())return;
  try {await signOut(auth);}catch(error){toast(errorMessage(error));}
}
function authorize(account) {
  stopAdmin?.();const epoch=++generation;clearData();user=account;
  if(!account){loginScreen();return;}
  accessScreen('Verificando seu acesso','Confirmando a autorização administrativa com o servidor.',true);
  let loaded=false;
  const timer=setTimeout(()=>{if(epoch===generation&&!loaded)accessScreen('Não foi possível verificar o acesso','Confira sua conexão e tente novamente.');},12000);
  stopAdmin=onSnapshot(doc(db,'admins',account.uid),{includeMetadataChanges:true},async snapshot=>{
    if(epoch!==generation||snapshot.metadata.fromCache)return;
    clearTimeout(timer);
    if(!snapshot.exists()||snapshot.data().active!==true){++generation;stopAdmin?.();clearData();loaded=false;accessScreen('Conta sem autorização','O login foi reconhecido, mas esta conta não possui acesso administrativo.');return;}
    if(loaded)return;loaded=true;
    try {
      const result=await loadCompany();if(epoch!==generation)return;
      company=result;authorized=true;renderShell();
    } catch(error){loaded=false;authorized=false;accessScreen('Não foi possível carregar a empresa',errorMessage(error));}
  },error=>{clearTimeout(timer);if(epoch===generation){clearData();accessScreen('Acesso não confirmado',errorMessage(error));}});
}
onAuthStateChanged(auth,authorize);

function renderShell() {
  if(!authorized)return;
  root.innerHTML=`${emulatorLabel}<div class="app-layout"><aside class="sidebar" id="sidebar"><a class="brand" href="#overview">${brand(true)}</a><div class="workspace-label">PAINEL ADMINISTRATIVO</div><nav aria-label="Menu principal"><a data-nav="overview" href="#overview">${icon('grid')} Visão geral</a><a data-nav="settings" href="#settings">${icon('settings')} Configurações</a><a href="${baseUrl}configuracao.html" target="_blank" rel="noopener">${icon('file')} Manual de uso</a></nav><div class="sidebar-bottom"><div class="solar-note">${icon('sun')}<span>Energia solar.<br><strong>Gestão consciente.</strong></span></div><div class="user-block"><span class="avatar">${e((user.email||'A').charAt(0).toUpperCase())}</span><div><strong>Administrador</strong><small>${e(user.email)}</small></div><button id="logout" class="icon-button" aria-label="Sair da conta" title="Sair da conta">${icon('out')}</button></div></div></aside><div class="workspace"><header class="topbar"><button class="icon-button mobile-menu" id="menu-toggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="sidebar">${icon('menu')}</button><div class="breadcrumb">Área administrativa <span>/</span> <strong id="breadcrumb-page">Visão geral</strong></div><span class="secure-label">${icon('shield')} Acesso autorizado</span></header><div id="network" class="notice warning" hidden>Sem conexão. Você pode revisar o formulário, mas precisa reconectar para salvar.</div><main id="page" tabindex="-1"></main><footer class="workspace-footer">TSP ENERGY SOLAR</footer></div></div>`;
  root.querySelector('[data-nav="settings"]').insertAdjacentHTML('beforebegin',`<a data-nav="clients" href="#clients">${icon('users')} Clientes</a><a data-nav="consumption" href="#consumption">${icon('bolt')} Consumo mensal</a><a data-nav="import" href="#import">${icon('upload')} Importação de dados</a><a data-nav="invoices" href="#invoices">${icon('file')} Faturamento mensal</a><a data-nav="payments" href="#payments">${icon('check')} Contas a receber</a><a data-nav="install" href="#install">${icon('sun')} Instalar aplicativo</a>`);
  $('#logout').onclick=logout;
  $('#menu-toggle').onclick=()=>{const open=$('#sidebar').classList.toggle('open');$('#menu-toggle').setAttribute('aria-expanded',String(open));};
  root.querySelectorAll('[data-nav]').forEach(link=>link.onclick=event=>{event.preventDefault();navigate(link.dataset.nav);});
  const requested=location.hash.slice(1);const page=['overview','clients','consumption','import','invoices','payments','install','settings'].includes(requested)?requested:'overview';navigate(page,true);
}
function navigate(page,force=false) {
  if(busy){toast('Aguarde o salvamento.');return;}
  if(!force&&!canLeave())return;
  dirty=false;history.replaceState(null,'',`#${page}`);
  root.querySelectorAll('[data-nav]').forEach(link=>{const active=link.dataset.nav===page;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  $('#sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');
  const labels={overview:'Visão geral',clients:'Clientes',consumption:'Consumo mensal',import:'Importação de dados',invoices:'Faturamento mensal',payments:'Contas a receber',install:'Instalar aplicativo',settings:'Configurações'};
  $('#breadcrumb-page').textContent=labels[page];
  if(page==='settings')renderSettings();else if(page==='clients')mountClients($('#page'));else if(page==='consumption')mountConsumption($('#page'));else if(page==='import')mountImport($('#page'));else if(page==='invoices')mountInvoices($('#page'),company);else if(page==='payments')mountPayments($('#page'));else if(page==='install')mountInstall($('#page'));else mountDashboard($('#page'),company,navigate);
  network();
}
const fields={
  legalName:['Razão social','text',true],tradeName:['Nome fantasia','text',true],cnpj:['CNPJ','text'],beneficiaryCpf:['CPF do beneficiário, se aplicável','text'],pixBeneficiary:['Nome do beneficiário do PIX','text'],pixKey:['Chave PIX','text'],bank:['Banco (opcional)','text'],bankDetails:['Dados bancários (opcional)','textarea'],phone:['Telefone','tel'],whatsapp:['WhatsApp','tel'],email:['E-mail','email'],address:['Endereço completo','textarea'],city:['Cidade do beneficiário PIX','text'],contract:['Informações contratuais','textarea'],notices:['Avisos impressos nas faturas','textarea'],whatsappTemplate:['Mensagem padrão de WhatsApp','textarea'],emailTemplate:['Mensagem padrão de e-mail','textarea'],dueDay:['Dia padrão de vencimento','number']
};
function field(key,p,wide=false) {
  const [label,type,required]=fields[key];
  const common=`name="${key}" id="field-${key}" ${required?'required':''} ${key==='dueDay'?'min="1" max="31" step="1"':`maxlength="${longFields.includes(key)?3000:200}"`} ${['cnpj','beneficiaryCpf'].includes(key)?'inputmode="numeric"':''}`;
  return `<label class="field ${wide?'span-two':''}">${label}${required?'<span class="required"> *</span>':''}${type==='textarea'?`<textarea ${common} rows="3">${e(p[key])}</textarea>`:`<input type="${type}" ${common} value="${e(p[key])}" ${key==='dueDay'?'placeholder="Opcional"':''}>`}</label>`;
}
function imageField(kind,label) {
  return `<div class="asset-field"><div id="preview-${kind}" class="asset-preview">${images[kind]?`<img src="${e(images[kind])}" alt="${label}">`:icon(kind==='logo'?'sun':'file')}</div><div><strong>${label}</strong><p class="small muted">PNG, JPG ou WebP · até 5 MB na seleção</p><label class="button secondary small-button">${icon('upload')} Escolher imagem<input type="file" id="file-${kind}" accept="image/png,image/jpeg,image/webp" class="file-input"></label><button type="button" class="text-button" id="remove-${kind}" ${images[kind]?'':'hidden'}>Remover</button></div></div>`;
}
function renderSettings(override) {
  const p=override?.profile || company?.profile || emptyProfile();
  images={logo:override?.logo??company?.logo??''};
  $('#page').innerHTML=`<div class="page-heading"><div><span class="eyebrow">DO SEU JEITO</span><h1>Configurações da empresa</h1><p>As informações que identificam a TSP Energy nas suas faturas.</p></div></div><div class="settings-toolbar"><span>${icon('shield')} Dados visíveis apenas para administradores</span><div><label class="button secondary small-button">${icon('upload')} Importar configurações<input id="import-settings" type="file" accept=".json,application/json" class="file-input"></label><button id="export-settings" class="button secondary small-button" type="button">Exportar rascunho</button></div></div>${!company?'<div class="notice info">Importe o arquivo de configurações, revise os campos e clique em Salvar.</div>':''}<form id="settings-form"><fieldset id="settings-fields"><section class="form-section"><div class="section-heading"><span class="section-number">01</span><div><h2>Identidade e contato</h2><p>Dados de identificação da empresa geradora.</p></div></div>${imageField('logo','Logotipo da empresa')}<div class="form-grid">${['legalName','tradeName','cnpj','email','phone','whatsapp'].map(k=>field(k,p)).join('')}${field('address',p,true)}</div></section><section class="form-section"><div class="section-heading"><span class="section-number">02</span><div><h2>Recebimento e PIX</h2><p>Utilize os dados confirmados pelo titular da conta.</p></div></div><div class="form-grid">${['pixBeneficiary','beneficiaryCpf','pixKey','city','bank','dueDay'].map(k=>field(k,p)).join('')}${field('bankDetails',p,true)}</div><p class="field-help">O dia padrão é opcional. Quando definido, meses mais curtos usarão o último dia disponível.</p><p class="field-help">O QR Code PIX é gerado automaticamente em cada fatura com a chave, o beneficiário, a cidade e o valor da cobrança.</p></section><section class="form-section"><div class="section-heading"><span class="section-number">03</span><div><h2>Contrato e comunicação</h2><p>Textos que serão utilizados na emissão e no compartilhamento.</p></div></div><div class="form-grid">${['contract','notices','whatsappTemplate','emailTemplate'].map(k=>field(k,p,true)).join('')}</div><p class="field-help">Variáveis para mensagens: {cliente}, {referencia}, {vencimento} e {total}.</p></section></fieldset><div id="save-error" class="notice error" role="alert" hidden></div><div class="save-bar"><div><strong id="save-state">${override?'Rascunho importado · revise antes de salvar':company?'Tudo salvo':'Configurações ainda não salvas'}</strong><small id="save-time">Revise os dados antes de salvar.</small></div><button id="reload-settings" type="button" class="button secondary" data-online>Recarregar</button><button type="submit" class="button primary" id="save-settings" data-online>${icon('check')} Salvar configurações</button></div></form>`;
  $('#settings-form').addEventListener('input',()=>{dirty=true;$('#save-state').textContent='Alterações não salvas';});
  for(const kind of ['logo']){
    $(`#file-${kind}`).onchange=async event=>{
      const file=event.target.files[0];if(!file)return;
      try{images[kind]=await prepareImage(file,kind);updateImage(kind);dirty=true;$('#save-state').textContent='Alterações não salvas';}
      catch(error){alertIn('#save-error',errorMessage(error));}finally{event.target.value='';}
    };
    $(`#remove-${kind}`).onclick=()=>{if(confirm('Remover esta imagem do rascunho? A alteração só será gravada ao salvar.')){images[kind]='';updateImage(kind);dirty=true;$('#save-state').textContent='Alterações não salvas';}};
  }
  $('#settings-form').onsubmit=saveSettings;
  $('#reload-settings').onclick=async()=>{if(!canLeave())return;const button=$('#reload-settings');button.disabled=true;button.textContent='Carregando…';try{company=await loadCompany();dirty=false;renderSettings();network();}catch(error){alertIn('#save-error',errorMessage(error));button.disabled=false;button.textContent='Recarregar';}};
  $('#export-settings').onclick=()=>{try{downloadJson({schemaVersion:1,...formValues()},'tsp-configuracoes-rascunho.json');toast('Rascunho exportado. Guarde este arquivo em local privado.');}catch(error){alertIn('#save-error',errorMessage(error));}};
  $('#import-settings').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    try{if(file.size>400000)throw new Error('O arquivo excede o tamanho permitido.');const parsed=readBackup(JSON.parse(await file.text()));if(!canLeave())return;renderSettings(parsed);dirty=true;network();toast('Dados importados para revisão. Clique em Salvar para confirmar.');}
    catch(error){alertIn('#save-error',error instanceof SyntaxError?'O arquivo não é um JSON válido.':errorMessage(error));}
    finally{event.target.value='';}
  };
}
function updateImage(kind) {
  $(`#preview-${kind}`).innerHTML=images[kind]?`<img src="${e(images[kind])}" alt="${kind==='logo'?'Logotipo':'QR Code PIX'}">`:icon(kind==='logo'?'sun':'file');
  $(`#remove-${kind}`).hidden=!images[kind];
}
function formValues() {return {profile:normalizeProfile(Object.fromEntries(new FormData($('#settings-form')))),logo:images.logo,pixQr:''};}
async function saveSettings(event) {
  event.preventDefault();if(busy)return;alertIn('#save-error','');
  const values=formValues();
  const epoch=generation;busy=true;$('#settings-fields').disabled=true;network();$('#save-settings').textContent='Salvando…';$('#save-state').textContent='Aguardando confirmação do servidor…';
  try {
    const saved=await saveCompany(values,company?.revision||0);
    if(epoch!==generation)return;
    company={schemaVersion:1,...values,...saved,updatedBy:user.uid,updatedAt:null};dirty=false;
    try{company=await loadCompany();}catch{toast('Salvamento confirmado. Não foi possível reler o horário do servidor.');}
    if(epoch!==generation)return;
    renderSettings();$('#save-state').textContent='Configurações salvas';toast('Configurações salvas com sucesso.');
  }catch(error){if(epoch===generation){alertIn('#save-error',errorMessage(error));$('#save-state').textContent='Não foi possível salvar. Revise a mensagem abaixo.';}}
  finally{if(epoch===generation){busy=false;if($('#settings-fields'))$('#settings-fields').disabled=false;if($('#save-settings'))$('#save-settings').innerHTML=`${icon('check')} Salvar configurações`;network();}}
}
