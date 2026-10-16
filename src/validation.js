export const profileFields = ['legalName','tradeName','cnpj','beneficiaryCpf','pixBeneficiary','pixKey','bank','bankDetails','phone','whatsapp','email','address','city','contract','notices','whatsappTemplate','emailTemplate','dueDay'];
export const longFields = ['bankDetails','address','contract','notices','whatsappTemplate','emailTemplate'];
export const emptyProfile = () => Object.fromEntries(profileFields.map(k => [k, '']));
export const digits = s => String(s).replace(/\D/g, '');
export function validCpf(value) {
  const d = digits(value);
  if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  return [9,10].every(n => {const r = [...d.slice(0,n)].reduce((s,x,i) => s + Number(x)*(n+1-i),0)*10%11; return (r===10?0:r)===Number(d[n]);});
}
export function validCnpj(value) {
  const d = digits(value);
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  return [12,13].every(n => {const weights = n===12?[5,4,3,2,9,8,7,6,5,4,3,2]:[6,5,4,3,2,9,8,7,6,5,4,3,2]; const r = [...d.slice(0,n)].reduce((s,x,i)=>s+Number(x)*weights[i],0)%11; return (r<2?0:11-r)===Number(d[n]);});
}
export function normalizeProfile(raw) {
  return Object.fromEntries(profileFields.map(k => [k, k === 'dueDay' ? (String(raw[k] ?? '').trim() === '' ? '' : Number(raw[k])) : String(raw[k] ?? '').trim()]));
}
export function validateProfile(p) {
  if (!p.legalName || !p.tradeName) throw new Error('Informe a razão social e o nome fantasia.');
  for (const key of profileFields) {
    if (key === 'dueDay') continue;
    if (typeof p[key] !== 'string' || p[key].length > (longFields.includes(key)?3000:200)) throw new Error('Um dos campos excede o tamanho permitido.');
  }
  if (p.dueDay !== '' && (!Number.isInteger(p.dueDay) || p.dueDay < 1 || p.dueDay > 31)) throw new Error('O dia de vencimento deve ficar em branco ou estar entre 1 e 31.');
  if (p.cnpj && !validCnpj(p.cnpj)) throw new Error('Confira os dígitos do CNPJ.');
  if (p.beneficiaryCpf && !validCpf(p.beneficiaryCpf)) throw new Error('Confira os dígitos do CPF do beneficiário.');
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) throw new Error('Informe um e-mail válido.');
  for (const key of ['phone','whatsapp']) if (p[key] && !/^\d{10,13}$/.test(digits(p[key]))) throw new Error('Informe telefone e WhatsApp com DDD.');
  if (p.pixKey && !p.pixBeneficiary) throw new Error('Informe o beneficiário da chave PIX.');
  return p;
}
export function validImage(value) {
  return typeof value === 'string' && (value === '' || (value.length <= 90000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)));
}
export function readBackup(raw) {
  if (!raw || raw.schemaVersion !== 1 || !raw.profile) throw new Error('Arquivo incompatível. Use uma cópia de configurações TSP Energy.');
  const profile = validateProfile(normalizeProfile(raw.profile));
  const logo = raw.logo ?? '', pixQr = raw.pixQr ?? '';
  if (!validImage(logo) || !validImage(pixQr)) throw new Error('O arquivo contém uma imagem inválida ou muito grande.');
  if (pixQr && (!profile.pixKey || !profile.pixBeneficiary)) throw new Error('O QR Code precisa de chave e beneficiário.');
  return {profile,logo,pixQr};
}
export function errorMessage(error) {
  const map = {
    'auth/invalid-credential':'E-mail ou senha incorretos.',
    'auth/user-not-found':'E-mail ou senha incorretos.',
    'auth/wrong-password':'E-mail ou senha incorretos.',
    'auth/invalid-email':'Confira o endereço de e-mail.',
    'auth/user-disabled':'Esta conta foi desativada. Procure o responsável pelo sistema.',
    'auth/too-many-requests':'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/network-request-failed':'Não foi possível conectar. Confira sua internet.',
    'auth/operation-not-allowed':'Ative o login por e-mail e senha no console Firebase.',
    'auth/configuration-not-found':'O Authentication ainda precisa ser ativado no projeto Firebase.',
    'permission-denied':'Acesso negado. Confira a autorização administrativa e as regras do Firestore.',
    'unavailable':'O servidor está indisponível. Confira sua conexão e tente novamente.',
    'resource-exhausted':'A cota gratuita foi atingida. Aguarde a renovação e confira o uso no Firebase.',
  };
  return map[error.code] || (error.code ? 'Não foi possível concluir a operação. Tente novamente.' : error.message) || 'Ocorreu um erro inesperado.';
}
