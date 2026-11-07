import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {brand} from '../src/ui.js';

test('manifesto permite instalação e contém ícones para Android e iPhone',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
  assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'./#overview');assert.equal(manifest.scope,'./');
  assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'));
  assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'&&icon.purpose==='maskable'));
});

test('service worker guarda somente arquivos locais e não intercepta Firebase',async()=>{
  const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
  assert.match(source,/url\.origin!==self\.location\.origin/);assert.match(source,/request\.method!==['"]GET['"]/);assert.match(source,/configuracao\.html/);assert.match(source,/portal\.html/);assert.match(source,/cache\.put\(request,copy\)/);
});

test('área do cliente é uma entrada separada do painel administrativo',async()=>{
  const source=await readFile(new URL('../portal.html',import.meta.url),'utf8');
  assert.match(source,/Área do cliente/);assert.match(source,/src\/portal\.js/);assert.match(source,/noindex,nofollow/);assert.match(source,/portal-manifest\.webmanifest/);
});

test('aplicativo do cliente abre diretamente no portal',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../public/portal-manifest.webmanifest',import.meta.url),'utf8'));
  const source=await readFile(new URL('../src/portal.js',import.meta.url),'utf8');
  assert.equal(manifest.id,'./portal-cliente');assert.equal(manifest.start_url,'./portal.html');assert.equal(manifest.display,'standalone');
  assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'&&icon.purpose==='maskable'));
  assert.match(source,/requestPwaInstall/);assert.match(source,/Instalar app/);
});

test('marca do sistema utiliza o logotipo configurado',()=>{
  const markup=brand(true,'data:image/png;base64,AAAA');
  assert.match(markup,/custom-logo/);assert.match(markup,/Logotipo TSP Energy Solar/);assert.match(markup,/data:image\/png;base64,AAAA/);
});

test('cadastro mensal inclui o componente do leitor CPFL',async()=>{
  const source=await readFile(new URL('../src/clients.js',import.meta.url),'utf8');
  assert.match(source,/function cpflReaderMarkup\(\)/);assert.match(source,/id="cpfl-drop-zone"/);assert.match(source,/id="cpfl-file"/);
  assert.match(source,/function consumptionClientGateMarkup\(clients, selected\)/);assert.match(source,/id="consumption-client-gate"/);assert.match(source,/Nenhum cliente é escolhido automaticamente/);
  assert.match(source,/mismatchedClient/);assert.match(source,/Cliente travado para este lançamento/);
  assert.match(source,/normalizeBillingSettings\(billing \|\| \{\}\)/);assert.match(source,/form\.onsubmit = \(event\) => event\.preventDefault\(\)/);
  assert.match(source,/input\[name="saleTariff"\]\[type="hidden"\]/);
  assert.match(source,/input\[name="solarCreditDiscount"\]\[type="hidden"\]/);
});

test('página de pagamento oferece abertura do banco e PIX Copia e Cola',async()=>{
  const html=await readFile(new URL('../public/pagar.html',import.meta.url),'utf8'),script=await readFile(new URL('../public/pagar.js',import.meta.url),'utf8'),worker=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
  assert.match(html,/Abrir aplicativo do banco/);assert.match(html,/Copiar código PIX/);assert.match(script,/pix:\/\//);assert.match(script,/navigator\.clipboard\.writeText/);assert.match(script,/crc16\(payload\.slice/);assert.match(script,/BR\.GOV\.BCB\.PIX/);assert.match(worker,/pagar\.html/);
  assert.doesNotMatch(script,/open-bank'\)\.onclick=async\(\)=>\{await copy/);
  assert.match(script,/open-bank'\)\.onclick=\(\)=>\{const host=/);
});

test('emissão em lote também gera e baixa os PDFs',async()=>{
  const source=await readFile(new URL('../src/invoices.js',import.meta.url),'utf8');
  assert.match(source,/const createAndDownload=async invoice/);
  assert.match(source,/await createAndDownload\(invoice\)/);
  assert.match(source,/Gerando \$\{completed\+1\} de \$\{chosen\.length\}/);
  assert.match(source,/PDF gerado e baixado com sucesso/);
  assert.match(source,/Nenhuma fatura aguardando emissão/);
  assert.match(source,/Ver fatura gerada/);
  assert.match(source,/\[data-select\]:disabled/);
  assert.match(source,/aparecem somente na lista abaixo/);
});

test('menu móvel prioriza resumo, cadastro mensal, faturas e mais',async()=>{
  const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
  assert.match(source,/mobileMonthly\.dataset\.nav='consumption'/);
  assert.match(source,/mobileMonthly\.href='#consumption'/);
  assert.match(source,/mobileMonthly\.innerHTML=`\$\{icon\('bolt'\)\}<span>Mensal<\/span>`/);
  assert.match(source,/data-nav="invoices"[^>]*href="#invoices"[\s\S]*?<span>Faturas<\/span>/);
  assert.match(source,/id="mobile-more"[\s\S]*?<span>Mais<\/span>/);
});
