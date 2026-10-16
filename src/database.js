import { doc, getDocFromServer, runTransaction, serverTimestamp, collection, query, orderBy, limit, getDocsFromServer, getDocs, where } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { validateProfile, validImage } from './validation.js';
import { validateClient, validateConsumption, digits } from './validation.js';

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
