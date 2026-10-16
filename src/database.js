import { doc, getDocFromServer, runTransaction, serverTimestamp, collection, query, orderBy, limit, getDocsFromServer } from 'firebase/firestore';
import { auth, db } from './firebase.js';
import { validateProfile, validImage } from './validation.js';

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
