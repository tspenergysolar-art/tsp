// Dados fictícios exclusivamente nos emuladores locais. Nunca usa credenciais reais.
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc} from 'firebase/firestore';
const projectId='demo-tsp-energy';
const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@teste.local',password:'TesteLocal123!',returnSecureToken:true})});
let account=await response.json();
if(!response.ok){const existing=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@teste.local',password:'TesteLocal123!',returnSecureToken:true})});account=await existing.json();}
if(!account.localId)throw new Error('Não foi possível preparar o usuário de teste.');
const env=await initializeTestEnvironment({projectId,firestore:{host:'127.0.0.1',port:8080}});
let seeded;
await env.withSecurityRulesDisabled(async ctx=>{const ref=doc(ctx.firestore(),'admins',account.localId);await setDoc(ref,{active:true});seeded=(await getDoc(ref)).data();});
await env.cleanup();
console.log(`Emulador preparado para ${account.localId} (active=${seeded.active}). Login fictício: admin@teste.local / TesteLocal123!`);
