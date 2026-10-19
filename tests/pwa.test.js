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
