import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPixPayload,normalizePixKey} from '../src/pix.js';

test('PIX inclui chave, beneficiário, cidade, valor e identificador da fatura',()=>{
  const payload=buildPixPayload({id:'abc-123',total:129.6},{pixKey:'343.441.658-70',pixBeneficiary:'THIAGO SÁNCHEZ PEREIRA',city:'Uberlândia'});
  assert.match(payload,/^000201/);
  assert.ok(payload.includes('011134344165870'));
  assert.ok(!payload.includes('343.441.658-70'));
  assert.ok(payload.includes('THIAGO SANCHEZ PEREIRA'));
  assert.ok(payload.includes('UBERLANDIA'));
  assert.ok(payload.includes('5406129.60'));
  assert.match(payload,/6304[0-9A-F]{4}$/);
});

test('PIX usa formato canônico para chaves de documento e telefone',()=>{
  assert.equal(normalizePixKey('343.441.658-70'),'34344165870');
  assert.equal(normalizePixKey('59.036.232/0001-42'),'59036232000142');
  assert.equal(normalizePixKey('+55 (34) 99678-6920'),'+5534996786920');
  assert.equal(normalizePixKey('financeiro@empresa.com'),'financeiro@empresa.com');
});

test('PIX não é gerado com campos incompletos ou valor zerado',()=>{
  const invoice={id:'abc',total:10},profile={pixKey:'chave',pixBeneficiary:'Titular',city:'Assis'};
  assert.equal(buildPixPayload(invoice,{...profile,city:''}),'');
  assert.equal(buildPixPayload({...invoice,total:0},profile),'');
});
