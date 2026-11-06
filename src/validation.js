export const profileFields = [
  "legalName",
  "tradeName",
  "cnpj",
  "beneficiaryCpf",
  "pixBeneficiary",
  "pixKey",
  "bank",
  "bankDetails",
  "phone",
  "whatsapp",
  "email",
  "address",
  "city",
  "contract",
  "notices",
  "whatsappTemplate",
  "emailTemplate",
  "dueDay",
];
export const longFields = [
  "bankDetails",
  "address",
  "contract",
  "notices",
  "whatsappTemplate",
  "emailTemplate",
];
export const emptyProfile = () =>
  Object.fromEntries(profileFields.map((k) => [k, ""]));
export const digits = (s) => String(s).replace(/\D/g, "");
export const clientFields = [
  "name",
  "taxId",
  "email",
  "phone",
  "whatsapp",
  "address",
  "installationNumber",
  "meterNumber",
  "supplyType",
  "contractStart",
  "tariff",
  "saleTariffDefault",
  "demandCharge",
  "solarDiscountDefault",
  "adjustmentPercent",
  "discountPercent",
  "notes",
  "status",
];
export const consumptionFields = [
  "reference",
  "previousReadDate",
  "currentReadDate",
  "nextReadDate",
  "previousReading",
  "currentReading",
  "multiplier",
  "measuredConsumption",
  "injectedEnergy",
  "saleTariff",
  "demandCharge",
  "sourceInvoiceTotal",
  "adjustmentPercent",
  "operations",
  "tusdConsumption",
  "teConsumption",
  "solarCreditDiscount",
  "tariffFlag",
  "publicLighting",
  "taxes",
  "otherCharges",
  "notes",
  "dueDate",
];
export function validCpf(value) {
  const d = digits(value);
  if (!/^\d{11}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  return [9, 10].every((n) => {
    const r =
      ([...d.slice(0, n)].reduce((s, x, i) => s + Number(x) * (n + 1 - i), 0) *
        10) %
      11;
    return (r === 10 ? 0 : r) === Number(d[n]);
  });
}
export function validCnpj(value) {
  const d = digits(value);
  if (!/^\d{14}$/.test(d) || /^(\d)\1+$/.test(d)) return false;
  return [12, 13].every((n) => {
    const weights =
      n === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const r =
      [...d.slice(0, n)].reduce((s, x, i) => s + Number(x) * weights[i], 0) %
      11;
    return (r < 2 ? 0 : 11 - r) === Number(d[n]);
  });
}
export function normalizeProfile(raw) {
  return Object.fromEntries(
    profileFields.map((k) => [
      k,
      k === "dueDay"
        ? String(raw[k] ?? "").trim() === ""
          ? ""
          : Number(raw[k])
        : String(raw[k] ?? "").trim(),
    ]),
  );
}
export function validateProfile(p) {
  if (!p.legalName || !p.tradeName)
    throw new Error("Informe a razão social e o nome fantasia.");
  for (const key of profileFields) {
    if (key === "dueDay") continue;
    if (
      typeof p[key] !== "string" ||
      p[key].length > (longFields.includes(key) ? 3000 : 200)
    )
      throw new Error("Um dos campos excede o tamanho permitido.");
  }
  if (
    p.dueDay !== "" &&
    (!Number.isInteger(p.dueDay) || p.dueDay < 1 || p.dueDay > 31)
  )
    throw new Error(
      "O dia de vencimento deve ficar em branco ou estar entre 1 e 31.",
    );
  if (p.cnpj && !validCnpj(p.cnpj))
    throw new Error("Confira os dígitos do CNPJ.");
  if (p.beneficiaryCpf && !validCpf(p.beneficiaryCpf))
    throw new Error("Confira os dígitos do CPF do beneficiário.");
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
    throw new Error("Informe um e-mail válido.");
  for (const key of ["phone", "whatsapp"])
    if (p[key] && !/^\d{10,13}$/.test(digits(p[key])))
      throw new Error("Informe telefone e WhatsApp com DDD.");
  if (p.pixKey && !p.pixBeneficiary)
    throw new Error("Informe o beneficiário da chave PIX.");
  return p;
}
export function validImage(value) {
  return (
    typeof value === "string" &&
    (value === "" ||
      (value.length <= 90000 &&
        /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)))
  );
}
export function normalizeClient(raw) {
  const value = Object.fromEntries(
    clientFields.map((key) => [key, String(raw[key] ?? "").trim()]),
  );
  value.tariff = value.tariff === "" ? 0 : Number(value.tariff);
  value.saleTariffDefault =
    value.saleTariffDefault === "" ? 0.918954 : Number(value.saleTariffDefault);
  value.demandCharge =
    value.demandCharge === "" ? 208.76 : Number(value.demandCharge);
  value.solarDiscountDefault =
    value.solarDiscountDefault === "" ? 0 : Number(value.solarDiscountDefault);
  value.adjustmentPercent =
    value.adjustmentPercent === "" ? 0 : Number(value.adjustmentPercent);
  value.discountPercent =
    value.discountPercent === "" ? 0 : Number(value.discountPercent);
  value.status = value.status === "inactive" ? "inactive" : "active";
  return value;
}
export function validateClient(client) {
  if (!client.name)
    throw new Error("Informe o nome completo ou a razão social.");
  if (!client.installationNumber)
    throw new Error("Informe o número da instalação.");
  for (const key of [
    "name",
    "taxId",
    "email",
    "phone",
    "whatsapp",
    "installationNumber",
    "meterNumber",
    "supplyType",
    "contractStart",
    "status",
  ]) {
    if (typeof client[key] !== "string" || client[key].length > 200)
      throw new Error("Um dos campos do cliente excede o limite permitido.");
  }
  for (const key of ["address", "notes"])
    if (typeof client[key] !== "string" || client[key].length > 3000)
      throw new Error("Um texto do cliente excede o limite permitido.");
  const tax = digits(client.taxId);
  if (
    client.taxId &&
    !(tax.length === 11 ? validCpf(tax) : tax.length === 14 && validCnpj(tax))
  )
    throw new Error("Confira os dígitos do CPF ou CNPJ.");
  if (client.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email))
    throw new Error("Informe um e-mail válido para o cliente.");
  for (const key of ["phone", "whatsapp"])
    if (client[key] && !/^\d{10,13}$/.test(digits(client[key])))
      throw new Error("Informe telefone e WhatsApp com DDD.");
  if (client.contractStart && !/^\d{4}-\d{2}-\d{2}$/.test(client.contractStart))
    throw new Error("Informe uma data de início válida.");
  if (!Number.isFinite(client.tariff) || client.tariff < 0)
    throw new Error("A tarifa contratual não pode ser negativa.");
  if (
    !Number.isFinite(client.saleTariffDefault) ||
    client.saleTariffDefault <= 0
  )
    throw new Error("A tarifa TSP padrão deve ser maior que zero.");
  if (!Number.isFinite(client.demandCharge) || client.demandCharge < 0)
    throw new Error("O valor padrão da demanda não pode ser negativo.");
  if (
    !Number.isFinite(client.solarDiscountDefault) ||
    client.solarDiscountDefault < 0
  )
    throw new Error("O desconto TSP Solar padrão não pode ser negativo.");
  if (
    !Number.isFinite(client.adjustmentPercent) ||
    client.adjustmentPercent < -100 ||
    client.adjustmentPercent > 1000
  )
    throw new Error("O ajuste TSP deve ficar entre -100% e 1.000%.");
  if (
    !Number.isFinite(client.discountPercent) ||
    client.discountPercent < 0 ||
    client.discountPercent > 100
  )
    throw new Error("O desconto deve ficar entre 0% e 100%.");
  return client;
}
export function calculatedConsumption(
  previousReading,
  currentReading,
  multiplier,
) {
  const previous = Number(previousReading),
    current = Number(currentReading),
    factor = Number(multiplier);
  if (
    ![previous, current, factor].every(Number.isFinite) ||
    previous < 0 ||
    current < previous ||
    factor <= 0
  )
    return null;
  return Number(((current - previous) * factor).toFixed(3));
}
export function normalizeConsumption(raw) {
  const textKeys = [
    "reference",
    "previousReadDate",
    "currentReadDate",
    "nextReadDate",
    "notes",
    "dueDate",
  ];
  const result = {};
  for (const key of consumptionFields) {
    if (key === "operations") {
      result.operations = Array.isArray(raw.operations)
        ? raw.operations.map((item) => ({
            description: String(item?.description || "").trim(),
            unit: String(item?.unit || "").trim(),
            quantity: Number(item?.quantity || 0),
            aneelTariff: Number(item?.aneelTariff || 0),
            taxedTariff: Number(item?.taxedTariff || 0),
            value: Number(item?.value || 0),
            selected: item?.selected === true,
          }))
        : [];
      continue;
    }
    result[key] = textKeys.includes(key)
      ? String(raw[key] ?? "").trim()
      : Number(raw[key] ?? 0);
  }
  return result;
}
function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number),
    date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
export function validateConsumption(value) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value.reference))
    throw new Error("Informe o mês e o ano de referência.");
  for (const key of [
    "previousReadDate",
    "currentReadDate",
    "nextReadDate",
    "dueDate",
  ])
    if (!validIsoDate(value[key]))
      throw new Error("Informe todas as datas de leitura e o vencimento.");
  if (
    value.previousReadDate &&
    value.currentReadDate &&
    value.currentReadDate < value.previousReadDate
  )
    throw new Error(
      "A leitura atual não pode ocorrer antes da leitura anterior.",
    );
  if (
    value.currentReadDate &&
    value.nextReadDate &&
    value.nextReadDate < value.currentReadDate
  )
    throw new Error(
      "A próxima leitura não pode ocorrer antes da leitura atual.",
    );
  const numeric = consumptionFields.filter(
    (key) =>
      ![
        "reference",
        "previousReadDate",
        "currentReadDate",
        "nextReadDate",
        "notes",
        "dueDate",
        "operations",
        "adjustmentPercent",
      ].includes(key),
  );
  for (const key of numeric)
    if (!Number.isFinite(value[key]) || value[key] < 0)
      throw new Error("Os valores do consumo não podem ser negativos.");
  if (
    !Number.isFinite(value.adjustmentPercent) ||
    value.adjustmentPercent < -100 ||
    value.adjustmentPercent > 1000
  )
    throw new Error("O ajuste TSP deve ficar entre -100% e 1.000%.");
  if (!Array.isArray(value.operations) || value.operations.length > 30)
    throw new Error("A lista de operações possui itens demais.");
  for (const item of value.operations) {
    if (
      !item.description ||
      item.description.length > 200 ||
      item.unit.length > 10 ||
      ![item.quantity, item.aneelTariff, item.taxedTariff].every(
        (number) => Number.isFinite(number) && number >= 0,
      ) ||
      !Number.isFinite(item.value) ||
      Math.abs(item.value) > 10000000 ||
      typeof item.selected !== "boolean"
    )
      throw new Error("Confira as operações importadas da conta CPFL.");
  }
  if (
    value.operations.length &&
    !value.operations.some((item) => item.selected)
  )
    throw new Error("Selecione pelo menos uma operação para a cobrança.");
  if (value.multiplier <= 0)
    throw new Error("O fator multiplicador deve ser maior que zero.");
  if (value.notes.length > 3000)
    throw new Error("As observações excedem o limite permitido.");
  const calculated = value.operations.length
    ? value.measuredConsumption
    : calculatedConsumption(
        value.previousReading,
        value.currentReading,
        value.multiplier,
      );
  if (calculated === null)
    throw new Error("A leitura atual deve ser igual ou maior que a anterior.");
  return {
    ...value,
    calculatedConsumption: calculated,
    manualOverride: Math.abs(value.measuredConsumption - calculated) > 0.0001,
  };
}
export function readBackup(raw) {
  if (!raw || raw.schemaVersion !== 1 || !raw.profile)
    throw new Error(
      "Arquivo incompatível. Use uma cópia de configurações TSP Energy.",
    );
  const profile = validateProfile(normalizeProfile(raw.profile));
  const logo = raw.logo ?? "",
    pixQr = raw.pixQr ?? "";
  if (!validImage(logo) || !validImage(pixQr))
    throw new Error("O arquivo contém uma imagem inválida ou muito grande.");
  if (pixQr && (!profile.pixKey || !profile.pixBeneficiary))
    throw new Error("O QR Code precisa de chave e beneficiário.");
  return { profile, logo, pixQr };
}
export function errorMessage(error) {
  const map = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "auth/invalid-email": "Confira o endereço de e-mail.",
    "auth/user-disabled":
      "Esta conta foi desativada. Procure o responsável pelo sistema.",
    "auth/too-many-requests":
      "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    "auth/network-request-failed":
      "Não foi possível conectar. Confira sua internet.",
    "auth/operation-not-allowed":
      "O login por e-mail não está disponível. Contate o suporte.",
    "auth/configuration-not-found":
      "O acesso ainda não está disponível. Contate o suporte.",
    "permission-denied":
      "Acesso negado. Confira a autorização administrativa e as regras do Firestore.",
    unavailable:
      "O servidor está indisponível. Confira sua conexão e tente novamente.",
    "resource-exhausted":
      "O serviço está temporariamente indisponível. Tente novamente mais tarde.",
  };
  return (
    map[error.code] ||
    (error.code
      ? "Não foi possível concluir a operação. Tente novamente."
      : error.message) ||
    "Ocorreu um erro inesperado."
  );
}
