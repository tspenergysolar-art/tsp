export const emptyBillingSettings = () => ({
  useClientTariff: true,
  injectedRate: 0,
  tusdRate: 0,
  teRate: 0,
  icmsRate: 0,
  pisRate: 0,
  cofinsRate: 0,
});

const round = (value, digits = 2) =>
  Number((Number(value) || 0).toFixed(digits));
export function normalizeBillingSettings(raw = {}) {
  const result = emptyBillingSettings();
  result.useClientTariff =
    raw.useClientTariff === true ||
    raw.useClientTariff === "on" ||
    raw.useClientTariff === "true";
  for (const key of [
    "injectedRate",
    "tusdRate",
    "teRate",
    "icmsRate",
    "pisRate",
    "cofinsRate",
  ])
    result[key] = Number(raw[key] || 0);
  return result;
}
export function validateBillingSettings(value) {
  for (const key of ["injectedRate", "tusdRate", "teRate"])
    if (!Number.isFinite(value[key]) || value[key] < 0)
      throw new Error(
        "As tarifas devem ser números iguais ou maiores que zero.",
      );
  for (const key of ["icmsRate", "pisRate", "cofinsRate"])
    if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > 100)
      throw new Error("As alíquotas devem ficar entre 0% e 100%.");
  if (typeof value.useClientTariff !== "boolean")
    throw new Error("Selecione a origem da tarifa de energia injetada.");
  return value;
}

export function calculateInvoice(consumption, client, settings, override = "") {
  validateBillingSettings(settings);
  if (Array.isArray(consumption.operations) && consumption.operations.length) {
    const saleTariff = Number(
        consumption.saleTariff || client.saleTariffDefault || 0.918954,
      ),
      classify = (description) =>
        /^Consumo Ponta\b.*TUSD/i.test(description)
          ? "CONSUMO_PONTA"
          : /^Adicional Band/i.test(description)
            ? "BANDEIRA"
            : /^Uso Sist Distr Gera/i.test(description)
              ? "SIST_DISTR_GERACAO"
              : /^Consumo Reativo Exc Ponta/i.test(description)
                ? "REATIVO_PONTA"
                : /^Demanda \[kW\]/i.test(description)
                  ? "DEMANDA"
                  : "";
    const allOperations = consumption.operations.filter((item) =>
        String(item?.description || "").trim(),
      ),
      consumptionSource = allOperations.find(
        (item) => classify(String(item.description)) === "CONSUMO_PONTA",
      ),
      demandSource = allOperations.find(
        (item) => classify(String(item.description)) === "DEMANDA",
      ),
      demandCharge = Number(
        consumption.demandCharge ?? client.demandCharge ?? 208.76,
      ),
      publicLighting = round(consumption.publicLighting),
      sourceTotal = round(
        consumption.sourceInvoiceTotal ||
          allOperations.reduce((sum, item) => sum + Number(item.value || 0), 0) +
            publicLighting,
      ),
      sourceSubtotal = round(Math.max(0, sourceTotal - publicLighting)),
      consumptionOriginal = round(consumptionSource?.value || 0),
      consumptionAdjusted = round(
        Number(consumptionSource?.quantity || 0) * saleTariff,
      ),
      demandOriginal = round(demandSource?.value || 0),
      adjustedBase = round(
        sourceSubtotal -
          consumptionOriginal +
          consumptionAdjusted -
          demandOriginal +
          demandCharge,
      );
    const operations = allOperations
      .filter(
        (item) =>
          item?.selected === true && String(item.description || "").trim(),
      )
      .map((item, index) => {
        const description = String(item.description).trim(),
          code = classify(description) || `CPFL_OP_${index + 1}`,
          quantity = Number(item.quantity || 0),
          energy = code === "CONSUMO_PONTA";
        return {
          code,
          description,
          quantity,
          unit: String(item.unit || ""),
          aneelTariff: Number(item.aneelTariff || 0),
          taxedTariff: energy ? saleTariff : Number(item.taxedTariff || 0),
          rate: energy ? saleTariff : Number(item.taxedTariff || 0),
          value:
            code === "CONSUMO_PONTA"
              ? consumptionAdjusted
              : code === "DEMANDA"
                ? round(demandCharge)
                : round(item.value),
        };
      });
    if (!operations.length)
      throw new Error("Selecione pelo menos uma operação da conta CPFL.");
    const operationBase = adjustedBase,
      solarDiscount = round(
        Math.abs(Number(consumption.solarCreditDiscount || 0)),
      ),
      subtotal = Math.max(0, round(operationBase - solarDiscount)),
      hiddenBase = round(
        adjustedBase - operations.reduce((sum, item) => sum + item.value, 0),
      );
    const items = [
      ...operations,
      ...(solarDiscount > 0
        ? [
            {
              code: "DESCONTO_TSP",
              description: "Desconto TSP Solar",
              quantity: 1,
              unit: "R$",
              rate: solarDiscount,
              value: -solarDiscount,
            },
          ]
        : []),
      {
        code: "SUBTOTAL",
        description: "Subtotal",
        quantity: 1,
        unit: "R$",
        rate: subtotal,
        value: subtotal,
      },
      {
        code: "IP_CIP",
        description: `Contribuição Custeio IP-CIP${consumption.reference ? ` ${String(consumption.reference).slice(5, 7)}/${String(consumption.reference).slice(2, 4)}` : ""}`,
        quantity: 1,
        unit: "R$",
        rate: publicLighting,
        value: publicLighting,
      },
    ];
    const calculatedTotal = Math.max(0, round(subtotal + publicLighting));
    const hasOverride = String(override).trim() !== "",
      total = hasOverride ? round(Number(override)) : calculatedTotal;
    if (!Number.isFinite(total) || total < 0)
      throw new Error(
        "O total manual deve ser um valor válido e não negativo.",
      );
    return {
      items,
      calculatedTotal,
      total,
      manualOverride: hasOverride && Math.abs(total - calculatedTotal) > 0.009,
      taxes: [],
      operationBase,
      adjustmentPercent: 0,
      adjustmentValue: -solarDiscount,
      sourceInvoiceTotal: sourceTotal,
      sourceSubtotal,
      hiddenBase,
      formulaVersion: 4,
    };
  }
  const monthlyRate = Number(consumption.saleTariff || 0);
  const injectedRate =
    monthlyRate > 0
      ? monthlyRate
      : settings.useClientTariff
        ? Number(client.tariff || 0)
        : settings.injectedRate;
  const grossEnergy = round(
    Number(consumption.injectedEnergy || 0) * injectedRate,
  );
  const contractDiscount = round(
    (grossEnergy * Number(client.discountPercent || 0)) / 100,
  );
  const items = [
    {
      code: "ENERGIA",
      description: "Energia injetada",
      quantity: Number(consumption.injectedEnergy || 0),
      unit: "kWh",
      rate: injectedRate,
      value: grossEnergy,
    },
    {
      code: "TUSD",
      description: "Consumo TUSD",
      quantity: Number(consumption.tusdConsumption || 0),
      unit: "kWh",
      rate: settings.tusdRate,
      value: round(
        Number(consumption.tusdConsumption || 0) * settings.tusdRate,
      ),
    },
    {
      code: "TE",
      description: "Consumo TE",
      quantity: Number(consumption.teConsumption || 0),
      unit: "kWh",
      rate: settings.teRate,
      value: round(Number(consumption.teConsumption || 0) * settings.teRate),
    },
    {
      code: "BANDEIRA",
      description: "Adicional de bandeira tarifária",
      quantity: 1,
      unit: "un",
      rate: Number(consumption.tariffFlag || 0),
      value: round(consumption.tariffFlag),
    },
    {
      code: "ILUMINACAO",
      description: "Contribuição de iluminação pública",
      quantity: 1,
      unit: "un",
      rate: Number(consumption.publicLighting || 0),
      value: round(consumption.publicLighting),
    },
    {
      code: "ENCARGOS",
      description: "Tributos e encargos informados",
      quantity: 1,
      unit: "un",
      rate: Number(consumption.taxes || 0),
      value: round(consumption.taxes),
    },
    {
      code: "OUTROS",
      description: "Outros lançamentos",
      quantity: 1,
      unit: "un",
      rate: Number(consumption.otherCharges || 0),
      value: round(consumption.otherCharges),
    },
    {
      code: "DESCONTO_CONTRATO",
      description: `Desconto contratual (${round(client.discountPercent || 0)}%)`,
      quantity: 1,
      unit: "un",
      rate: contractDiscount,
      value: -contractDiscount,
    },
    {
      code: "CREDITO_SOLAR",
      description: "Desconto de crédito solar",
      quantity: 1,
      unit: "un",
      rate: Number(consumption.solarCreditDiscount || 0),
      value: -round(consumption.solarCreditDiscount),
    },
  ];
  const calculatedTotal = round(
    items.reduce((sum, item) => sum + item.value, 0),
  );
  const hasOverride = String(override).trim() !== "";
  const total = hasOverride
    ? round(Number(override))
    : Math.max(0, calculatedTotal);
  if (!Number.isFinite(total) || total < 0)
    throw new Error("O total manual deve ser um valor válido e não negativo.");
  const taxBase = Math.max(
    0,
    round(
      items
        .filter((i) => ["ENERGIA", "TUSD", "TE"].includes(i.code))
        .reduce((s, i) => s + i.value, 0),
    ),
  );
  const taxes = ["icms", "pis", "cofins"].map((name) => ({
    name: name.toUpperCase(),
    base: taxBase,
    rate: settings[`${name}Rate`],
    value: round((taxBase * settings[`${name}Rate`]) / 100),
  }));
  return {
    items,
    calculatedTotal: Math.max(0, calculatedTotal),
    total,
    manualOverride: hasOverride && Math.abs(total - calculatedTotal) > 0.009,
    taxes,
    operationBase: 0,
    adjustmentPercent: 0,
    adjustmentValue: 0,
    formulaVersion: 1,
  };
}

export function buildInvoiceSnapshot({
  id,
  client,
  consumption,
  company,
  settings,
  calculation,
  history = [],
  issueDate,
  dueDate,
  line = "",
  barcode = "",
  notes = "",
  supersedesInvoiceId = "",
}) {
  return {
    schemaVersion: 1,
    id,
    status: "issued",
    reference: consumption.reference,
    issueDate,
    dueDate,
    companyVersionId: company.versionId,
    clientId: client.id,
    consumptionId: consumption.id,
    client: {
      name: client.name,
      taxId: client.taxId,
      email: client.email,
      phone: client.phone,
      whatsapp: client.whatsapp,
      address: client.address,
      installationNumber: client.installationNumber,
      meterNumber: client.meterNumber,
      supplyType: client.supplyType,
      tariff: Number(client.tariff || 0),
      saleTariffDefault: Number(client.saleTariffDefault || 0.918954),
      demandCharge: Number(client.demandCharge || 0),
      solarDiscountDefault: Number(client.solarDiscountDefault || 0),
      adjustmentPercent: 0,
      discountPercent: 0,
    },
    consumption: {
      previousReadDate: consumption.previousReadDate,
      currentReadDate: consumption.currentReadDate,
      nextReadDate: consumption.nextReadDate,
      previousReading: Number(consumption.previousReading),
      currentReading: Number(consumption.currentReading),
      multiplier: Number(consumption.multiplier),
      measuredConsumption: Number(consumption.measuredConsumption),
      injectedEnergy: Number(consumption.injectedEnergy),
      saleTariff: Number(consumption.saleTariff || 0),
      demandCharge: Number(consumption.demandCharge || 0),
      sourceInvoiceTotal: Number(consumption.sourceInvoiceTotal || 0),
      publicLighting: Number(consumption.publicLighting || 0),
      solarCreditDiscount: Number(consumption.solarCreditDiscount || 0),
      adjustmentPercent: 0,
      operations: Array.isArray(consumption.operations)
        ? consumption.operations.map((item) => ({ ...item }))
        : [],
      manualOverride: consumption.manualOverride === true,
    },
    billingSettings: {
      ...settings,
      operationBase: Number(calculation.operationBase || 0),
      adjustmentPercent: Number(calculation.adjustmentPercent || 0),
      adjustmentValue: Number(calculation.adjustmentValue || 0),
    },
    items: calculation.items,
    taxes: calculation.taxes,
    calculatedTotal: calculation.calculatedTotal,
    total: calculation.total,
    totalManualOverride: calculation.manualOverride,
    formulaVersion: calculation.formulaVersion,
    history: history
      .slice(0, 6)
      .map((c) => ({
        reference: c.reference,
        consumption: Number(c.measuredConsumption || 0),
      })),
    line: String(line).trim(),
    barcode: String(barcode).trim(),
    notes: String(notes).trim() || String(consumption.notes || "").trim(),
    supersedesInvoiceId: String(supersedesInvoiceId || ""),
    cancelledAt: null,
    cancelledBy: "",
    cancellationReason: "",
  };
}
