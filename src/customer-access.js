import {initializeApp,deleteApp} from 'firebase/app';
import {getAuth,createUserWithEmailAndPassword,sendPasswordResetEmail,signOut,deleteUser,connectAuthEmulator} from 'firebase/auth';
import {collection,deleteDoc,doc,getDocsFromServer,query,where,writeBatch,serverTimestamp,updateDoc} from 'firebase/firestore';
import {auth,db,firebaseConfig,isEmulator} from './firebase.js';
import {publicCompanySettings} from './portal-settings.js';

export async function getCustomerAccess(clientId){
  const result=await getDocsFromServer(query(collection(db,'customerAccounts'),where('clientId','==',clientId)));
  return result.docs.map(item=>item.data())[0]||null;
}

function temporaryPassword(){
  const bytes=crypto.getRandomValues(new Uint8Array(18));
  return `Tsp!${Array.from(bytes,b=>b.toString(36)).join('').slice(0,24)}9a`;
}

export async function provisionCustomerAccess(client,company){
  if(!navigator.onLine)throw new Error('Sem conexão. O acesso não foi criado.');
  const adminUid=auth.currentUser?.uid,email=String(client.email||'').trim().toLowerCase();
  if(!adminUid)throw new Error('Entre novamente para continuar.');
  if(!email)throw new Error('Cadastre e salve o e-mail do cliente antes de liberar o acesso.');
  const existing=await getCustomerAccess(client.id);
  if(existing){
    if(existing.email!==email)throw new Error(`O acesso existente usa ${existing.email}. Para trocar o e-mail, use a opção Redefinir acesso.`);
    await updateDoc(doc(db,'customerAccounts',existing.uid),{active:true,clientName:client.name,updatedAt:serverTimestamp(),updatedBy:adminUid});
    await sendPasswordResetEmail(auth,email);
    return {...existing,active:true,email};
  }
  const secondary=initializeApp(firebaseConfig,`customer-${crypto.randomUUID()}`),secondaryAuth=getAuth(secondary);
  secondaryAuth.languageCode='pt-BR';
  if(isEmulator)connectAuthEmulator(secondaryAuth,'http://127.0.0.1:9099',{disableWarnings:true});
  let created;
  try{
    created=await createUserWithEmailAndPassword(secondaryAuth,email,temporaryPassword());
    const payload={schemaVersion:1,uid:created.user.uid,email,clientId:client.id,clientName:client.name,active:true,createdAt:serverTimestamp(),createdBy:adminUid,updatedAt:serverTimestamp(),updatedBy:adminUid};
    const batch=writeBatch(db);
    batch.set(doc(db,'customerAccounts',created.user.uid),payload);
    batch.set(doc(db,'portalSettings','company'),publicCompanySettings(company,adminUid));
    await batch.commit();
    await sendPasswordResetEmail(secondaryAuth,email);
    return {...payload,createdAt:null,updatedAt:null};
  }catch(error){
    if(created?.user)try{await deleteUser(created.user);}catch{}
    if(error?.code==='auth/email-already-in-use')throw new Error('Este e-mail já possui uma conta de acesso. Verifique se ele já foi usado por outro cliente ou administrador.');
    if(error?.code==='auth/invalid-email')throw new Error('O e-mail do cliente é inválido. Corrija o cadastro antes de liberar o acesso.');
    throw error;
  }finally{
    try{await signOut(secondaryAuth);}catch{}
    await deleteApp(secondary);
  }
}

export async function revokeCustomerAccess(account){
  if(!navigator.onLine)throw new Error('Sem conexão. O acesso não foi bloqueado.');
  const uid=auth.currentUser?.uid;if(!uid)throw new Error('Entre novamente para continuar.');
  await updateDoc(doc(db,'customerAccounts',account.uid),{active:false,updatedAt:serverTimestamp(),updatedBy:uid});
}

export async function resendCustomerAccess(account){
  if(!navigator.onLine)throw new Error('Sem conexão. O e-mail não foi enviado.');
  await sendPasswordResetEmail(auth,account.email);
}

export async function resetCustomerAccess(account){
  if(!navigator.onLine)throw new Error('Sem conexão. O acesso não foi redefinido.');
  if(!auth.currentUser?.uid)throw new Error('Entre novamente para continuar.');
  if(!account?.uid)throw new Error('A conta do cliente não foi encontrada.');
  await deleteDoc(doc(db,'customerAccounts',account.uid));
}
