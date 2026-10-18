import { doc, getDocFromServer, runTransaction, serverTimestamp, collection, query, orderBy, limit, getDocsFromServer, getDocs, where, writeBatch } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { validateProfile, validImage } from './validation.js';
import { validateClient, validateConsumption, digits } from './validation.js';
import {validateBillingSettings} from './billing.js';

const companyRef = doc(db, 'settings', 'company');
export async function loadCompany() {
  const snap = await getDocFromServer(companyRef);
  return snap.exists() ? snap.data() : null;
}
export async function saveCompany(values, expectedRevision) {
  if (!navigator.onLine) throw new Error('Sem conexão. Nenhuma alteração foi salva. Reconecte e tente novamente.');
  validateProfile(values.profile);
  if (!validImage(values.logo) || !validImage(values.pixQr)) throw new Error('Imagem inválida ou maior que o limite permitido.');
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Entre novamente para salvar.');
  const versionId = crypto.randomUUID();
  const versionRef = doc(db, 'settingsVersions', versionId);
  await runTransaction(db, async transaction => {
    const existing = await transaction.get(companyRef);
    const revision = existing.exists() ? existing.data().revision : 0;
    if (revision !== expectedRevision) throw new Error('As configurações foram alteradas em outra sessão. Exporte seu rascunho e recarregue os dados antes de salvar.');
    const payload = {schemaVersion:1, ...values, revision:revision+1, versionId, updatedBy:uid, updatedAt:serverTimestamp()};
    transaction.set(companyRef, payload);
    transaction.set(versionRef, payload);
  });
  return {revision:expectedRevision+1, versionId};
}
export async function loadHistory() {
  const result = await getDocsFromServer(query(collection(db,'settingsVersions'),orderBy('revision','desc'),limit(10)));
  return result.docs.map(snapshot => snapshot.data());
}
export async function getCompanyVersion(versionId){const snap=await getDocFromServer(doc(db,'settingsVersions',versionId));return snap.exists()?snap.data():null;}

const billingRef=doc(db,'billingSettings','current');
export async function loadBillingSettings(){const snap=await getDocFromServer(billingRef);return snap.exists()?snap.data():null;}
export async function saveBillingSettings(settings,expectedRevision=0){
  if(!navigator.onLine)throw new Error('Sem conexão. Nenhuma configuração foi salva.');
  validateBillingSettings(settings);const uid=requireUser(),versionId=crypto.randomUUID(),versionRef=doc(db,'billingSettingsVersions',versionId);
  await runTransaction(db,async transaction=>{const existing=await transaction.get(billingRef),revision=existing.exists()?existing.data().revision:0;if(revision!==expectedRevision)throw new Error('As tarifas foram alteradas em outra sessão. Recarregue antes de salvar.');const payload={schemaVersion:1,...settings,revision:revision+1,versionId,updatedAt:serverTimestamp(),updatedBy:uid};transaction.set(billingRef,payload);transaction.set(versionRef,payload);});
  return {revision:expectedRevision+1,versionId};
}

function requireUser(){const uid=auth.currentUser?.uid;if(!uid)throw new Error('Entre novamente para continuar.');return uid;}
export async function listClients(){
  const result=await getDocsFromServer(collection(db,'clients'));
  return result.docs.map(item=>item.data()).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}
export async function saveClient(raw, expectedRevision=0, id=crypto.randomUUID()){
  if(!navigator.onLine)throw new Error('Sem conexão. Nenhuma alteração foi salva.');
  const client=validateClient(raw), uid=requireUser(), versionId=crypto.randomUUID();
  const currentRef=doc(db,'clients',id), versionRef=doc(db,'clientVersions',versionId);
  await runTransaction(db,async transaction=>{
    const existing=await transaction.get(currentRef), revision=existing.exists()?existing.data().revision:0;
    if(revision!==expectedRevision)throw new Error('Este cliente foi alterado em outra sessão. Recarregue os dados antes de salvar.');
    const createdAt=existing.exists()?existing.data().createdAt:serverTimestamp();
    const createdBy=existing.exists()?existing.data().createdBy:uid;
    const payload={schemaVersion:1,id,...client,taxIdDigits:digits(client.taxId),phoneDigits:digits(client.phone),whatsappDigits:digits(client.whatsapp),normalizedName:client.name.toLocaleLowerCase('pt-BR'),revision:revision+1,versionId,createdAt,createdBy,updatedAt:serverTimestamp(),updatedBy:uid};
    transaction.set(currentRef,payload);transaction.set(versionRef,payload);
  });
  return id;
}
export async function findDuplicateClients(client, excludeId=''){
  const all=await listClients(), tax=digits(client.taxId), phone=digits(client.phone), installation=client.installationNumber.trim().toLowerCase();
  return all.filter(item=>item.id!==excludeId&&((tax&&item.taxIdDigits===tax)||(phone&&item.phoneDigits===phone)||(installation&&item.installationNumber.toLowerCase()===installation)));
}
export async function getClient(id){const result=await getDocFromServer(doc(db,'clients',id));return result.exists()?result.data():null;}
export async function listClientVersions(clientId){
  const result=await getDocsFromServer(query(collection(db,'clientVersions'),where('id','==',clientId)));
  return result.docs.map(item=>item.data()).sort((a,b)=>b.revision-a.revision);
}
export async function listConsumptions(clientId=''){
  const ref=clientId?query(collection(db,'consumptions'),where('clientId','==',clientId)):collection(db,'consumptions');
  const result=await getDocsFromServer(ref);
  return result.docs.map(item=>item.data()).sort((a,b)=>b.reference.localeCompare(a.reference));
}
export async function listConsumptionVersions(clientId){
  const result=await getDocsFromServer(query(collection(db,'consumptionVersions'),where('clientId','==',clientId)));
  return result.docs.map(item=>item.data()).sort((a,b)=>b.reference.localeCompare(a.reference)||b.revision-a.revision);
}
export async function saveConsumption(client, raw, expectedRevision=0){
  if(!navigator.onLine)throw new Error('Sem conexão. Nenhum lançamento foi salvo.');
  const value=validateConsumption(raw), uid=requireUser();
  const id=`${client.id}--${value.reference}`, versionId=crypto.randomUUID();
  const currentRef=doc(db,'consumptions',id), versionRef=doc(db,'consumptionVersions',versionId);
  await runTransaction(db,async transaction=>{
    const existing=await transaction.get(currentRef), revision=existing.exists()?existing.data().revision:0;
    if(revision!==expectedRevision)throw new Error('Este lançamento já existe ou foi alterado. Abra o registro existente antes de corrigir.');
    const payload={schemaVersion:1,id,clientId:client.id,clientName:client.name,installationNumber:client.installationNumber,...value,revision:revision+1,versionId,createdAt:existing.exists()?existing.data().createdAt:serverTimestamp(),createdBy:existing.exists()?existing.data().createdBy:uid,updatedAt:serverTimestamp(),updatedBy:uid};
    transaction.set(currentRef,payload);transaction.set(versionRef,payload);
  });
  return id;
}
export async function deleteConsumption(consumptionId){
  if(!navigator.onLine)throw new Error('Sem conexão. O cadastro mensal não foi excluído.');
  requireUser();
  const current=await getDocFromServer(doc(db,'consumptions',consumptionId));
  if(!current.exists())throw new Error('Este cadastro mensal já não existe.');
  const [linkedInvoices,versions]=await Promise.all([
    getDocsFromServer(query(collection(db,'invoices'),where('consumptionId','==',consumptionId))),
    getDocsFromServer(query(collection(db,'consumptionVersions'),where('id','==',consumptionId)))
  ]);
  if(!linkedInvoices.empty)throw new Error('Exclua primeiro as faturas geradas com este cadastro mensal.');
  const batch=writeBatch(db);
  versions.docs.forEach(item=>batch.delete(item.ref));
  batch.delete(current.ref);
  await batch.commit();
}
export async function listInvoices(reference='',clientId=''){
  let ref=collection(db,'invoices');
  if(reference)ref=query(ref,where('reference','==',reference));else if(clientId)ref=query(ref,where('clientId','==',clientId));
  const result=await getDocsFromServer(ref);return result.docs.map(item=>item.data()).filter(item=>!clientId||item.clientId===clientId).sort((a,b)=>(b.issuedAt?.seconds||0)-(a.issuedAt?.seconds||0));
}
export async function issueInvoice(snapshot){
  if(!navigator.onLine)throw new Error('Sem conexão. A fatura não foi emitida.');
  const uid=requireUser(),ref=doc(db,'invoices',snapshot.id);
  await runTransaction(db,async transaction=>{const [existing,companyVersion,client,consumption]=await Promise.all([transaction.get(ref),transaction.get(doc(db,'settingsVersions',snapshot.companyVersionId)),transaction.get(doc(db,'clients',snapshot.clientId)),transaction.get(doc(db,'consumptions',snapshot.consumptionId))]);if(existing.exists())throw new Error('Esta fatura já foi emitida.');if(!companyVersion.exists()||!client.exists()||!consumption.exists())throw new Error('Os dados de origem da fatura não estão mais disponíveis.');transaction.set(ref,{...snapshot,issuedAt:serverTimestamp(),issuedBy:uid});});
  return snapshot.id;
}
export async function cancelInvoice(invoiceId,reason){
  if(!navigator.onLine)throw new Error('Sem conexão. A fatura não foi cancelada.');
  const uid=requireUser(),ref=doc(db,'invoices',invoiceId),message=String(reason||'').trim();
  if(!message)throw new Error('Informe o motivo do cancelamento.');
  await runTransaction(db,async transaction=>{const snap=await transaction.get(ref);if(!snap.exists()||snap.data().status!=='issued')throw new Error('Esta fatura não está disponível para cancelamento.');transaction.update(ref,{status:'cancelled',cancelledAt:serverTimestamp(),cancelledBy:uid,cancellationReason:message});});
}
export async function deleteInvoice(invoiceId){
  if(!navigator.onLine)throw new Error('Sem conexão. A fatura não foi excluída.');
  requireUser();
  const invoice=await getDocFromServer(doc(db,'invoices',invoiceId));
  if(!invoice.exists())throw new Error('Esta fatura já não existe.');
  const [payments,shares]=await Promise.all([
    getDocsFromServer(query(collection(db,'payments'),where('invoiceId','==',invoiceId))),
    getDocsFromServer(query(collection(db,'shares'),where('invoiceId','==',invoiceId)))
  ]);
  if(payments.size+shares.size>498)throw new Error('Esta fatura possui registros demais para exclusão pelo navegador.');
  const batch=writeBatch(db);
  payments.docs.forEach(item=>batch.delete(item.ref));
  shares.docs.forEach(item=>batch.delete(item.ref));
  batch.delete(invoice.ref);
  await batch.commit();
}
export async function listPayments(invoiceId=''){
  const ref=invoiceId?query(collection(db,'payments'),where('invoiceId','==',invoiceId)):collection(db,'payments');const result=await getDocsFromServer(ref);return result.docs.map(item=>item.data()).sort((a,b)=>String(b.paymentDate).localeCompare(String(a.paymentDate)));
}
export async function savePayment(invoiceId,{paymentDate,amount,method,notes}){
  if(!navigator.onLine)throw new Error('Sem conexão. O pagamento não foi registrado.');const uid=requireUser(),id=crypto.randomUUID(),ref=doc(db,'payments',id),invoiceRef=doc(db,'invoices',invoiceId),value=Number(amount);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)||!Number.isFinite(value)||value<=0)throw new Error('Informe uma data e um valor recebido maior que zero.');if(!String(method).trim())throw new Error('Informe a forma de pagamento.');
  await runTransaction(db,async transaction=>{const invoice=await transaction.get(invoiceRef);if(!invoice.exists()||invoice.data().status!=='issued')throw new Error('A fatura não está ativa para receber pagamentos.');const payload={schemaVersion:1,id,invoiceId,clientId:invoice.data().clientId,paymentDate,amount:value,method:String(method).trim(),notes:String(notes||'').trim(),status:'active',createdAt:serverTimestamp(),createdBy:uid,cancelledAt:null,cancelledBy:'',cancellationReason:''};transaction.set(ref,payload);});return id;
}
export async function cancelPayment(paymentId,reason){
  if(!navigator.onLine)throw new Error('Sem conexão. O pagamento não foi cancelado.');const uid=requireUser(),ref=doc(db,'payments',paymentId);if(!String(reason).trim())throw new Error('Informe o motivo do cancelamento.');await runTransaction(db,async transaction=>{const snap=await transaction.get(ref);if(!snap.exists()||snap.data().status!=='active')throw new Error('Este pagamento não está ativo.');transaction.update(ref,{status:'cancelled',cancelledAt:serverTimestamp(),cancelledBy:uid,cancellationReason:String(reason).trim()});});
}
export async function recordShare(invoiceId,channel){
  if(!navigator.onLine)throw new Error('Sem conexão. A confirmação não foi registrada.');if(!['whatsapp','email','copy'].includes(channel))throw new Error('Forma de compartilhamento inválida.');const uid=requireUser(),id=crypto.randomUUID(),ref=doc(db,'shares',id);await runTransaction(db,async transaction=>{const invoice=await transaction.get(doc(db,'invoices',invoiceId));if(!invoice.exists())throw new Error('A fatura não foi encontrada.');transaction.set(ref,{schemaVersion:1,id,invoiceId,clientId:invoice.data().clientId,channel,sharedAt:serverTimestamp(),sharedBy:uid});});return id;
}
