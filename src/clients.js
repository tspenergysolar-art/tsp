import {
  listClients,
  saveClient,
  findDuplicateClients,
  listConsumptions,
  saveConsumption,
  deleteConsumption,
  listInvoices,
  listPayments,
  loadBillingSettings,
} from "./database.js";
import { normalizeClient, normalizeConsumption } from "./validation.js";
import { financialRows, financeStatusLabels } from "./finance.js";
import { calculateInvoice, normalizeBillingSettings } from "./billing.js";
import { escapeHtml as e, icon, toast } from "./ui.js";
import {
  readCpflPdf,
  cpflFieldsToDraft,
  findClientForCpfl,
  findDuplicateCpfl,
  DEFAULT_TSP_TARIFF,
  DEFAULT_DEMAND_SHARE,
} from "./cpfl-reader.js";
import {
  getCustomerAccess,
  provisionCustomerAccess,
  revokeCustomerAccess,
  resendCustomerAccess,
  resetCustomerAccess,
} from "./customer-access.js";

const number = (value, digits = 3) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(
    Number(value) || 0,
  );
const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value) || 0,
  );
const month = (value) =>
  value ? `${value.slice(5, 7)}/${value.slice(0, 4)}` : "—";
const date = (value) => (value ? value.split("-").reverse().join("/") : "—");
const emptyClient = {
  name: "",
  taxId: "",
  email: "",
  phone: "",
  whatsapp: "",
  address: "",
  installationNumber: "",
  meterNumber: "",
  supplyType: "",
  contractStart: "",
  tariff: 0,
  saleTariffDefault: DEFAULT_TSP_TARIFF,
  demandCharge: 208.76,
  solarDiscountDefault: 0,
  adjustmentPercent: 0,
  discountPercent: 0,
  notes: "",
  status: "active",
};
const emptyConsumption = {
  reference: "",
  previousReadDate: "",
  currentReadDate: "",
  nextReadDate: "",
  previousReading: 0,
  currentReading: 0,
  multiplier: 1,
  measuredConsumption: 0,
  injectedEnergy: 0,
  saleTariff: DEFAULT_TSP_TARIFF,
  demandCharge: DEFAULT_DEMAND_SHARE,
  sourceInvoiceTotal: 0,
  adjustmentPercent: 0,
  operations: [],
  tusdConsumption: 0,
  teConsumption: 0,
  solarCreditDiscount: 0,
  tariffFlag: 0,
  publicLighting: 0,
  taxes: 0,
  otherCharges: 0,
  notes: "",
  dueDate: "",
};
const input = (name, label, value, type = "text", options = "") =>
  `<label class="field">${label}<input name="${name}" type="${type}" value="${e(value)}" ${options}></label>`;
const area = (name, label, value) =>
  `<label class="field span-two">${label}<textarea name="${name}" rows="3" maxlength="3000">${e(value)}</textarea></label>`;
const loading = (container) =>
  (container.innerHTML =
    '<div class="loading-card"><div class="spinner"></div><p>Carregando dados…</p></div>');
const showError = (container, error) =>
  (container.innerHTML = `<div class="notice error">${e(error.message || "Não foi possível carregar os dados.")}</div>`);

export async function mountClients(container, company) {
  loading(container);
  try {
    renderList(container, await listClients(), company);
  } catch (error) {
    showError(container, error);
  }
}
function renderList(container, clients, company) {
  container.innerHTML = `<div class="page-heading"><div><span class="eyebrow">CADASTRO E CONSULTA</span><h1>Clientes</h1><p>${clients.length} cliente${clients.length === 1 ? "" : "s"} cadastrado${clients.length === 1 ? "" : "s"}.</p></div><button class="button primary" id="new-client">${icon("users")} Novo cliente</button></div><section class="filter-bar"><label class="search-field">${icon("search")}<input id="client-search" placeholder="Pesquisar nome, CPF/CNPJ, instalação ou telefone" autocomplete="off"></label><select id="client-status" aria-label="Filtrar situação"><option value="">Todos</option><option value="active">Ativos</option><option value="inactive">Inativos</option></select></section><div id="client-list"></div>`;
  const draw = () => {
    const term = document
      .querySelector("#client-search")
      .value.trim()
      .toLocaleLowerCase("pt-BR")
      .replace(/\D/g, "");
    const raw = document
      .querySelector("#client-search")
      .value.trim()
      .toLocaleLowerCase("pt-BR");
    const status = document.querySelector("#client-status").value;
    const filtered = clients.filter(
      (c) =>
        (!status || c.status === status) &&
        (!raw ||
          [c.name, c.taxId, c.installationNumber, c.phone].some((v) =>
            String(v || "")
              .toLocaleLowerCase("pt-BR")
              .includes(raw),
          ) ||
          (term &&
            [c.taxIdDigits, c.phoneDigits].some((v) =>
              String(v || "").includes(term),
            ))),
    );
    document.querySelector("#client-list").innerHTML = filtered.length
      ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Cliente</th><th>CPF/CNPJ</th><th>Instalação</th><th>Contato</th><th>Situação</th><th></th></tr></thead><tbody>${filtered.map((c) => `<tr><td><strong>${e(c.name)}</strong><small>${e(c.email || "Sem e-mail")}</small></td><td>${e(c.taxId || "—")}</td><td>${e(c.installationNumber)}</td><td>${e(c.phone || c.whatsapp || "—")}</td><td><span class="status-badge ${c.status}">${c.status === "active" ? "Ativo" : "Inativo"}</span></td><td><button class="text-button" data-client="${e(c.id)}">Abrir</button></td></tr>`).join("")}</tbody></table></div>`
      : '<div class="empty-state"><h2>Nenhum cliente encontrado</h2><p>Revise os filtros ou cadastre um novo cliente.</p></div>';
    document.querySelectorAll("[data-client]").forEach(
      (button) =>
        (button.onclick = () =>
          renderClient(
            container,
            clients.find((c) => c.id === button.dataset.client),
            clients,
            company,
          )),
    );
  };
  document.querySelector("#new-client").onclick = () =>
    renderClient(container, null, clients, company);
  document.querySelector("#client-search").oninput = draw;
  document.querySelector("#client-status").onchange = draw;
  draw();
}
async function renderClient(container, client, clients, company) {
  const value = client || emptyClient;
  const accessMarkup = client
    ? `<section class="form-section customer-access-section"><div class="section-heading"><span class="section-number">03</span><div><h2>Acesso do cliente</h2><p>Libere uma área individual para consultar faturas, pagamentos e consumos.</p></div></div><div id="customer-access"><div class="spinner"></div></div></section>`
    : "";
  container.innerHTML = `<div class="page-heading"><div><button class="back-button" id="back-clients">← Voltar aos clientes</button><span class="eyebrow">${client ? "DETALHES DO CLIENTE" : "NOVO CADASTRO"}</span><h1>${e(client?.name || "Cadastrar cliente")}</h1><p>${client ? "Revise o cadastro e os lançamentos mensais." : "Preencha apenas dados necessários para a operação."}</p></div>${client ? `<span class="status-badge ${client.status}">${client.status === "active" ? "Ativo" : "Inativo"}</span>` : ""}</div><form id="client-form"><section class="form-section"><div class="section-heading"><span class="section-number">01</span><div><h2>Identificação e contato</h2><p>Dados do titular e meios de contato.</p></div></div><div class="form-grid">${input("name", "Nome completo ou razão social", value.name, "text", 'required maxlength="200"')}${input("taxId", "CPF ou CNPJ", value.taxId, "text", 'inputmode="numeric" maxlength="20"')}${input("email", "E-mail", value.email, "email", 'maxlength="200"')}${input("phone", "Telefone", value.phone, "tel", 'maxlength="30"')}${input("whatsapp", "WhatsApp", value.whatsapp, "tel", 'maxlength="30"')}${input("contractStart", "Início do contrato", value.contractStart, "date")}${area("address", "Endereço completo", value.address)}</div></section><section class="form-section"><div class="section-heading"><span class="section-number">02</span><div><h2>Unidade consumidora</h2><p>Identificação técnica e condição padrão de cobrança.</p></div></div><div class="form-grid">${input("installationNumber", "Número da instalação", value.installationNumber, "text", 'required maxlength="200"')}${input("meterNumber", "Número do medidor", value.meterNumber, "text", 'maxlength="200"')}${input("supplyType", "Tipo de fornecimento", value.supplyType, "text", 'maxlength="200"')}<label class="field sale-tariff-field"><span>Ajuste TSP padrão <b>%</b></span><input name="adjustmentPercent" type="number" min="-100" max="1000" step="0.001" value="${e(value.adjustmentPercent ?? 10)}" required><small>Valor positivo aumenta e valor com sinal de menos reduz o total original da fatura CPFL.</small></label><input name="tariff" type="hidden" value="${e(value.tariff || 0)}"><input name="discountPercent" type="hidden" value="${e(value.discountPercent || 0)}"><label class="field">Situação<select name="status"><option value="active" ${value.status === "active" ? "selected" : ""}>Ativo</option><option value="inactive" ${value.status === "inactive" ? "selected" : ""}>Inativo</option></select></label>${area("notes", "Observações", value.notes)}</div></section><div id="client-error" class="notice error" hidden></div><div class="form-actions"><button type="button" class="button secondary" id="cancel-client">Cancelar</button><button type="submit" class="button primary" data-online>${icon("check")} Salvar cliente</button></div></form>${accessMarkup}${client ? '<section id="client-history" class="history-section"><div><h2>Movimentação do cliente</h2><p class="muted">Consumos, faturas e pagamentos.</p></div><div class="spinner"></div></section>' : ""}`;
  document
    .querySelector("#client-form")
    .insertAdjacentHTML(
      "beforeend",
      `<input name="saleTariffDefault" type="hidden" value="${e(value.saleTariffDefault ?? DEFAULT_TSP_TARIFF)}"><input name="demandCharge" type="hidden" value="${e(value.demandCharge ?? DEFAULT_DEMAND_SHARE)}"><input name="solarDiscountDefault" type="hidden" value="${e(value.solarDiscountDefault ?? 0)}">`,
    );
  document.querySelector('#client-form [name="adjustmentPercent"]').value = 0;
  const back = () => renderList(container, clients, company);
  document.querySelector("#back-clients").onclick = back;
  document.querySelector("#cancel-client").onclick = back;
  document.querySelector("#client-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget,
      button = form.querySelector("[type=submit]"),
      error = document.querySelector("#client-error");
    error.hidden = true;
    try {
      const normalized = normalizeClient(
        Object.fromEntries(new FormData(form)),
      );
      const duplicates = await findDuplicateClients(
        normalized,
        client?.id || "",
      );
      if (
        duplicates.length &&
        !confirm(
          `Encontramos cadastro semelhante: ${duplicates.map((d) => d.name).join(", ")}. Deseja salvar mesmo assim?`,
        )
      )
        return;
      button.disabled = true;
      button.textContent = "Salvando…";
      const id = await saveClient(
        normalized,
        client?.revision || 0,
        client?.id,
      );
      toast("Cliente salvo com sucesso.");
      const updated = await listClients();
      renderClient(
        container,
        updated.find((c) => c.id === id),
        updated,
        company,
      );
    } catch (ex) {
      error.textContent = ex.message;
      error.hidden = false;
      button.disabled = false;
      button.innerHTML = `${icon("check")} Salvar cliente`;
    }
  };
  if (client) {
    loadCustomerAccess(
      document.querySelector("#customer-access"),
      client,
      company,
    );
    loadClientHistory(document.querySelector("#client-history"), client);
  }
}
async function loadCustomerAccess(host, client, company) {
  try {
    const account = await getCustomerAccess(client.id),
      portalUrl = `${location.origin}${import.meta.env.BASE_URL}portal.html`,
      accountManagementUrl =
        "https://console.firebase.google.com/project/tsp-energy/authentication/users";
    if (!account) {
      host.innerHTML = `<div class="customer-access-grid"><div><span class="status-badge inactive">Não liberado</span><h3>Crie o acesso com o e-mail do cadastro</h3><p>${client.email ? `O cliente entrará com <strong>${e(client.email)}</strong> e a senha inicial definida abaixo.` : "Cadastre um e-mail válido e salve o cliente primeiro."}</p><label class="customer-password-field">Senha inicial<input id="customer-initial-password" type="text" value="tsp123" minlength="6" maxlength="128" autocomplete="new-password" ${client.email ? "" : "disabled"}><small>Você pode alterar antes de liberar. Informe esta senha ao cliente por um meio seguro.</small></label></div><button class="button primary" id="enable-customer-access" ${client.email ? "" : "disabled"}>${icon("shield")} Liberar acesso</button></div><div id="customer-access-error" class="notice error" hidden></div>`;
      const button = host.querySelector("#enable-customer-access");
      if (button)
        button.onclick = async () => {
          const error = host.querySelector("#customer-access-error"),
            password = host.querySelector("#customer-initial-password").value;
          error.hidden = true;
          if (password.length < 6) {
            error.textContent =
              "A senha inicial precisa ter pelo menos 6 caracteres.";
            error.hidden = false;
            return;
          }
          button.disabled = true;
          button.textContent = "Criando acesso…";
          try {
            await provisionCustomerAccess(client, company, password);
            toast("Acesso criado com a senha inicial informada.");
            await loadCustomerAccess(host, client, company);
          } catch (ex) {
            error.textContent = ex.message;
            error.hidden = false;
            button.disabled = false;
            button.innerHTML = `${icon("shield")} Liberar acesso`;
          }
        };
      return;
    }
    const emailChanged =
      String(client.email || "")
        .trim()
        .toLowerCase() !==
      String(account.email || "")
        .trim()
        .toLowerCase();
    host.innerHTML = `<div class="customer-access-grid"><div><span class="status-badge ${account.active ? "active" : "inactive"}">${account.active ? "Acesso ativo" : "Acesso bloqueado"}</span><h3>${e(account.email)}</h3><p>Portal individual vinculado somente a este cliente.</p></div><div class="customer-access-actions"><button class="button secondary" id="copy-portal-link">Copiar link</button><button class="button secondary" id="resend-customer-access">Enviar senha</button><a class="button secondary" href="${accountManagementUrl}" target="_blank" rel="noopener">Gerenciar contas</a><button class="button secondary" id="reset-customer-access">Redefinir acesso</button><button class="button ${account.active ? "danger-button" : "primary"}" id="toggle-customer-access">${account.active ? "Bloquear acesso" : "Reativar acesso"}</button></div></div><div class="portal-link"><span>Link do cliente</span><code>${e(portalUrl)}</code></div>${emailChanged ? `<div class="notice warning">O cadastro agora usa <strong>${e(client.email)}</strong>. Remova a conta antiga <strong>${e(account.email)}</strong> em <strong>Gerenciar contas</strong> e clique em <strong>Redefinir acesso</strong>.</div>` : ""}<div id="customer-access-error" class="notice error" hidden></div>`;
    host.querySelector("#copy-portal-link").onclick = async () => {
      await navigator.clipboard.writeText(portalUrl);
      toast("Link da área do cliente copiado.");
    };
    host.querySelector("#resend-customer-access").onclick = async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await resendCustomerAccess(account);
        toast("E-mail para criar ou redefinir a senha enviado.");
      } catch (ex) {
        showAccessError(host, ex);
      } finally {
        button.disabled = false;
      }
    };
    host.querySelector("#reset-customer-access").onclick = async (event) => {
      const nextEmail = String(client.email || "")
        .trim()
        .toLowerCase();
      if (!nextEmail)
        return showAccessError(
          host,
          new Error(
            "Cadastre e salve o novo e-mail do cliente antes de redefinir o acesso.",
          ),
        );
      if (
        nextEmail ===
        String(account.email || "")
          .trim()
          .toLowerCase()
      )
        return showAccessError(
          host,
          new Error(
            "Altere e salve o e-mail do cliente antes de redefinir o acesso.",
          ),
        );
      if (
        !confirm(
          `Confirma que a conta ${account.email} já foi excluída em Gerenciar contas? O vínculo antigo será removido e você poderá liberar o acesso para ${nextEmail}.`,
        )
      )
        return;
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "Redefinindo…";
      try {
        await resetCustomerAccess(account);
        toast(
          "Vínculo antigo removido. Agora clique em Liberar acesso para o novo e-mail.",
        );
        await loadCustomerAccess(host, client, company);
      } catch (ex) {
        showAccessError(host, ex);
        button.disabled = false;
        button.textContent = "Redefinir acesso";
      }
    };
    host.querySelector("#toggle-customer-access").onclick = async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        if (account.active) {
          await revokeCustomerAccess(account);
          toast("Acesso do cliente bloqueado.");
        } else {
          await provisionCustomerAccess(client, company);
          toast("Acesso reativado e e-mail de senha enviado.");
        }
        await loadCustomerAccess(host, client, company);
      } catch (ex) {
        showAccessError(host, ex);
        button.disabled = false;
      }
    };
  } catch (error) {
    host.innerHTML = `<div class="notice error">${e(error.message)}</div>`;
  }
}
function showAccessError(host, error) {
  const box = host.querySelector("#customer-access-error");
  box.textContent = error.message || "Não foi possível concluir.";
  box.hidden = false;
}
async function loadClientHistory(section, client) {
  try {
    const [consumptions, invoices, payments] = await Promise.all([
      listConsumptions(client.id),
      listInvoices("", client.id),
      listPayments(),
    ]);
    const financial = financialRows(
      invoices,
      payments,
      new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    );
    section.innerHTML = `<div class="history-title"><div><h2>Consumo mensal</h2><p class="muted">${consumptions.length} lançamento${consumptions.length === 1 ? "" : "s"} registrado${consumptions.length === 1 ? "" : "s"}</p></div></div>${consumptions.length ? `<div class="table-wrap"><table><thead><tr><th>Referência</th><th>Consumo</th><th>Vencimento</th></tr></thead><tbody>${consumptions.map((c) => `<tr><td><strong>${month(c.reference)}</strong></td><td>${number(c.measuredConsumption)} kWh ${c.manualOverride ? '<small class="manual-tag">Manual</small>' : ""}</td><td>${date(c.dueDate)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty-state compact"><p>Nenhum consumo lançado para este cliente.</p></div>'}<div class="history-title"><div><h2>Faturas e pagamentos</h2><p class="muted">Valores emitidos, recebidos e pendentes.</p></div></div>${financial.length ? `<div class="table-wrap"><table><thead><tr><th>Referência</th><th>Vencimento</th><th>Total</th><th>Recebido</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>${financial.map((i) => `<tr><td><strong>${month(i.reference)}</strong></td><td>${date(i.dueDate)}</td><td>${money(i.total)}</td><td>${money(i.received)}</td><td>${money(i.balance)}</td><td>${financeStatusLabels[i.status]}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty-state compact"><p>Nenhuma fatura emitida para este cliente.</p></div>'}`;
  } catch (error) {
    section.innerHTML = `<div class="notice error">${e(error.message)}</div>`;
  }
}

export async function mountConsumption(container) {
  loading(container);
  try {
    const [allClients, billing] = await Promise.all([
      listClients(),
      loadBillingSettings(),
    ]);
    const clients = allClients.filter((c) => c.status === "active");
    renderConsumption(
      container,
      clients,
      null,
      null,
      null,
      normalizeBillingSettings(billing || {}),
    );
  } catch (error) {
    showError(container, error);
  }
}
const cpflRelevantKeys = [
  "reference",
  "dueDate",
  "previousReadDate",
  "currentReadDate",
  "nextReadDate",
  "billedConsumption",
];
function cpflReaderMarkup() {
  return `<section class="form-section cpfl-reader"><div class="section-heading"><span class="section-number">02</span><div><h2>Ler conta de energia CPFL</h2><p>Selecione o PDF para preencher o cadastro mensal com mais rapidez.</p></div></div><div id="cpfl-drop-zone" class="cpfl-drop-zone" tabindex="0" role="button"><div class="cpfl-drop-icon">${icon("upload")}</div><div><strong>Escolher conta CPFL em PDF</strong><p>Você também pode arrastar o arquivo para esta área.</p></div><label class="button secondary">Selecionar PDF<input id="cpfl-file" class="file-input" type="file" accept="application/pdf,.pdf"></label></div><div class="cpfl-privacy">${icon("shield")} A leitura acontece somente neste aparelho. O PDF não é enviado nem armazenado e é descartado assim que a leitura termina.</div><div id="cpfl-progress" class="cpfl-progress" hidden><div><span id="cpfl-progress-label">Preparando leitura…</span><strong id="cpfl-progress-value">0%</strong></div><progress max="100" value="0"></progress></div><div id="cpfl-error" class="notice error" hidden></div><div id="cpfl-review"></div></section>`;
}
function consumptionClientGateMarkup(clients, selected) {
  return `<section class="form-section consumption-client-gate"><div class="section-heading"><span class="section-number">01</span><div><h2>${selected ? "Cliente selecionado" : "Selecione o cliente para começar"}</h2><p>${selected ? "Confira o cliente e a instalação antes de continuar." : "A leitura do PDF e os campos do mês serão liberados somente depois desta escolha."}</p></div></div><label class="field consumption-client-picker"><span>Cliente e unidade consumidora <b>OBRIGATÓRIO</b></span><select id="consumption-client-gate" aria-label="Selecionar cliente para o cadastro mensal" required><option value="">Escolha um cliente</option>${clients.map((client) => `<option value="${e(client.id)}" ${client.id === selected?.id ? "selected" : ""}>${e(client.name)} · ${e(client.installationNumber)}</option>`).join("")}</select><small>${selected ? `Selecionado: ${e(selected.name)} · instalação ${e(selected.installationNumber)}` : "Confirme o nome e o número da instalação. Nenhum cliente é escolhido automaticamente."}</small></label>${selected ? "" : '<div class="consumption-gate-locked">Após selecionar o cliente, as etapas de leitura da conta e lançamento serão abertas.</div>'}</section>`;
}
function operationRowsMarkup(operations = []) {
  if (!operations.length)
    return '<div class="empty-state compact" id="operation-empty"><p>Nenhuma operação carregada. Leia a conta CPFL ou adicione uma linha manualmente.</p></div><div id="operation-rows"></div>';
  return `<div id="operation-rows" class="operation-editor">${operations.map((item, index) => operationRowMarkup(item, index)).join("")}</div>`;
}
function operationRowMarkup(item, index) {
  return `<div class="operation-editor-row" data-operation-row><label class="operation-check"><input type="checkbox" data-operation-selected ${item.selected !== false ? "checked" : ""} aria-label="Incluir operação"></label><label class="field operation-description">Descrição da operação<input type="text" data-operation-description maxlength="200" value="${e(item.description || "")}"></label><label class="field operation-unit">Unid. med.<input type="text" data-operation-unit maxlength="10" value="${e(item.unit || "")}"></label><label class="field operation-quantity">Quant. faturada<input type="number" data-operation-quantity min="0" step="0.0001" value="${e(Number(item.quantity) || 0)}"></label><label class="field operation-tariff">Tarifa ANEEL<input type="number" data-operation-aneel step="0.00000001" min="0" value="${e(Number(item.aneelTariff) || 0)}"></label><label class="field operation-tariff">Tarifa usada<input type="number" data-operation-taxed step="0.00000001" min="0" value="${e(Number(item.taxedTariff) || 0)}"></label><label class="field operation-value">Valor da operação (R$)<input type="number" data-operation-value step="0.01" value="${e(Number(item.value) || 0)}"></label><button type="button" class="text-button danger-text" data-remove-operation aria-label="Remover operação ${index + 1}">Remover</button></div>`;
}
function readOperationRows(host) {
  return [...host.querySelectorAll("[data-operation-row]")]
    .map((row) => ({
      description: row
        .querySelector("[data-operation-description]")
        .value.trim(),
      unit: row.querySelector("[data-operation-unit]").value.trim(),
      quantity: Number(
        row.querySelector("[data-operation-quantity]").value || 0,
      ),
      aneelTariff: Number(
        row.querySelector("[data-operation-aneel]").value || 0,
      ),
      taxedTariff: Number(
        row.querySelector("[data-operation-taxed]").value || 0,
      ),
      value: Number(row.querySelector("[data-operation-value]").value || 0),
      selected: row.querySelector("[data-operation-selected]").checked,
    }))
    .filter((item) => item.description);
}
function renderCpflReview(
  host,
  result,
  clients,
  currentClient,
  billing,
  onApply,
) {
  const matched = findClientForCpfl(result.fields, clients),
    selectedId = currentClient?.id || "",
    fields = result.fields.filter((item) =>
      cpflRelevantKeys.includes(item.key),
    );
  const chosenClient = clients.find((item) => item.id === selectedId),
    mismatchedClient = Boolean(
      matched && chosenClient && matched.id !== chosenClient.id,
    ),
    defaultTariff =
      Number(chosenClient?.saleTariffDefault) || DEFAULT_TSP_TARIFF,
    defaultDemand = Number(chosenClient?.demandCharge) || DEFAULT_DEMAND_SHARE,
    defaultDiscount = Number(chosenClient?.solarDiscountDefault) || 0,
    operations = result.operations || [],
    cip = Number(result.summary?.publicLighting || 0);
  host.innerHTML = `<div class="cpfl-review-head"><div><span class="eyebrow">REVISÃO OBRIGATÓRIA</span><h3>Confira os dados encontrados</h3><p>${e(result.fileName)} · ${e(result.method)} · o PDF foi usado somente para preencher os dados e descartado após a leitura</p></div><span class="status-badge">PDF descartado</span></div><div class="notice ${mismatchedClient ? "error" : matched ? "success" : "warning"}">${mismatchedClient ? `A instalação do PDF parece pertencer a <strong>${e(matched.name)}</strong>, mas o cliente travado é <strong>${e(chosenClient.name)}</strong>. Cancele a leitura e troque o cliente antes de continuar.` : matched ? `Cliente confirmado pelo número da UC: <strong>${e(chosenClient.name)}</strong>.` : `Não foi possível confirmar automaticamente a UC. Confira se a conta pertence a <strong>${e(chosenClient.name)}</strong>.`}</div><div class="cpfl-field-groups"><fieldset><legend>Dados do mês</legend>${fields.map((item) => `<label class="cpfl-field-row ${item.status}"><input type="checkbox" data-cpfl-check="${e(item.key)}" ${item.value ? "checked" : ""} ${item.value ? "" : "disabled"}><span><b>${e(item.label)}</b><small>${item.value ? "Identificado" : "Não identificado"}${item.unit ? ` · ${e(item.unit)}` : ""}</small></span><input type="text" data-cpfl-value="${e(item.key)}" value="${e(item.value)}" placeholder="Não identificado" ${item.value ? "" : "disabled"}></label>`).join("")}</fieldset></div><div class="cpfl-operation-review"><div class="history-title"><div><h3>Operações usadas na fatura TSP</h3><p class="muted">Consumo Ponta e Fora Ponta são somados para formar uma única quantidade. Marque as demais operações que devem entrar na cobrança.</p></div></div>${operations.length ? `<div class="table-wrap"><table><thead><tr><th>Usar</th><th>Descrição da operação</th><th>Unid. med.</th><th>Quant. faturada</th><th>Tarifa ANEEL</th><th>Tarifa usada</th><th>Valor original CPFL</th></tr></thead><tbody>${operations.map((item, index) => `<tr><td><input type="checkbox" data-cpfl-operation-check="${index}" ${item.selected ? "checked" : ""}></td><td>${e(item.description)}</td><td>${e(item.unit)}</td><td>${number(item.quantity, 4)}</td><td>${number(item.aneelTariff, 8)}</td><td>${number(item.taxedTariff, 8)}</td><td><input class="cpfl-operation-value" type="number" step="0.01" data-cpfl-operation-value="${index}" value="${e(item.value)}"></td></tr>`).join("")}</tbody></table></div>` : '<div class="notice warning">A tabela de operações não foi identificada. Confira se este é o PDF completo da CPFL.</div>'}</div><div class="cpfl-apply"><div class="cpfl-locked-client"><span>Cliente travado para este lançamento</span><strong>${e(chosenClient.name)}</strong><small>Instalação ${e(chosenClient.installationNumber)}</small><input id="cpfl-client" type="hidden" value="${e(selectedId)}"></div><label class="field">Tarifa TSP do Consumo Ponta + Fora Ponta (R$/kWh)<input id="cpfl-sale-tariff" type="number" min="0" step="0.000001" value="${e(defaultTariff)}"></label><label class="field">Desconto TSP Solar (R$)<input id="cpfl-solar-discount" type="number" min="0" step="0.01" value="0"></label><label class="field">Custeio IP-CIP (R$)<input id="cpfl-cip" type="number" min="0" step="0.01" value="${e(cip)}"></label><div id="cpfl-estimate" class="cpfl-estimate"></div></div><div class="notice info">A cobrança soma os kWh de Consumo Ponta e Fora Ponta e multiplica pela tarifa TSP. Depois soma as operações marcadas e a demanda manual, abate o desconto e acrescenta a IP-CIP.</div><div class="form-actions"><button type="button" class="button secondary" id="cpfl-cancel">Cancelar leitura</button><button type="button" class="button primary" id="cpfl-apply" ${mismatchedClient ? "disabled" : ""}>${mismatchedClient ? "Troque o cliente para continuar" : "Usar dados conferidos"}</button></div>`;
  host
    .querySelector("#cpfl-sale-tariff")
    .closest("label")
    .insertAdjacentHTML(
      "afterend",
      `<label class="field">Demanda fixa rateada (R$)<input id="cpfl-demand" type="number" min="0" step="0.01" value="${e(defaultDemand)}"></label>`,
    );
  host.querySelector("#cpfl-solar-discount").value = defaultDiscount;
  const sync = () => {
    for (const item of fields) {
      const value = host.querySelector(`[data-cpfl-value="${item.key}"]`),
        check = host.querySelector(`[data-cpfl-check="${item.key}"]`);
      if (value) item.value = value.value;
      if (check) item.selected = check.checked;
    }
    operations.forEach((item, index) => {
      item.selected =
        host.querySelector(`[data-cpfl-operation-check="${index}"]`)
          ?.checked === true;
      item.value = Number(
        host.querySelector(`[data-cpfl-operation-value="${index}"]`)?.value ||
          0,
      );
    });
    const demand = Number(host.querySelector("#cpfl-demand").value || 0),
      tariff = Number(host.querySelector("#cpfl-sale-tariff").value || 0),
      discount = Number(host.querySelector("#cpfl-solar-discount").value || 0),
      fullTotal = Number(result.summary?.distributorInvoiceTotal || 0),
      lighting = Number(host.querySelector("#cpfl-cip").value || 0);
    const preview = calculateInvoice(
        {
          operations,
          saleTariff: tariff,
          demandCharge: demand,
          solarCreditDiscount: discount,
          sourceInvoiceTotal: fullTotal,
          publicLighting: lighting,
          reference:
            result.fields.find((item) => item.key === "reference")?.value ||
            "2000-01",
        },
        chosenClient,
        billing,
      ),
      energy = preview.items.find((item) => item.code === "CONSUMO_PONTA");
    host.querySelector("#cpfl-estimate").innerHTML =
      `<span>Total previsto</span><strong>${money(preview.total)}</strong><small>${number(energy?.quantity || 0, 4)} kWh × R$ ${number(tariff, 6)} · desconto ${money(discount)} · IP-CIP ${money(lighting)}</small>`;
  };
  host
    .querySelectorAll(
      "[data-cpfl-value],[data-cpfl-check],[data-cpfl-operation-check],[data-cpfl-operation-value],#cpfl-sale-tariff,#cpfl-demand,#cpfl-solar-discount,#cpfl-cip",
    )
    .forEach((control) => control.addEventListener("input", sync));
  sync();
  host.querySelector("#cpfl-cancel").onclick = () => {
    host.innerHTML = "";
  };
  host.querySelector("#cpfl-apply").onclick = () => {
    sync();
    onApply(
      result,
      host.querySelector("#cpfl-client").value,
      Number(host.querySelector("#cpfl-sale-tariff").value || 0),
      Number(host.querySelector("#cpfl-demand").value || 0),
      Number(host.querySelector("#cpfl-solar-discount").value || 0),
      Number(host.querySelector("#cpfl-cip").value || 0),
    );
  };
}
function bindCpflReader(container, clients, selected, records, billing) {
  const input = container.querySelector("#cpfl-file"),
    zone = container.querySelector("#cpfl-drop-zone"),
    progress = container.querySelector("#cpfl-progress"),
    label = container.querySelector("#cpfl-progress-label"),
    meter = progress.querySelector("progress"),
    percent = container.querySelector("#cpfl-progress-value"),
    error = container.querySelector("#cpfl-error"),
    review = container.querySelector("#cpfl-review");
  const read = async (file) => {
    if (!file) return;
    error.hidden = true;
    review.innerHTML = "";
    progress.hidden = false;
    zone.classList.add("busy");
    try {
      const result = await readCpflPdf(file, (message, value) => {
        label.textContent = message;
        meter.value = value;
        percent.textContent = `${Math.round(value)}%`;
      });
      meter.value = 100;
      percent.textContent = "100%";
      label.textContent = "Leitura concluída";
      renderCpflReview(
        review,
        result,
        clients,
        selected,
        billing,
        async (
          data,
          clientId,
          saleTariff,
          demandCharge,
          solarDiscount,
          publicLighting,
        ) => {
          const draft = cpflFieldsToDraft(
              data.fields,
              data.operations,
              saleTariff,
              demandCharge,
              solarDiscount,
              { ...data.summary, publicLighting },
            ),
            allRecords =
              clientId === selected?.id
                ? records
                : await listConsumptions(clientId),
            duplicate = findDuplicateCpfl(
              allRecords,
              clientId,
              draft.reference,
            );
          if (duplicate) {
            if (
              !confirm(
                `Já existe um cadastro para ${month(draft.reference)}. Deseja abrir esse registro para correção com os dados lidos?`,
              )
            )
              return;
            await renderConsumption(
              container,
              clients,
              clientId,
              duplicate,
              draft,
              billing,
            );
            return;
          }
          await renderConsumption(
            container,
            clients,
            clientId,
            null,
            draft,
            billing,
          );
        },
      );
    } catch (ex) {
      error.textContent = ex.message || "Não foi possível ler o PDF.";
      error.hidden = false;
    } finally {
      input.value = "";
      file = null;
      zone.classList.remove("busy");
    }
  };
  input.onchange = () => read(input.files?.[0]);
  zone.ondragover = (event) => {
    event.preventDefault();
    zone.classList.add("dragging");
  };
  zone.ondragleave = () => zone.classList.remove("dragging");
  zone.ondrop = (event) => {
    event.preventDefault();
    zone.classList.remove("dragging");
    read(event.dataTransfer.files?.[0]);
  };
  zone.onkeydown = (event) => {
    if ((event.key === "Enter" || event.key === " ") && event.target === zone) {
      event.preventDefault();
      input.click();
    }
  };
}
async function renderConsumption(
  container,
  clients,
  selectedId,
  editing = null,
  draft = null,
  billing = { useClientTariff: true, injectedRate: 0 },
) {
  const selected = clients.find((c) => c.id === selectedId) || null;
  let records = [];
  if (selected) records = await listConsumptions(selected.id);
  const value = {
    ...emptyConsumption,
    saleTariff: Number(selected?.saleTariffDefault) || DEFAULT_TSP_TARIFF,
    demandCharge: Number(selected?.demandCharge) || DEFAULT_DEMAND_SHARE,
    solarCreditDiscount: Number(selected?.solarDiscountDefault) || 0,
    adjustmentPercent: 0,
    ...(editing || {}),
    ...(draft || {}),
  };
  container.innerHTML = `<div class="page-heading"><div><span class="eyebrow">CADASTRO MENSAL</span><h1>Cadastro mensal</h1><p>Escolha o cliente, leia a conta CPFL, confira as operações e salve o consumo do mês.</p></div></div>${clients.length ? `${consumptionClientGateMarkup(clients, selected)}${selected ? `${cpflReaderMarkup()}<section class="form-section"><div class="section-heading"><span class="section-number">03</span><div><h2>Consumo e cobrança</h2><p>Somamos os kWh de Consumo Ponta e Fora Ponta, aplicamos a tarifa TSP e acrescentamos as operações marcadas.</p></div></div>${draft ? '<div class="notice success">Os dados selecionados na leitura foram preenchidos. Nada foi salvo ainda.</div>' : ""}<form id="consumption-form"><input name="clientId" type="hidden" value="${e(selected.id)}"><input name="previousReading" type="hidden" value="0"><input name="currentReading" type="hidden" value="0"><input name="multiplier" type="hidden" value="1"><input name="injectedEnergy" type="hidden" value="0"><input name="saleTariff" type="hidden" value="0"><input name="tusdConsumption" type="hidden" value="0"><input name="teConsumption" type="hidden" value="0"><input name="solarCreditDiscount" type="hidden" value="0"><input name="tariffFlag" type="hidden" value="0"><input name="taxes" type="hidden" value="0"><input name="otherCharges" type="hidden" value="0"><div class="form-grid">${input("reference", "Mês de referência", value.reference, "month", "required")}${input("previousReadDate", "Data da leitura anterior", value.previousReadDate, "date", "required")}${input("currentReadDate", "Data da leitura atual", value.currentReadDate, "date", "required")}${input("nextReadDate", "Data da próxima leitura", value.nextReadDate, "date", "required")}${input("measuredConsumption", "Consumo total para o histórico (kWh)", value.measuredConsumption, "number", 'min="0" step="0.0001" required')}${input("sourceInvoiceTotal", "Total informado na conta CPFL (R$)", value.sourceInvoiceTotal, "number", 'min="0" step="0.01" required')}<div class="field sale-tariff-field"><span>Tarifa TSP do Consumo Ponta + Fora Ponta <b>R$/kWh</b></span><input name="saleTariff" aria-label="Tarifa TSP" type="number" min="0" step="0.000001" value="${e(value.saleTariff)}" required><small id="sale-tariff-help">Multiplicada pela soma dos kWh de Consumo Ponta e Fora Ponta.</small><button type="button" class="button sale-tariff-save" id="save-default-tariff" data-online>${icon("check")} Salvar como tarifa padrão</button></div><div class="field sale-tariff-field"><span>Demanda fixa rateada <b>R$</b></span><input name="demandCharge" aria-label="Demanda fixa" type="number" min="0" step="0.01" value="${e(value.demandCharge)}" required><small id="demand-charge-help">Valor calculado manualmente pelo cliente e somado à cobrança.</small><button type="button" class="button sale-tariff-save" id="save-default-demand" data-online>${icon("check")} Salvar como demanda padrão</button></div><div class="field sale-tariff-field"><span>Desconto TSP Solar <b>R$</b></span><input name="solarCreditDiscount" aria-label="Desconto TSP Solar" type="number" min="0" step="0.01" value="${e(value.solarCreditDiscount)}" required><small id="solar-discount-help">Valor manual em reais abatido antes da IP-CIP.</small><button type="button" class="button sale-tariff-save" id="save-default-discount" data-online>${icon("check")} Salvar como desconto padrão</button></div>${input("publicLighting", "Custeio IP-CIP (R$)", value.publicLighting, "number", 'min="0" step="0.01" required')}${input("dueDate", "Data de vencimento", value.dueDate, "date", "required")}${area("notes", "Observações", value.notes)}</div><section class="monthly-operations"><div class="history-title"><div><h2>Operações usadas na cobrança</h2><p class="muted">Consumo Fora Ponta entra junto do Consumo Ponta na quantidade de energia. Marque as demais operações que devem ser somadas.</p></div><button type="button" class="button secondary small-button" id="add-operation">Adicionar operação</button></div>${operationRowsMarkup(value.operations)}</section><div id="calculation-info" class="calculation-box"></div>${editing ? '<div class="notice warning">Você está corrigindo um lançamento existente. Confira os valores antes de salvar.</div>' : ""}<div id="consumption-error" class="notice error" hidden></div><div class="form-actions">${editing ? '<button type="button" id="cancel-edit-consumption" class="button secondary">Cancelar correção</button>' : ""}<button type="submit" class="button primary" data-online>${icon("check")} ${editing ? "Salvar correção" : "Salvar lançamento"}</button></div></form></section><section class="history-section"><div><h2>Lançamentos de ${e(selected.name)}</h2><p class="muted">Consumo, conta CPFL de origem, desconto e IP-CIP registrados em cada mês.</p></div>${records.length ? `<div class="table-wrap"><table><thead><tr><th>Referência</th><th>Consumo</th><th>Conta CPFL</th><th>IP-CIP</th><th>Operações usadas</th><th></th></tr></thead><tbody>${records.map((c) => `<tr><td><strong>${month(c.reference)}</strong><small>${date(c.currentReadDate)}</small></td><td>${number(c.measuredConsumption)} kWh</td><td>${c.sourceInvoiceTotal > 0 ? money(c.sourceInvoiceTotal) : "—"}</td><td>${money(c.publicLighting)}</td><td>${Array.isArray(c.operations) ? c.operations.filter((item) => item.selected).length : 0} selecionadas</td><td><div class="row-actions"><button class="text-button" data-consumption="${e(c.id)}">Corrigir</button><button class="text-button danger-text" data-delete-consumption="${e(c.id)}">Excluir</button></div></td></tr>`).join("")}</tbody></table></div>` : '<div class="empty-state compact"><p>Nenhum consumo lançado para este cliente.</p></div>'}</section>` : ""}` : '<div class="empty-state"><h2>Cadastre um cliente ativo primeiro</h2><p>O lançamento mensal depende de uma unidade consumidora ativa.</p></div>'}`;
  const clientGate = container.querySelector("#consumption-client-gate");
  if (clientGate)
    clientGate.onchange = (event) => {
      if (event.target.value)
        renderConsumption(
          container,
          clients,
          event.target.value,
          null,
          null,
          billing,
        );
    };
  if (!selected) return;
  bindCpflReader(container, clients, selected, records, billing);
  const form = container.querySelector("#consumption-form"),
    rowsHost = container.querySelector("#operation-rows");
  form.onsubmit = (event) => event.preventDefault();
  form.querySelector('input[name="saleTariff"][type="hidden"]')?.remove();
  form
    .querySelector('input[name="solarCreditDiscount"][type="hidden"]')
    ?.remove();
  const calc = () => {
      const tariff = Number(form.elements.saleTariff.value || 0),
        demand = Number(form.elements.demandCharge.value || 0),
        discount = Number(form.elements.solarCreditDiscount.value || 0),
        operations = readOperationRows(container),
        sourceTotal = Number(form.elements.sourceInvoiceTotal.value || 0),
        publicLighting = Number(form.elements.publicLighting.value || 0);
      if (!operations.some((item) => item.selected)) {
        container.querySelector("#calculation-info").innerHTML =
          "Leia a conta CPFL ou adicione uma operação para visualizar o cálculo.";
        return;
      }
      const preview = calculateInvoice(
          {
            operations,
            saleTariff: tariff,
            demandCharge: demand,
            solarCreditDiscount: discount,
            sourceInvoiceTotal: sourceTotal,
            publicLighting,
            reference: form.elements.reference.value,
          },
          selected,
          billing,
        ),
        energy = preview.items.find((item) => item.code === "CONSUMO_PONTA"),
        demandItem = preview.items.find((item) => item.code === "DEMANDA"),
        otherCharges =
          preview.operationBase -
          Number(energy?.value || 0) -
          Number(demandItem?.value || 0);
      container.querySelector("#calculation-info").innerHTML =
        `Energia: <strong>${number(energy?.quantity || 0, 4)} kWh × R$ ${number(tariff, 6)} = ${money(energy?.value || 0)}</strong><span class="sale-estimate">Outras operações: <strong>${money(otherCharges)}</strong> · Demanda manual: <strong>${money(demandItem?.value || 0)}</strong> · Desconto: <strong>− ${money(discount)}</strong> · IP-CIP: <strong>${money(publicLighting)}</strong> · Total previsto: <strong>${money(preview.total)}</strong></span>`;
    };
  const bindOperationControls = () => {
    container
      .querySelectorAll(
        "[data-operation-selected],[data-operation-quantity],[data-operation-value]",
      )
      .forEach((control) => (control.oninput = calc));
    container.querySelectorAll("[data-remove-operation]").forEach(
      (button) =>
        (button.onclick = () => {
          button.closest("[data-operation-row]").remove();
          calc();
        }),
    );
  };
  bindOperationControls();
  [
    "saleTariff",
    "solarCreditDiscount",
    "sourceInvoiceTotal",
    "publicLighting",
  ].forEach((name) =>
    form.elements[name].addEventListener("input", calc),
  );
  form.elements.demandCharge.addEventListener("input", calc);
  calc();
  container.querySelector("#add-operation").onclick = () => {
    container.querySelector("#operation-empty")?.remove();
    const index = container.querySelectorAll("[data-operation-row]").length;
    rowsHost.insertAdjacentHTML(
      "beforeend",
      operationRowMarkup(
        {
          description: "",
          unit: "",
          quantity: 0,
          aneelTariff: 0,
          taxedTariff: 0,
          value: 0,
          selected: true,
        },
        index,
      ),
    );
    bindOperationControls();
    rowsHost
      .querySelector(
        "[data-operation-row]:last-child [data-operation-description]",
      )
      .focus();
    calc();
  };
  container.querySelector("#save-default-tariff").onclick = async (event) => {
    const button = event.currentTarget,
      help = container.querySelector("#sale-tariff-help"),
      tariff = Number(form.elements.saleTariff.value);
    if (!Number.isFinite(tariff) || tariff <= 0) {
      help.textContent = "Informe uma tarifa maior que zero.";
      help.classList.add("field-error");
      form.elements.saleTariff.focus();
      return;
    }
    try {
      button.disabled = true;
      button.textContent = "Salvando padrão…";
      await saveClient(
        normalizeClient({
          ...selected,
          saleTariffDefault: tariff,
          adjustmentPercent: 0,
        }),
        selected.revision || 0,
        selected.id,
      );
      selected.saleTariffDefault = tariff;
      selected.adjustmentPercent = 0;
      selected.revision = (selected.revision || 0) + 1;
      help.textContent = `Tarifa padrão deste cliente atualizada para R$ ${number(tariff, 6)}/kWh.`;
      help.classList.remove("field-error");
      button.innerHTML = `${icon("check")} Tarifa padrão salva`;
      toast("Nova tarifa padrão salva para este cliente.");
    } catch (ex) {
      help.textContent = ex.message;
      help.classList.add("field-error");
      button.disabled = false;
      button.innerHTML = `${icon("check")} Salvar como tarifa padrão`;
    }
  };
  const saveMoneyDefault = async (event, field, inputName, helpId, label) => {
    const button = event.currentTarget,
      help = container.querySelector(`#${helpId}`),
      amount = Number(form.elements[inputName].value);
    if (!Number.isFinite(amount) || amount < 0) {
      help.textContent = "Informe um valor igual ou maior que zero.";
      help.classList.add("field-error");
      form.elements[inputName].focus();
      return;
    }
    try {
      button.disabled = true;
      button.textContent = "Salvando padrão…";
      await saveClient(
        normalizeClient({ ...selected, [field]: amount, adjustmentPercent: 0 }),
        selected.revision || 0,
        selected.id,
      );
      selected[field] = amount;
      selected.revision = (selected.revision || 0) + 1;
      help.textContent = `${label} padrão atualizado para ${money(amount)}.`;
      help.classList.remove("field-error");
      button.innerHTML = `${icon("check")} Padrão salvo`;
      toast(`${label} padrão salvo para este cliente.`);
    } catch (ex) {
      help.textContent = ex.message;
      help.classList.add("field-error");
      button.disabled = false;
      button.innerHTML = `${icon("check")} Salvar como padrão`;
    }
  };
  container.querySelector("#save-default-demand").onclick = (event) =>
    saveMoneyDefault(
      event,
      "demandCharge",
      "demandCharge",
      "demand-charge-help",
      "Demanda",
    );
  container.querySelector("#save-default-discount").onclick = (event) =>
    saveMoneyDefault(
      event,
      "solarDiscountDefault",
      "solarCreditDiscount",
      "solar-discount-help",
      "Desconto TSP Solar",
    );
  container.querySelector("#consumption-client-gate").onchange = (event) =>
    renderConsumption(
      container,
      clients,
      event.target.value,
      null,
      null,
      billing,
    );
  container.querySelectorAll("[data-consumption]").forEach(
    (button) =>
      (button.onclick = () =>
        renderConsumption(
          container,
          clients,
          selected.id,
          records.find((c) => c.id === button.dataset.consumption),
          null,
          billing,
        )),
  );
  container.querySelectorAll("[data-delete-consumption]").forEach(
    (button) =>
      (button.onclick = async () => {
        const record = records.find(
          (c) => c.id === button.dataset.deleteConsumption,
        );
        if (!record) return;
        if (
          !confirm(
            `Excluir definitivamente o cadastro mensal de ${month(record.reference)}? Esta ação também apagará o histórico de correções e não poderá ser desfeita.`,
          )
        )
          return;
        try {
          button.disabled = true;
          await deleteConsumption(record.id);
          toast("Cadastro mensal excluído definitivamente.");
          await renderConsumption(
            container,
            clients,
            selected.id,
            null,
            null,
            billing,
          );
        } catch (ex) {
          toast(ex.message);
          button.disabled = false;
        }
      }),
  );
  if (container.querySelector("#cancel-edit-consumption"))
    container.querySelector("#cancel-edit-consumption").onclick = () =>
      renderConsumption(container, clients, selected.id, null, null, billing);
  form.onsubmit = async (event) => {
    event.preventDefault();
    const button = form.querySelector("[type=submit]"),
      error = container.querySelector("#consumption-error");
    error.hidden = true;
    try {
      button.disabled = true;
      button.textContent = "Salvando…";
      const data = normalizeConsumption({
        ...Object.fromEntries(new FormData(form)),
        operations: readOperationRows(container),
      });
      await saveConsumption(selected, data, editing?.revision || 0);
      toast(
        editing
          ? "Correção salva com sucesso."
          : "Cadastro mensal salvo com sucesso.",
      );
      await renderConsumption(
        container,
        clients,
        selected.id,
        null,
        null,
        billing,
      );
    } catch (ex) {
      error.textContent = ex.message;
      error.hidden = false;
      button.disabled = false;
      button.innerHTML = `${icon("check")} ${editing ? "Salvar correção" : "Salvar lançamento"}`;
    }
  };
}
