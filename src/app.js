import './styles.css';
import { onAuthStateChanged, signInWithEmailAndPassword, setPersistence, browserSessionPersistence, browserLocalPersistence, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, isEmulator } from './firebase.js';
import { loadCompany, saveCompany, loadHistory } from './database.js';
import { emptyProfile, profileFields, longFields, normalizeProfile, readBackup, errorMessage } from './validation.js';
import { prepareImage } from './assets.js';
import { icon, brand, escapeHtml as e, toast, downloadJson, formatTime } from './ui.js';
import { mountClients, mountConsumption } from './clients.js';

const root=document.querySelector('#app');
let company=null, user=null, authorized=false, dirty=false, busy=false, currentPage='overview', stopAdmin, generation=0;
let images={logo:'',pixQr:''};
const $=selector=>root.querySelector(selector);
const emulatorLabel=isEmulator?'<div class="environment">AMBIENTE LOCAL DE TESTES · sem dados de produção</div>':'';
function clearData() {company=null;images={logo:'',pixQr:''};authorized=false;dirty=false;busy=false;}
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
    <section class="login-side"><div class="login-card"><div class="lock-mark">${icon('lock')}</div><span class="eyebrow">ÁREA ADMINISTRATIVA</span><h2>Bem-vindo de volta.</h2><p class="muted">Entre com sua conta para cuidar da sua operação.</p><form id="login-form"><label>E-mail<input name="email" type="email" autocomplete="username" placeholder="voce@empresa.com.br" required maxlength="200"></label><label>Senha<div class="password-wrap"><input name="password" id="password" type="password" autocomplete="current-password" required><button type="button" id="show-password" aria-controls="password" aria-pressed="false">Mostrar</button></div></label><div class="login-options"><label class="checkbox"><input name="remember" type="checkbox"> Manter conectado neste dispositivo</label></div><div id="login-error" class="notice error" role="alert" ${message?'':'hidden'}>${e(message)}</div><button class="button primary full" data-online type="submit">Entrar no sistema ${icon('arrow')}</button><button class="text-button full" id="reset-password" type="button">Esqueci minha senha</button></form><div class="access-note">${icon('shield')}<span>Acesso exclusivo a administradores autorizados.</span></div><a class="guide-link" href="/configuracao.html" target="_blank" rel="noopener">Primeiro acesso? Veja como configurar</a></div><footer class="login-footer">TSP ENERGY SOLAR <span>Gestão de energia, com clareza.</span></footer></section></div><div id="network" class="offline-banner" hidden>Sem conexão. Reconecte para entrar ou salvar alterações.</div>`;
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
  root.innerHTML=`${emulatorLabel}<div class="access-page"><a class="brand dark" href="#">${brand()}</a><section class="access-card"><div class="lock-mark">${icon('shield')}</div><h1>${e(title)}</h1><p>${e(message)}</p>${loading?'<div class="spinner" role="status" aria-label="Verificando autorização"></div>':`<p class="muted small">Conta: ${e(user?.email)}<br>UID: <code>${e(user?.uid)}</code></p><button id="retry-access" class="button primary">Verificar novamente</button><a class="button secondary" href="/configuracao.html" target="_blank" rel="noopener">Guia de configuração</a>`}<button id="logout" class="text-button">Sair da conta</button></section></div>`;
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
  const timer=setTimeout(()=>{if(epoch===generation&&!loaded)accessScreen('Não foi possível verificar o acesso','Confira a conexão e a configuração do Firestore. Seus dados não foram carregados.');},12000);
  stopAdmin=onSnapshot(doc(db,'admins',account.uid),{includeMetadataChanges:true},async snapshot=>{
    if(epoch!==generation||snapshot.metadata.fromCache)return;
    clearTimeout(timer);
    if(!snapshot.exists()||snapshot.data().active!==true){++generation;stopAdmin?.();clearData();loaded=false;accessScreen('Conta sem autorização','O login foi reconhecido, mas esta conta ainda não tem acesso administrativo. Cadastre seu UID na coleção admins com active = true.');return;}
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
  root.innerHTML=`${emulatorLabel}<div class="app-layout"><aside class="sidebar" id="sidebar"><a class="brand" href="#overview">${brand(true)}</a><div class="workspace-label">PAINEL ADMINISTRATIVO</div><nav aria-label="Menu principal"><a data-nav="overview" href="#overview">${icon('grid')} Visão geral</a><a data-nav="settings" href="#settings">${icon('settings')} Configurações</a><a href="/configuracao.html" target="_blank" rel="noopener">${icon('file')} Guia de configuração</a></nav><div class="sidebar-bottom"><div class="solar-note">${icon('sun')}<span>Energia solar.<br><strong>Gestão consciente.</strong></span></div><div class="user-block"><span class="avatar">${e((user.email||'A').charAt(0).toUpperCase())}</span><div><strong>Administrador</strong><small>${e(user.email)}</small></div><button id="logout" class="icon-button" aria-label="Sair da conta" title="Sair da conta">${icon('out')}</button></div></div></aside><div class="workspace"><header class="topbar"><button class="icon-button mobile-menu" id="menu-toggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="sidebar">${icon('menu')}</button><div class="breadcrumb">Área administrativa <span>/</span> <strong id="breadcrumb-page">Visão geral</strong></div><span class="secure-label">${icon('shield')} Acesso autorizado</span></header><div id="network" class="notice warning" hidden>Sem conexão. Você pode revisar o formulário, mas precisa reconectar para salvar.</div><main id="page" tabindex="-1"></main><footer class="workspace-footer">TSP ENERGY SOLAR <span>Solar & energia sustentável</span></footer></div></div>`;
  root.querySelector('[data-nav="settings"]').insertAdjacentHTML('beforebegin',`<a data-nav="clients" href="#clients">${icon('users')} Clientes</a><a data-nav="consumption" href="#consumption">${icon('bolt')} Consumo mensal</a>`);
  $('#logout').onclick=logout;
  $('#menu-toggle').onclick=()=>{const open=$('#sidebar').classList.toggle('open');$('#menu-toggle').setAttribute('aria-expanded',String(open));};
  root.querySelectorAll('[data-nav]').forEach(link=>link.onclick=event=>{event.preventDefault();navigate(link.dataset.nav);});
  const requested=location.hash.slice(1);const page=['overview','clients','consumption','settings'].includes(requested)?requested:'overview';navigate(page,true);
}
function navigate(page,force=false) {
  if(busy){toast('Aguarde o salvamento.');return;}
  if(!force&&!canLeave())return;
  dirty=false;currentPage=page;history.replaceState(null,'',`#${page}`);
  root.querySelectorAll('[data-nav]').forEach(link=>{const active=link.dataset.nav===page;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  $('#sidebar').classList.remove('open');$('#menu-toggle').setAttribute('aria-expanded','false');
  const labels={overview:'Visão geral',clients:'Clientes',consumption:'Consumo mensal',settings:'Configurações'};
  $('#breadcrumb-page').textContent=labels[page];
  if(page==='settings')renderSettings();else if(page==='clients')mountClients($('#page'));else if(page==='consumption')mountConsumption($('#page'));else renderOverview();
  network();
}
function renderOverview() {
  const ready=!!company;
  $('#page').innerHTML=`<div class="page-heading"><div><span class="eyebrow">SEU ESPAÇO DE GESTÃO</span><h1>Olá, administrador<span class="green">.</span></h1><p>Vamos preparar a empresa para os próximos passos.</p></div><span class="date-chip">${new Intl.DateTimeFormat('pt-BR',{dateStyle:'long',timeZone:'America/Sao_Paulo'}).format(new Date())}</span></div><section class="welcome-card"><div class="welcome-content"><span class="pill">${icon('sun')} TSP ENERGY SOLAR</span><h2>Sua operação começa<br>com uma boa base.</h2><p>${ready?'Os dados da empresa estão salvos. Revise as informações que serão utilizadas nas suas faturas.':'Cadastre os dados da empresa, personalize os avisos e organize as informações de pagamento.'}</p><button class="button lime" id="open-settings">${ready?'Revisar configurações':'Configurar minha empresa'} ${icon('arrow')}</button></div><div class="welcome-art" aria-hidden="true"><div class="sun-disc"></div><div class="panel-grid"></div></div></section><div class="overview-grid"><article class="card"><div class="card-icon">${icon('settings')}</div><span class="eyebrow">DADOS DA EMPRESA</span><h3>${ready?e(company.profile.tradeName):'Vamos começar?'}</h3><p>${ready?e(company.profile.legalName):'Importe os dados do modelo da fatura ou preencha o cadastro da empresa.'}</p><div class="card-foot"><span class="status ${ready?'':'pending'}">${ready?'Configuração salva':'Aguardando configuração'}</span><span>${ready?'Versão '+company.revision:'Primeiro acesso'}</span></div></article><article class="card"><div class="card-icon">${icon('shield')}</div><span class="eyebrow">CONTA E ACESSO</span><h3>Seu acesso está ativo.</h3><p>Esta conta tem autorização administrativa. As configurações são acessadas por uma conexão autenticada.</p><div class="card-foot"><span class="status">Administrador</span><span>Sessão protegida</span></div></article></div><section class="next-step"><div class="step-number">02</div><div><h3>Estrutura e configurações da empresa</h3><p>Esta é a segunda etapa do projeto. Cadastro de clientes, consumo, faturamento e indicadores financeiros serão adicionados nas próximas etapas.</p></div><span class="tag">Etapa atual</span></section>`;
  $('#page .step-number').textContent='03';
  $('#page .next-step h3').textContent='Clientes e histórico de consumo';
  $('#page .next-step p').textContent='Cadastre unidades consumidoras, registre leituras mensais e consulte versões anteriores sem apagar o histórico.';
  $('#open-settings').onclick=()=>navigate('settings');
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
  images={logo:override?.logo??company?.logo??'',pixQr:override?.pixQr??company?.pixQr??''};
  $('#page').innerHTML=`<div class="page-heading"><div><span class="eyebrow">DO SEU JEITO</span><h1>Configurações da empresa</h1><p>As informações que identificam a TSP Energy nas suas faturas.</p></div><span class="tag">${company?'Versão '+company.revision:'Primeiro cadastro'}</span></div><div class="settings-toolbar"><span>${icon('shield')} Dados visíveis apenas para administradores</span><div><label class="button secondary small-button">${icon('upload')} Importar configurações<input id="import-settings" type="file" accept=".json,application/json" class="file-input"></label><button id="export-settings" class="button secondary small-button" type="button">Exportar rascunho</button></div></div>${!company?'<div class="notice info">Para manter os dados originais da fatura, importe o arquivo privado <strong>configuracoes-iniciais.json</strong> preparado com o projeto. Revise os campos e clique em Salvar.</div>':''}<form id="settings-form"><fieldset id="settings-fields"><section class="form-section"><div class="section-heading"><span class="section-number">01</span><div><h2>Identidade e contato</h2><p>Dados de identificação da empresa geradora.</p></div></div>${imageField('logo','Logotipo da empresa')}<div class="form-grid">${['legalName','tradeName','cnpj','email','phone','whatsapp'].map(k=>field(k,p)).join('')}${field('address',p,true)}</div></section><section class="form-section"><div class="section-heading"><span class="section-number">02</span><div><h2>Recebimento e PIX</h2><p>Utilize os dados confirmados pelo titular da conta.</p></div></div><div class="form-grid">${['pixBeneficiary','beneficiaryCpf','pixKey','city','bank','dueDay'].map(k=>field(k,p)).join('')}${field('bankDetails',p,true)}</div><p class="field-help">O dia padrão é opcional. Quando definido, meses mais curtos usarão o último dia disponível.</p>${imageField('pixQr','QR Code PIX fornecido pelo banco')}<label class="checkbox qr-confirm"><input type="checkbox" id="qr-confirmed" ${images.pixQr?'checked':''}> Conferi que o QR Code corresponde à chave e ao beneficiário acima.</label><p class="field-help">Nesta etapa, o sistema armazena a imagem fornecida. Não gera códigos PIX nem confirma pagamentos. Ao mudar a chave ou o beneficiário, o QR anterior será removido do rascunho.</p></section><section class="form-section"><div class="section-heading"><span class="section-number">03</span><div><h2>Contrato e comunicação</h2><p>Textos que serão utilizados na emissão e no compartilhamento.</p></div></div><div class="form-grid">${['contract','notices','whatsappTemplate','emailTemplate'].map(k=>field(k,p,true)).join('')}</div><p class="field-help">Variáveis para mensagens: {cliente}, {referencia}, {vencimento} e {total}.</p></section></fieldset><div id="save-error" class="notice error" role="alert" hidden></div><div class="save-bar"><div><strong id="save-state">${override?'Rascunho importado · revise antes de salvar':company?'Tudo salvo':'Configurações ainda não salvas'}</strong><small id="save-time">${company?'Última alteração: '+formatTime(company.updatedAt):'O salvamento será confirmado pelo Firebase.'}</small></div><button id="reload-settings" type="button" class="button secondary" data-online>Recarregar</button><button type="submit" class="button primary" id="save-settings" data-online>${icon('check')} Salvar configurações</button></div></form><section class="history-section"><div><h2>Histórico de configurações</h2><p class="muted">Cada salvamento mantém uma versão anterior para consulta.</p></div><button id="load-history" class="button secondary small-button" data-online>Consultar versões</button><div id="settings-history"></div></section>`;
  $('#settings-form').addEventListener('input',()=>{dirty=true;$('#save-state').textContent='Alterações não salvas';});
  for(const kind of ['logo','pixQr']){
    $(`#file-${kind}`).onchange=async event=>{
      const file=event.target.files[0];if(!file)return;
      try{images[kind]=await prepareImage(file,kind);updateImage(kind);dirty=true;$('#save-state').textContent='Alterações não salvas';if(kind==='pixQr')$('#qr-confirmed').checked=false;}
      catch(error){alertIn('#save-error',errorMessage(error));}finally{event.target.value='';}
    };
    $(`#remove-${kind}`).onclick=()=>{if(confirm('Remover esta imagem do rascunho? A alteração só será gravada ao salvar.')){images[kind]='';updateImage(kind);dirty=true;$('#save-state').textContent='Alterações não salvas';}};
  }
  for(const key of ['pixKey','pixBeneficiary'])$(`#field-${key}`).addEventListener('input',()=>{if(images.pixQr){images.pixQr='';updateImage('pixQr');$('#qr-confirmed').checked=false;toast('O QR Code anterior foi removido do rascunho. Selecione a imagem correspondente aos novos dados.');}});
  $('#settings-form').onsubmit=saveSettings;
  $('#reload-settings').onclick=async()=>{if(!canLeave())return;const button=$('#reload-settings');button.disabled=true;button.textContent='Carregando…';try{company=await loadCompany();dirty=false;renderSettings();network();}catch(error){alertIn('#save-error',errorMessage(error));button.disabled=false;button.textContent='Recarregar';}};
  $('#export-settings').onclick=()=>{try{downloadJson({schemaVersion:1,...formValues()},'tsp-configuracoes-rascunho.json');toast('Rascunho exportado. Guarde este arquivo em local privado.');}catch(error){alertIn('#save-error',errorMessage(error));}};
  $('#import-settings').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    try{if(file.size>400000)throw new Error('O arquivo excede o tamanho permitido.');const parsed=readBackup(JSON.parse(await file.text()));if(!canLeave())return;renderSettings(parsed);dirty=true;network();toast('Dados importados para revisão. Clique em Salvar para gravar no Firebase.');}
    catch(error){alertIn('#save-error',error instanceof SyntaxError?'O arquivo não é um JSON válido.':errorMessage(error));}
    finally{event.target.value='';}
  };
  $('#load-history').onclick=showHistory;
}
function updateImage(kind) {
  $(`#preview-${kind}`).innerHTML=images[kind]?`<img src="${e(images[kind])}" alt="${kind==='logo'?'Logotipo':'QR Code PIX'}">`:icon(kind==='logo'?'sun':'file');
  $(`#remove-${kind}`).hidden=!images[kind];
}
function formValues() {return {profile:normalizeProfile(Object.fromEntries(new FormData($('#settings-form')))),...images};}
async function saveSettings(event) {
  event.preventDefault();if(busy)return;alertIn('#save-error','');
  const values=formValues();
  if(values.pixQr&&!$('#qr-confirmed').checked){alertIn('#save-error','Confira o QR Code e marque a confirmação antes de salvar.');$('#qr-confirmed').focus();return;}
  const epoch=generation;busy=true;$('#settings-fields').disabled=true;network();$('#save-settings').textContent='Salvando…';$('#save-state').textContent='Aguardando confirmação do servidor…';
  try {
    const saved=await saveCompany(values,company?.revision||0);
    if(epoch!==generation)return;
    company={schemaVersion:1,...values,...saved,updatedBy:user.uid,updatedAt:null};dirty=false;
    try{company=await loadCompany();}catch{toast('Salvamento confirmado. Não foi possível reler o horário do servidor.');}
    if(epoch!==generation)return;
    renderSettings();$('#save-state').textContent='Configurações salvas no Firebase';toast('Configurações salvas com sucesso.');
  }catch(error){if(epoch===generation){alertIn('#save-error',errorMessage(error));$('#save-state').textContent='Não foi possível salvar. Revise a mensagem abaixo.';}}
  finally{if(epoch===generation){busy=false;if($('#settings-fields'))$('#settings-fields').disabled=false;if($('#save-settings'))$('#save-settings').innerHTML=`${icon('check')} Salvar configurações`;network();}}
}
async function showHistory() {
  const button=$('#load-history');button.disabled=true;button.textContent='Consultando…';const epoch=generation;
  try {
    const history=await loadHistory();if(epoch!==generation||currentPage!=='settings')return;
    $('#settings-history').innerHTML=history.length?`<div class="table-wrap"><table><thead><tr><th>Versão</th><th>Data da alteração</th><th>Responsável (UID)</th><th>Cópia</th></tr></thead><tbody>${history.map((v,i)=>`<tr><td><strong>${v.revision}</strong></td><td>${e(formatTime(v.updatedAt))}</td><td><code>${e(v.updatedBy)}</code></td><td><button class="text-button" type="button" data-version="${i}">Baixar versão ${v.revision}</button></td></tr>`).join('')}</tbody></table></div><p class="field-help">Exibindo até 10 versões mais recentes. Os registros anteriores permanecem no banco.</p>`:'<div class="notice info">Nenhuma versão salva ainda.</div>';
    root.querySelectorAll('[data-version]').forEach(b=>b.onclick=()=>{const v=history[Number(b.dataset.version)];downloadJson(v,`tsp-configuracoes-v${v.revision}.json`);});
  }catch(error){if(epoch===generation)alertIn('#save-error',errorMessage(error));}finally{button.disabled=false;button.textContent='Consultar versões';}
}
