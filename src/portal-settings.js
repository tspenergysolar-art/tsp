import {serverTimestamp} from 'firebase/firestore';

export function publicCompanySettings(company={},updatedBy=''){
  const profile=company.profile||{};
  return {schemaVersion:1,profile:{
    legalName:String(profile.legalName||''),tradeName:String(profile.tradeName||''),cnpj:String(profile.cnpj||''),
    pixBeneficiary:String(profile.pixBeneficiary||''),pixKey:String(profile.pixKey||''),bank:String(profile.bank||''),
    bankDetails:String(profile.bankDetails||''),phone:String(profile.phone||''),whatsapp:String(profile.whatsapp||''),
    email:String(profile.email||''),address:String(profile.address||''),city:String(profile.city||''),notices:String(profile.notices||'')
  },logo:String(company.logo||''),updatedAt:serverTimestamp(),updatedBy};
}
