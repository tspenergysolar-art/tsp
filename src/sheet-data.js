import {
  digits,
  normalizeClient,
  validateClient,
  normalizeConsumption,
  validateConsumption,
} from "./validation.js";

export const clientColumns = [
  [
    "name",
    "Nome completo ou razão social",
    ["nome", "cliente", "razao social", "nome completo"],
  ],
  ["taxId", "CPF ou CNPJ", ["cpf", "cnpj", "cpf cnpj", "documento"]],
  ["email", "E-mail", ["email", "e mail"]],
  ["phone", "Telefone", ["telefone", "fone"]],
  ["whatsapp", "WhatsApp", ["whatsapp", "whats app"]],
  ["address", "Endereço completo", ["endereco", "endereco completo"]],
  [
    "installationNumber",
    "Número da instalação",
    ["instalacao", "numero da instalacao", "uc", "unidade consumidora"],
  ],
  ["meterNumber", "Número do medidor", ["medidor", "numero do medidor"]],
  [
    "supplyType",
    "Tipo de fornecimento",
    ["tipo de fornecimento", "fornecimento"],
  ],
  [
    "contractStart",
    "Data de início do contrato",
    ["inicio do contrato", "data de inicio do contrato"],
  ],
  [
    "saleTariffDefault",
    "Tarifa TSP padrão (R$/kWh)",
    ["tarifa tsp", "tarifa venda tsp", "tarifa padrao"],
  ],
  ["demandCharge", "Demanda padrão (R$)", ["demanda padrao", "demanda fixa"]],
  [
    "solarDiscountDefault",
    "Desconto TSP Solar padrão (R$)",
    ["desconto tsp padrao", "desconto solar padrao"],
  ],
  ["notes", "Observações", ["observacoes", "observacao"]],
  ["status", "Situação", ["situacao", "status"]],
];
export const consumptionColumns = [
  [
    "clientLookup",
    "Cliente / instalação",
    ["cliente", "instalacao", "numero da instalacao", "cpf cnpj", "documento"],
  ],
  [
    "reference",
    "Mês de referência",
    ["referencia", "mes de referencia", "mes ano"],
  ],
  [
    "previousReadDate",
    "Data da leitura anterior",
    ["data leitura anterior", "data da leitura anterior"],
  ],
  [
    "currentReadDate",
    "Data da leitura atual",
    ["data leitura atual", "data da leitura atual"],
  ],
  [
    "nextReadDate",
    "Data da próxima leitura",
    ["proxima leitura", "data proxima leitura", "data da proxima leitura"],
  ],
  [
    "measuredConsumption",
    "Consumo total em kWh",
    ["consumo", "consumo total", "consumo kwh"],
  ],
  [
    "saleTariff",
    "Tarifa TSP do Consumo Ponta",
    ["tarifa tsp", "tarifa consumo ponta"],
  ],
  [
    "demandCharge",
    "Demanda fixa TSP (R$)",
    ["demanda fixa", "demanda tsp"],
  ],
  [
    "sourceInvoiceTotal",
    "Total completo da conta CPFL (R$)",
    ["total conta cpfl", "total completo cpfl"],
  ],
  [
    "solarCreditDiscount",
    "Desconto TSP Solar (R$)",
    ["desconto tsp solar", "desconto solar"],
  ],
  [
    "publicLighting",
    "Contribuição IP-CIP",
    ["ip cip", "cip", "iluminacao publica"],
  ],
  [
    "operations",
    "Operações da cobrança",
    ["operacoes", "operacoes da cobranca"],
  ],
  ["notes", "Observações", ["observacoes", "observacao"]],
  ["dueDate", "Data de vencimento", ["vencimento", "data de vencimento"]],
];
export const columnsFor = (type) =>
  type === "clients" ? clientColumns : consumptionColumns;
export const normalizeHeader = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
export function guessMapping(headers, type) {
  const result = {};
  for (const [key, label, aliases] of columnsFor(type)) {
    const accepted = [label, ...aliases].map(normalizeHeader);
    const index = headers.findIndex((header) =>
      accepted.includes(normalizeHeader(header)),
    );
    result[key] = index < 0 ? "" : String(index);
  }
  return result;
}
export function parseCsv(text) {
  const source = String(text).replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0];
  const delimiter =
    (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length
      ? ";"
      : ",";
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((value) => String(value).trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => String(value).trim() !== "")) rows.push(row);
  return rows;
}
export function makeCsv(rows) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            const text =
              value instanceof Date ? isoDate(value) : String(value ?? "");
            return /[;"\r\n]/.test(text)
              ? `"${text.replace(/"/g, '""')}"`
              : text;
          })
          .join(";"),
      )
      .join("\r\n")
  );
}
export function isoDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.valueOf()))
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  const text = String(value).trim();
  let match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : text;
}
export function monthValue(value) {
  if (value instanceof Date) return isoDate(value).slice(0, 7);
  const text = String(value ?? "").trim();
  let match = text.match(/^(0[1-9]|1[0-2])[\/\-](\d{4})$/);
  if (match) return `${match[2]}-${match[1]}`;
  match = text.match(/^(\d{4})[\/\-](0[1-9]|1[0-2])$/);
  return match ? `${match[1]}-${match[2]}` : text;
}
export function decimalValue(value) {
  if (typeof value === "number") return value;
  if (value === null || value === undefined || String(value).trim() === "")
    return 0;
  let text = String(value).trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (text.includes(",") && text.includes("."))
    text =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  else if (text.includes(",")) text = text.replace(",", ".");
  return Number(text);
}
export function mappedRow(row, mapping) {
  const result = {};
  for (const [key, index] of Object.entries(mapping))
    if (index !== "") result[key] = row[Number(index)] ?? "";
  return result;
}
export function clientFromMapped(raw) {
  return normalizeClient({
    ...raw,
    contractStart: isoDate(raw.contractStart),
    tariff: 0,
    saleTariffDefault:
      raw.saleTariffDefault === "" || raw.saleTariffDefault === undefined
        ? 0.918954
        : decimalValue(raw.saleTariffDefault),
    demandCharge:
      raw.demandCharge === "" || raw.demandCharge === undefined
        ? 208.76
        : decimalValue(raw.demandCharge),
    solarDiscountDefault: decimalValue(raw.solarDiscountDefault),
    adjustmentPercent: 0,
    discountPercent: 0,
    status: normalizeHeader(raw.status) === "inativo" ? "inactive" : "active",
  });
}
function operationValue(value) {
  if (Array.isArray(value)) return value;
  if (!value || String(value).trim() === "") return [];
  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new Error(
      "As operações da cobrança devem estar no formato do modelo exportado.",
    );
  }
}
export function consumptionFromMapped(raw) {
  return normalizeConsumption({
    ...raw,
    reference: monthValue(raw.reference),
    previousReadDate: isoDate(raw.previousReadDate),
    currentReadDate: isoDate(raw.currentReadDate),
    nextReadDate: isoDate(raw.nextReadDate),
    dueDate: isoDate(raw.dueDate),
    previousReading: 0,
    currentReading: 0,
    multiplier: 1,
    measuredConsumption: decimalValue(raw.measuredConsumption),
    injectedEnergy: 0,
    saleTariff:
      raw.saleTariff === "" || raw.saleTariff === undefined
        ? 0.918954
        : decimalValue(raw.saleTariff),
    demandCharge:
      raw.demandCharge === "" || raw.demandCharge === undefined
        ? 208.76
        : decimalValue(raw.demandCharge),
    sourceInvoiceTotal: decimalValue(raw.sourceInvoiceTotal),
    adjustmentPercent: 0,
    operations: operationValue(raw.operations),
    tusdConsumption: 0,
    teConsumption: 0,
    solarCreditDiscount: decimalValue(raw.solarCreditDiscount),
    tariffFlag: 0,
    publicLighting: decimalValue(raw.publicLighting),
    taxes: 0,
    otherCharges: 0,
  });
}
export function resolveClient(lookup, clients) {
  const raw = String(lookup ?? "").trim(),
    normalized = normalizeHeader(raw),
    onlyDigits = digits(raw);
  const matches = clients.filter(
    (client) =>
      normalizeHeader(client.installationNumber) === normalized ||
      normalizeHeader(client.name) === normalized ||
      (onlyDigits &&
        [
          client.taxIdDigits,
          client.phoneDigits,
          client.whatsappDigits,
        ].includes(onlyDigits)),
  );
  return matches.length === 1 ? matches[0] : null;
}
export function validateImportRows(
  type,
  rows,
  mapping,
  existingClients = [],
  existingConsumptions = [],
) {
  const seen = new Set();
  return rows.map((row, index) => {
    const raw = mappedRow(row, mapping),
      errors = [],
      warnings = [];
    let value = null,
      client = null;
    try {
      if (type === "clients") {
        value = validateClient(clientFromMapped(raw));
        const identity = value.installationNumber.toLocaleLowerCase("pt-BR");
        if (seen.has(identity))
          errors.push("Instalação repetida dentro da planilha.");
        seen.add(identity);
        const tax = digits(value.taxId),
          phone = digits(value.phone);
        const duplicate = existingClients.find(
          (item) =>
            (tax && item.taxIdDigits === tax) ||
            (phone && item.phoneDigits === phone) ||
            item.installationNumber.toLocaleLowerCase("pt-BR") === identity,
        );
        if (duplicate)
          warnings.push(`Possível duplicidade com ${duplicate.name}.`);
      } else {
        client = resolveClient(raw.clientLookup, existingClients);
        if (!client)
          throw new Error("Cliente não encontrado ou referência ambígua.");
        value = validateConsumption(consumptionFromMapped(raw));
        const identity = `${client.id}--${value.reference}`;
        if (seen.has(identity))
          errors.push("Cliente e referência repetidos dentro da planilha.");
        seen.add(identity);
        if (existingConsumptions.some((item) => item.id === identity))
          errors.push("Já existe lançamento para este cliente e mês.");
      }
    } catch (error) {
      errors.push(error.message);
    }
    return {
      line: index + 2,
      raw,
      value,
      client,
      errors,
      warnings,
      valid: errors.length === 0,
    };
  });
}
