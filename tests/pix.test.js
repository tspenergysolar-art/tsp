import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPixPayload} from '../src/pix.js';

test('PIX inclui chave, beneficiário, cidade, valor e identificador da fatura',()=>{
  const payload=buildPixPayload({id:'abc-123',total:129.6},{pixKey:'343.441.658-70',pixBeneficiary:'THIAGO SÁNCHEZ PEREIRA',city:'Uberlândia'});
  assert.match(payload,/^000201/);
  assert.ok(payload.includes('343.441.658-70'));
  assert.ok(payload.includes('THIAGO SANCHEZ PEREIRA'));
  assert.ok(payload.includes('UBERLANDIA'));
  assert.ok(payload.includes('5406129.60'));
  assert.match(payload,/6304[0-9A-F]{4}$/);
});

test('PIX não é gerado com campos incompletos ou valor zerado',()=>{
  const invoice={id:'abc',total:10},profile={pixKey:'chave',pixBeneficiary:'Titular',city:'Assis'};
  assert.equal(buildPixPayload(invoice,{...profile,city:''}),'');
  assert.equal(buildPixPayload({...invoice,total:0},profile),'');
});
