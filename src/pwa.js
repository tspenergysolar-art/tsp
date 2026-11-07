import {escapeHtml as e,icon} from './ui.js';

let installPrompt=null;
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const appleMobile=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const appleSafari=()=>appleMobile()&&/safari/i.test(navigator.userAgent)&&!/crios|fxios|edgios/i.test(navigator.userAgent);

export function showIosInstallGuide(){
  document.querySelector('.ios-install-backdrop')?.remove();
  const safari=appleSafari(),overlay=document.createElement('div');
  overlay.className='ios-install-backdrop';
  overlay.innerHTML=`<section class="ios-install-guide" role="dialog" aria-modal="true" aria-labelledby="ios-install-title"><button class="ios-install-close" type="button" aria-label="Fechar instruções">×</button><div class="ios-install-icon">${icon('upload')}</div><span class="eyebrow">IPHONE E IPAD</span><h2 id="ios-install-title">${safari?'Instalar pela Tela de Início':'Abra primeiro no Safari'}</h2><p>${safari?'No iPhone a instalação é concluída pelo menu Compartilhar do Safari.':'A instalação como aplicativo precisa ser iniciada no Safari. Copie ou abra este mesmo endereço no Safari e siga os passos abaixo.'}</p><ol><li>Toque no botão <strong>Compartilhar</strong> do Safari.</li><li>Role as opções e escolha <strong>Adicionar à Tela de Início</strong>.</li><li>Ative <strong>Abrir como App Web</strong>, quando aparecer.</li><li>Toque em <strong>Adicionar</strong>.</li></ol><div class="ios-install-tip"><strong>Não encontrou a opção?</strong><span>Role até o fim, toque em Editar Ações e adicione “Adicionar à Tela de Início”.</span></div><a class="button secondary full" href="https://support.apple.com/guide/iphone/iphea86e5236/ios" target="_blank" rel="noopener">Ver ajuda oficial da Apple</a><button class="button primary full ios-install-done" type="button">Entendi</button></section>`;
  const close=()=>overlay.remove();
  overlay.querySelector('.ios-install-close').onclick=close;
  overlay.querySelector('.ios-install-done').onclick=close;
  overlay.onclick=event=>{if(event.target===overlay)close();};
  document.body.append(overlay);overlay.querySelector('.ios-install-close').focus();
}

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;window.dispatchEvent(new CustomEvent('tsp-install-ready'));});
window.addEventListener('appinstalled',()=>{installPrompt=null;window.dispatchEvent(new CustomEvent('tsp-install-ready'));});

export function registerPwa(){
  if(import.meta.env.PROD&&'serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL}).catch(error=>console.warn('Não foi possível ativar o modo aplicativo.',error)));
}

export async function requestPwaInstall(){
  if(standalone())return {installed:true};
  if(appleMobile()){showIosInstallGuide();return {available:true,manual:true,platform:'ios'};}
  if(!installPrompt)return {available:false};
  const prompt=installPrompt;await prompt.prompt();const choice=await prompt.userChoice;installPrompt=null;
  window.dispatchEvent(new CustomEvent('tsp-install-ready'));
  return {available:true,accepted:choice.outcome==='accepted'};
}

export function mountInstall(container){
  const draw=()=>{
    const installed=standalone(),ios=appleMobile();
    container.innerHTML=`<div class="page-heading"><div><span class="eyebrow">APLICATIVO TSP ENERGY</span><h1>Instalar no celular</h1><p>Use o sistema em tela cheia, com um ícone próprio na tela inicial.</p></div><span class="tag">Aplicativo instalável</span></div>
      <section class="install-hero"><div class="install-app-icon"><img src="${import.meta.env.BASE_URL}icon-192.png" alt="Ícone TSP Energy Solar"></div><div><span class="eyebrow">TSP ENERGY SOLAR</span><h2>${installed?'Aplicativo instalado':'Seu sistema sempre à mão'}</h2><p>${installed?'O aplicativo está pronto para uso neste dispositivo.':'A instalação é gratuita e utiliza o mesmo acesso administrativo do site.'}</p>${installed?'<span class="status-badge paid">Instalado neste dispositivo</span>':ios?`<button class="button primary" id="install-ios">${icon('upload')} Como instalar no iPhone</button>`:installPrompt?`<button class="button primary" id="install-now">${icon('upload')} Instalar aplicativo</button>`:''}</div></section>
      <div class="install-grid"><article class="form-section install-card"><span class="device-label">ANDROID</span><h2>Instalar no Android</h2><ol><li>Abra esta página no Google Chrome.</li><li>Toque em <strong>Instalar aplicativo</strong> acima. Se o botão não aparecer, abra o menu ⋮ do Chrome.</li><li>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li><li>Confirme a instalação.</li></ol></article><article class="form-section install-card"><span class="device-label">IPHONE E IPAD</span><h2>Instalar no iPhone</h2><ol><li>Abra o sistema no aplicativo <strong>Safari</strong>.</li><li>Toque em <strong>Compartilhar</strong>.</li><li>Escolha <strong>Adicionar à Tela de Início</strong>.</li><li>Ative <strong>Abrir como App Web</strong>, quando aparecer, e toque em <strong>Adicionar</strong>.</li></ol></article></div>
      ${ios&&!installed?'<div class="notice info">Você está em um dispositivo Apple. A instalação é feita pelo menu Compartilhar do Safari.</div>':''}
      <section class="form-section install-details"><div class="section-heading"><span class="section-number">✓</span><div><h2>Pronto para usar</h2><p>Acesse o sistema com mais rapidez pelo ícone na tela inicial.</p></div></div><ul class="install-checks"><li>Use o mesmo e-mail e senha do sistema.</li><li>A instalação é gratuita.</li><li>Abra diretamente pela tela inicial do celular.</li><li>Use a internet para consultar e salvar informações.</li><li>Remova normalmente pelas configurações do celular quando desejar.</li></ul></section>`;
    const button=container.querySelector('#install-now');if(button)button.onclick=async()=>{button.disabled=true;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;draw();};
    const iosButton=container.querySelector('#install-ios');if(iosButton)iosButton.onclick=showIosInstallGuide;
  };
  window.addEventListener('tsp-install-ready',draw,{once:true});draw();
}
