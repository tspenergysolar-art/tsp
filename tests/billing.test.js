import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyBillingSettings,
  normalizeBillingSettings,
  calculateInvoice,
  buildInvoiceSnapshot,
} from "../src/billing.js";

const client = {
  id: "c1",
  name: "Cliente",
  taxId: "",
  email: "",
  phone: "",
  whatsapp: "",
  address: "",
  installationNumber: "UC-1",
  meterNumber: "M-1",
  supplyType: "Bifásico",
  tariff: 0.8,
  saleTariffDefault: 0.918954,
  adjustmentPercent: 10,
  discountPercent: 10,
};
const consumption = {
  id: "c1--2026-10",
  reference: "2026-10",
  previousReadDate: "2026-09-15",
  currentReadDate: "2026-10-15",
  nextReadDate: "2026-11-15",
  previousReading: 100,
  currentReading: 250,
  multiplier: 1,
  measuredConsumption: 150,
  injectedEnergy: 100,
  tusdConsumption: 50,
  teConsumption: 30,
  solarCreditDiscount: 5,
  tariffFlag: 3,
  publicLighting: 7,
  taxes: 2,
  otherCharges: 1,
  notes: "Observação do cadastro mensal",
  dueDate: "2026-10-25",
  manualOverride: false,
};

test("configurações financeiras começam zeradas e são validadas", () => {
  assert.deepEqual(emptyBillingSettings(), {
    useClientTariff: true,
    injectedRate: 0,
    tusdRate: 0,
    teRate: 0,
    icmsRate: 0,
    pisRate: 0,
    cofinsRate: 0,
  });
  assert.throws(
    () =>
      calculateInvoice(consumption, client, {
        ...emptyBillingSettings(),
        icmsRate: 101,
      }),
    /alíquotas/,
  );
});
test("calcula itens, descontos e tributos sem duplicar tributos no total", () => {
  const settings = {
    ...emptyBillingSettings(),
    tusdRate: 0.2,
    teRate: 0.3,
    icmsRate: 18,
    pisRate: 1.65,
    cofinsRate: 7.6,
  };
  const result = calculateInvoice(consumption, client, settings);
  assert.equal(result.items[0].value, 80);
  assert.equal(result.items[1].value, 10);
  assert.equal(result.items[2].value, 9);
  assert.equal(result.items[7].value, -8);
  assert.equal(result.total, 99);
  assert.equal(result.taxes[0].base, 99);
  assert.equal(result.taxes[0].value, 17.82);
});
test("tarifa, datas e observação mensal ficam preservadas na fatura", () => {
  const monthly = { ...consumption, saleTariff: 0.65 };
  const settings = emptyBillingSettings(),
    result = calculateInvoice(monthly, client, settings);
  assert.equal(result.items[0].rate, 0.65);
  assert.equal(result.items[0].value, 65);
  const invoice = buildInvoiceSnapshot({
    id: "invoice-monthly",
    client,
    consumption: monthly,
    company: { versionId: "company-version" },
    settings,
    calculation: result,
    history: [],
    issueDate: "2026-10-16",
    dueDate: monthly.dueDate,
  });
  assert.equal(invoice.consumption.saleTariff, 0.65);
  assert.equal(invoice.consumption.nextReadDate, "2026-11-15");
  assert.equal(invoice.notes, "Observação do cadastro mensal");
  assert.equal(invoice.items[0].rate, 0.65);
});
test("total manual é identificado e snapshot limita histórico a seis meses", () => {
  const settings = normalizeBillingSettings({
    useClientTariff: false,
    injectedRate: 0.5,
  });
  const calc = calculateInvoice(consumption, client, settings, "40");
  assert.equal(calc.total, 40);
  assert.equal(calc.manualOverride, true);
  const history = Array.from({ length: 8 }, (_, i) => ({
    reference: `2026-0${i + 1}`,
    measuredConsumption: i + 1,
  }));
  const invoice = buildInvoiceSnapshot({
    id: "invoice-1",
    client,
    consumption,
    company: { versionId: "company-version" },
    settings,
    calculation: calc,
    history,
    issueDate: "2026-10-16",
    dueDate: consumption.dueDate,
  });
  assert.equal(invoice.history.length, 6);
  assert.equal(invoice.companyVersionId, "company-version");
  assert.equal(invoice.client.name, "Cliente");
});
test("usa tarifa fixa no Consumo Ponta, demanda fixa e desconto em reais", () => {
  const monthly = {
    ...consumption,
    saleTariff: 0.918954,
    demandCharge: 208.76,
    sourceInvoiceTotal: 1572.85,
    solarCreditDiscount: 1026.46,
    adjustmentPercent: 0,
    publicLighting: 20.42,
    operations: [
      {
        description: "Consumo Ponta [KWh] - TUSD SET/26",
        unit: "kWh",
        quantity: 302.6992,
        aneelTariff: 1.35157,
        taxedTariff: 1.71196356,
        value: 518.21,
        selected: true,
      },
      {
        description: "Consumo Fora Ponta [KWh] - TUSD SET/26",
        unit: "kWh",
        quantity: 4856.6554,
        value: 1009.85,
        selected: false,
      },
      {
        description: "Adicional Band Amarela Ponta SET/26",
        unit: "kWh",
        quantity: 0,
        value: 7.23,
        selected: true,
      },
      {
        description: "Adicional Band Amarela FPonta SET/26",
        unit: "kWh",
        quantity: 0,
        value: 115.96,
        selected: true,
      },
      {
        description: "Uso Sist Distr Geração [kW] SET/26",
        unit: "kW",
        quantity: 45,
        value: 326.7,
        selected: true,
      },
      {
        description: "Consumo Reativo Exc Ponta SET/26",
        unit: "kWh",
        quantity: 48,
        value: 17.65,
        selected: true,
      },
      {
        description: "Consumo Reativo Exc Fora Ponta SET/26",
        unit: "kWh",
        quantity: 634.3086,
        value: 233.16,
        selected: true,
      },
      {
        description: "Demanda [kW] - TUSD SET/26",
        unit: "kW",
        quantity: 30,
        value: 515.06,
        selected: true,
      },
      {
        description: "Outros descontos",
        unit: "R$",
        quantity: 1,
        value: -769.71,
        selected: true,
      },
    ],
  };
  const result = calculateInvoice(monthly, client, emptyBillingSettings());
  assert.equal(result.operationBase, 4880.96);
  assert.equal(result.adjustmentPercent, 0);
  assert.equal(result.adjustmentValue, -1026.46);
  assert.equal(result.total, 3854.5);
  assert.equal(result.items[0].code, "CONSUMO_PONTA");
  assert.equal(result.items[0].description, "Consumo Ponta + Fora Ponta [kWh]");
  assert.equal(result.items[0].quantity, 5159.3546);
  assert.equal(result.items[0].value, 4741.21);
  assert.equal(result.items[0].taxedTariff, 0.918954);
  assert.equal(
    result.items.find((item) => item.code === "DEMANDA").value,
    208.76,
  );
  assert.equal(
    result.items.find((item) => item.code === "DESCONTO_TSP").value,
    -1026.46,
  );
  assert.equal(
    result.items.find((item) => item.code === "SUBTOTAL").value,
    3854.5,
  );
  assert.equal(result.items.at(-1).value, 20.42);
  assert.equal(result.items.at(-1).affectsTotal, false);
  assert.equal(result.sourceInvoiceTotal, 1572.85);
  assert.equal(result.sourceSubtotal, 1552.43);
  assert.equal(result.formulaVersion, 6);
});
test("desconto em reais não transforma o total em valor negativo", () => {
  const monthly = {
    ...consumption,
    saleTariff: 0.918954,
    demandCharge: 208.76,
    sourceInvoiceTotal: 20,
    solarCreditDiscount: 2000,
    publicLighting: 20,
    operations: [
      {
        description: "Demanda [kW] - TUSD",
        unit: "kW",
        quantity: 30,
        value: 208.76,
        selected: true,
      },
    ],
  };
  const result = calculateInvoice(monthly, client, emptyBillingSettings());
  assert.equal(result.items.find((item) => item.code === "SUBTOTAL").value, 0);
  assert.equal(result.total, 0);
});
