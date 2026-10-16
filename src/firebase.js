import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, connectFirestoreEmulator } from 'firebase/firestore';

// Identificadores públicos do aplicativo. A autorização é aplicada em firestore.rules.
export const isEmulator = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true';
export const firebaseConfig = {
  apiKey: 'AIzaSyBvKFff8E7zCWplfrpjBZyMtdw6-UuCMj0',
  authDomain: 'tsp-energy.firebaseapp.com',
  projectId: isEmulator ? 'demo-tsp-energy' : 'tsp-energy',
  messagingSenderId: '976708193785',
  appId: '1:976708193785:web:90e9a2efbe30f56d4d0128',
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
auth.languageCode = 'pt-BR';
export const db = initializeFirestore(app, {localCache: memoryLocalCache()});
if (isEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
