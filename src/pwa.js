import {escapeHtml as e,icon} from './ui.js';

let installPrompt=null;
const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const appleMobile=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);

window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;window.dispatchEvent(new CustomEvent('tsp-install-ready'));});
window.addEventListener('appinstalled',()=>{installPrompt=null;window.dispatchEvent(new CustomEvent('tsp-install-ready'));});

export function registerPwa(){
  if(import.meta.env.PROD&&'serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{scope:import.meta.env.BASE_URL}).catch(error=>console.warn('Não foi possível ativar o modo aplicativo.',error)));
}

export async function requestPwaInstall(){
  if(standalone())return {installed:true};
  if(!installPrompt)return {available:false};
  const prompt=installPrompt;await prompt.prompt();const choice=await prompt.userChoice;installPrompt=null;
  window.dispatchEvent(new CustomEvent('tsp-install-ready'));
  return {available:true,accepted:choice.outcome==='accepted'};
}

export function mountInstall(container){
  const draw=()=>{
    const installed=standalone(),ios=appleMobile();
    container.innerHTML=`<div class="page-heading"><div><span class="eyebrow">APLICATIVO TSP ENERGY</span><h1>Instalar no celular</h1><p>Use o sistema em tela cheia, com um ícone próprio na tela inicial.</p></div><span class="tag">Aplicativo instalável</span></div>
      <section class="install-hero"><div class="install-app-icon"><img src="${import.meta.env.BASE_URL}icon-192.png" alt="Ícone TSP Energy Solar"></div><div><span class="eyebrow">TSP ENERGY SOLAR</span><h2>${installed?'Aplicativo instalado':'Seu sistema sempre à mão'}</h2><p>${installed?'O aplicativo está pronto para uso neste dispositivo.':'A instalação é gratuita e utiliza o mesmo acesso administrativo do site.'}</p>${installed?'<span class="status-badge paid">Instalado neste dispositivo</span>':installPrompt?`<button class="button primary" id="install-now">${icon('upload')} Instalar aplicativo</button>`:''}</div></section>
      <div class="install-grid"><article class="form-section install-card"><span class="device-label">ANDROID</span><h2>Instalar no Android</h2><ol><li>Abra esta página no Google Chrome.</li><li>Toque em <strong>Instalar aplicativo</strong> acima. Se o botão não aparecer, abra o menu ⋮ do Chrome.</li><li>Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li><li>Confirme a instalação.</li></ol></article><article class="form-section install-card"><span class="device-label">IPHONE E IPAD</span><h2>Instalar no iPhone</h2><ol><li>Abra o sistema no aplicativo <strong>Safari</strong>.</li><li>Toque em <strong>Compartilhar</strong>.</li><li>Escolha <strong>Adicionar à Tela de Início</strong>.</li><li>Ative <strong>Abrir como App Web</strong>, quando aparecer, e toque em <strong>Adicionar</strong>.</li></ol></article></div>
      ${ios&&!installed?'<div class="notice info">Você está em um dispositivo Apple. A instalação é feita pelo menu Compartilhar do Safari.</div>':''}
      <section class="form-section install-details"><div class="section-heading"><span class="section-number">✓</span><div><h2>Pronto para usar</h2><p>Acesse o sistema com mais rapidez pelo ícone na tela inicial.</p></div></div><ul class="install-checks"><li>Use o mesmo e-mail e senha do sistema.</li><li>A instalação é gratuita.</li><li>Abra diretamente pela tela inicial do celular.</li><li>Use a internet para consultar e salvar informações.</li><li>Remova normalmente pelas configurações do celular quando desejar.</li></ul></section>`;
    const button=container.querySelector('#install-now');if(button)button.onclick=async()=>{button.disabled=true;await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;draw();};
  };
  window.addEventListener('tsp-install-ready',draw,{once:true});draw();
}
