import { PDFDocument, PDFString, StandardFonts, rgb } from "pdf-lib";
import { buildPixPayload, createPixQrDataUrl } from "./pix.js";

const A4 = [595.28, 841.89],
  green = rgb(0.08, 0.25, 0.21),
  lime = rgb(0.72, 0.83, 0.42),
  pale = rgb(0.94, 0.97, 0.91),
  ink = rgb(0.12, 0.2, 0.18),
  gray = rgb(0.38, 0.45, 0.41),
  border = rgb(0.82, 0.86, 0.81),
  yellow = rgb(1, 0.96, 0.78),
  red = rgb(0.62, 0.18, 0.14);
const brl = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(v) || 0,
  );
const num = (v, d = 3) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format(
    Number(v) || 0,
  );
const fixed = (v, d) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(Number(v) || 0);
const date = (v) => (v ? String(v).split("-").reverse().join("/") : "-");
const ref = (v) =>
  v ? `${String(v).slice(5, 7)}/${String(v).slice(0, 4)}` : "-";
const clean = (v) =>
  String(v ?? "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
function wrap(value, font, size, max) {
  const words = clean(value).split(/\s+/),
    lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= max) line = next;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}
function clipped(value, font, size, max) {
  let result = clean(value);
  while (result && font.widthOfTextAtSize(result, size) > max)
    result = result.slice(0, -1);
  return result === clean(value) ? result : `${result.slice(0, -3)}...`;
}
function text(page, font, value, x, y, size = 7, color = ink, options = {}) {
  page.drawText(clean(value), { x, y, size, font, color, ...options });
}
function box(page, x, y, w, h, fill = rgb(1, 1, 1), stroke = border) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: fill,
    borderColor: stroke,
    borderWidth: 0.6,
  });
}
function right(page, font, value, x, y, w, size = 7, color = ink) {
  text(
    page,
    font,
    value,
    x + w - font.widthOfTextAtSize(clean(value), size),
    y,
    size,
    color,
  );
}
function center(page, font, value, x, y, w, size = 7, color = ink) {
  text(
    page,
    font,
    value,
    x + (w - font.widthOfTextAtSize(clean(value), size)) / 2,
    y,
    size,
    color,
  );
}
function labelValue(page, bold, valueFont, label, value, x, y, w) {
  text(page, bold, label.toUpperCase(), x, y, 6.2, gray);
  wrap(value || "-", valueFont, 8.2, w)
    .slice(0, 2)
    .forEach((line, i) =>
      text(page, valueFont, line, x, y - 11 - i * 9, 8.2, ink),
    );
}
function dataUrlBytes(value) {
  if (!value) return null;
  return Uint8Array.from(atob(value.split(",")[1]), (c) => c.charCodeAt(0));
}
function addLink(page, pdf, url, x, y, width, height) {
  if (!url) return;
  const annotation = pdf.context.register(
    pdf.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, y, x + width, y + height],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
    }),
  );
  page.node.addAnnot(annotation);
}
function pixPaymentUrl(invoice, payload) {
  if (!payload) return "";
  const base =
    typeof location !== "undefined"
      ? new URL(`${import.meta.env.BASE_URL}pagar.html`, location.origin)
      : new URL("https://tspenergysolar-art.github.io/tsp/pagar.html");
  base.searchParams.set("pix", payload);
  base.searchParams.set("vencimento", invoice.dueDate || "");
  return base.href;
}
async function embedLogo(pdf, value) {
  const bytes = dataUrlBytes(value);
  if (!bytes) return null;
  if (value.startsWith("data:image/png")) return pdf.embedPng(bytes);
  if (value.startsWith("data:image/jpeg")) return pdf.embedJpg(bytes);
  if (value.startsWith("data:image/webp")) {
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: "image/webp" }),
    );
    try {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0);
      return pdf.embedPng(dataUrlBytes(canvas.toDataURL("image/png")));
    } finally {
      bitmap.close();
    }
  }
  return null;
}

export async function createInvoicePdf(invoice, company) {
  const pdf = await PDFDocument.create(),
    page = pdf.addPage(A4),
    regular = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold),
    { width } = page.getSize(),
    p = company.profile,
    margin = 25,
    content = width - 50;
  page.drawRectangle({ x: 0, y: 752, width, height: 90, color: green });
  page.drawRectangle({ x: 0, y: 752, width: 10, height: 90, color: lime });
  let logo = null;
  try {
    logo = await embedLogo(pdf, company.logo);
  } catch {}
  if (logo) {
    const s = logo.scaleToFit(55, 46);
    page.drawImage(logo, {
      x: 27,
      y: 778 + (46 - s.height) / 2,
      width: s.width,
      height: s.height,
    });
  }
  text(
    page,
    bold,
    p.tradeName || "TSP ENERGY SOLAR",
    logo ? 93 : 28,
    807,
    17,
    rgb(1, 1, 1),
  );
  text(
    page,
    regular,
    "SOLAR & ENERGIA SUSTENTÁVEL",
    logo ? 93 : 28,
    793,
    7,
    lime,
  );
  text(
    page,
    regular,
    "Documento de Cobrança / Demonstrativo de Consumo",
    logo ? 93 : 28,
    778,
    7,
    rgb(0.78, 0.86, 0.81),
  );
  text(page, bold, "FATURA DE ENERGIA ELÉTRICA", 345, 806, 10, rgb(1, 1, 1));
  text(page, bold, "REPASSE SOLAR", 345, 790, 10, lime);
  text(
    page,
    regular,
    `Fatura ${
      clean(invoice.id)
        .replace(/[^A-Za-z0-9]/g, "")
        .slice(-8)
        .toUpperCase() || "-"
    }`,
    345,
    773,
    7,
    rgb(0.8, 0.88, 0.83),
  );
  box(page, margin, 692, content, 45);
  text(
    page,
    bold,
    "DADOS DO CLIENTE E UNIDADE CONSUMIDORA",
    35,
    723,
    7.2,
    green,
  );
  labelValue(page, bold, bold, "Cliente", invoice.client.name, 35, 710, 230);
  labelValue(
    page,
    bold,
    bold,
    "CPF/CNPJ",
    invoice.client.taxId || "-",
    285,
    710,
    105,
  );
  labelValue(
    page,
    bold,
    bold,
    "Endereço",
    invoice.client.address || "-",
    410,
    714,
    150,
  );
  box(page, margin, 637, content, 45, pale);
  text(page, bold, "DADOS DA EMPRESA GERADORA", 35, 668, 7.2, green);
  labelValue(
    page,
    bold,
    bold,
    "Razão social",
    p.legalName || p.tradeName,
    35,
    655,
    220,
  );
  labelValue(page, bold, bold, "CNPJ", p.cnpj || "-", 275, 655, 110);
  labelValue(
    page,
    bold,
    bold,
    "Contato",
    p.phone || p.email || "-",
    405,
    655,
    150,
  );
  const columns = [
      ["Instalação", invoice.client.installationNumber],
      ["Fornecimento", invoice.client.supplyType],
      ["Apresentação", date(invoice.issueDate)],
      ["Leitura anterior", date(invoice.consumption.previousReadDate)],
      ["Leitura atual", date(invoice.consumption.currentReadDate)],
      ["Próxima leitura", date(invoice.consumption.nextReadDate)],
    ],
    cw = content / columns.length;
  columns.forEach(([label, value], index) => {
    box(
      page,
      margin + index * cw,
      593,
      cw,
      34,
      index % 2 ? pale : rgb(1, 1, 1),
    );
    center(
      page,
      bold,
      label.toUpperCase(),
      margin + index * cw,
      614,
      cw,
      6.1,
      gray,
    );
    center(page, bold, value || "-", margin + index * cw, 599, cw, 8, ink);
  });
  page.drawRectangle({
    x: margin,
    y: 538,
    width: content,
    height: 45,
    color: green,
  });
  [
    ["REFERÊNCIA", ref(invoice.reference)],
    ["VENCIMENTO", date(invoice.dueDate)],
    ["TOTAL A PAGAR", brl(invoice.total)],
  ].forEach(([label, value], index) => {
    const x = margin + (index * content) / 3;
    text(page, bold, label, x + 12, 567, 6, lime);
    text(page, bold, value, x + 12, 549, index === 2 ? 15 : 12, rgb(1, 1, 1));
    if (index)
      page.drawLine({
        start: { x, y: 545 },
        end: { x, y: 576 },
        color: rgb(0.3, 0.48, 0.39),
        thickness: 0.6,
      });
  });
  box(page, margin, 493, content, 33, yellow, rgb(0.9, 0.78, 0.3));
  text(
    page,
    bold,
    "AVISOS E INFORMAÇÕES IMPORTANTES",
    35,
    514,
    6,
    rgb(0.42, 0.33, 0.08),
  );
  const notices =
    [p.notices, invoice.notes].filter(Boolean).join(" • ") ||
    "Confira os dados desta fatura antes do pagamento.";
  wrap(notices, regular, 6.5, content - 20)
    .slice(0, 2)
    .forEach((line, index) =>
      text(page, regular, line, 35, 503 - index * 8, 6.5, ink),
    );
  const tableTop = 480,
    tableBottom = 312,
    tableHeight = tableTop - tableBottom,
    headerHeight = 26,
    widths = [210, 40, 75, 70, 80, 70],
    starts = widths.map(
      (_, index) =>
        margin + widths.slice(0, index).reduce((sum, value) => sum + value, 0),
    );
  box(page, margin, tableBottom, content, tableHeight);
  widths.forEach((cellWidth, index) =>
    page.drawRectangle({
      x: starts[index],
      y: tableTop - headerHeight,
      width: cellWidth,
      height: headerHeight,
      color: pale,
      borderColor: border,
      borderWidth: 0.5,
    }),
  );
  text(page, bold, "DESCRIÇÃO DA OPERAÇÃO", starts[0] + 7, 463, 5.5, green);
  center(page, bold, "UNID.", starts[1], 468, widths[1], 4.7, green);
  center(page, bold, "MED.", starts[1], 461, widths[1], 4.7, green);
  center(page, bold, "QUANT.", starts[2], 468, widths[2], 4.7, green);
  center(page, bold, "FATURADA", starts[2], 461, widths[2], 4.7, green);
  center(page, bold, "TARIFA", starts[3], 468, widths[3], 4.7, green);
  center(page, bold, "ANEEL", starts[3], 461, widths[3], 4.7, green);
  center(page, bold, "TARIFA COM", starts[4], 468, widths[4], 4.7, green);
  center(page, bold, "TRIBUTOS", starts[4], 461, widths[4], 4.7, green);
  center(page, bold, "VALOR TOTAL", starts[5], 468, widths[5], 4.7, green);
  center(page, bold, "(R$)", starts[5], 461, widths[5], 4.7, green);
  const items = invoice.items
      .filter(
        (item) =>
          Math.abs(Number(item.value) || 0) > 0.0001 ||
          ["SUBTOTAL", "IP_CIP"].includes(item.code),
      )
      .slice(0, 10),
    rowHeight = 14;
  items.forEach((item, index) => {
    const y = tableTop - headerHeight - (index + 1) * rowHeight;
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + content, y },
      color: border,
      thickness: 0.35,
    });
    for (let column = 1; column < starts.length; column++)
      page.drawLine({
        start: { x: starts[column], y },
        end: { x: starts[column], y: y + rowHeight },
        color: border,
        thickness: 0.25,
      });
    const summary = ["DESCONTO_TSP", "SUBTOTAL", "IP_CIP"].includes(item.code),
      operation = !summary;
    text(
      page,
      summary ? bold : regular,
      clipped(item.description, regular, 5.7, widths[0] - 14),
      starts[0] + 7,
      y + 4.3,
      5.7,
      item.code === "DESCONTO_TSP" ? red : summary ? green : ink,
    );
    if (operation) {
      center(
        page,
        regular,
        item.unit || "-",
        starts[1],
        y + 4.3,
        widths[1],
        5.2,
        ink,
      );
      right(
        page,
        regular,
        Number(item.quantity) > 0 ? fixed(item.quantity, 4) : "-",
        starts[2] + 3,
        y + 4.3,
        widths[2] - 7,
        5.2,
        ink,
      );
      right(
        page,
        regular,
        Number(item.aneelTariff) > 0 ? fixed(item.aneelTariff, 8) : "-",
        starts[3] + 3,
        y + 4.3,
        widths[3] - 7,
        4.8,
        ink,
      );
      right(
        page,
        regular,
        Number(item.taxedTariff) > 0 ? fixed(item.taxedTariff, 8) : "-",
        starts[4] + 3,
        y + 4.3,
        widths[4] - 7,
        4.8,
        ink,
      );
    }
    right(
      page,
      bold,
      brl(item.value),
      starts[5] + 3,
      y + 4.3,
      widths[5] - 7,
      5.4,
      Number(item.value) < 0 ? red : ink,
    );
  });
  page.drawRectangle({
    x: margin,
    y: tableBottom,
    width: content,
    height: 20,
    color: green,
  });
  text(page, bold, "TOTAL CONSOLIDADO", 35, 319, 6.5, lime);
  right(
    page,
    bold,
    brl(invoice.total),
    margin + content - 120,
    319,
    110,
    7.5,
    rgb(1, 1, 1),
  );
  box(page, margin, 250, content, 52, pale);
  text(page, bold, "HISTÓRICO DE CONSUMO (kWh)", 35, 289, 6, green);
  const history = [
      ...invoice.history.slice(0, 5).reverse(),
      {
        reference: invoice.reference,
        consumption: Number(invoice.consumption.measuredConsumption || 0),
      },
    ],
    max = Math.max(1, ...history.map((item) => Number(item.consumption) || 0)),
    chartX = 190,
    slot = (content - 180) / Math.max(1, history.length);
  text(
    page,
    bold,
    `${num(invoice.consumption.measuredConsumption)} kWh`,
    35,
    267,
    14,
    green,
  );
  text(page, regular, "CONSUMO TOTAL DO MÊS", 35, 257, 5.5, gray);
  history.forEach((item, index) => {
    const x = chartX + index * slot,
      bar = Math.max(3, ((Number(item.consumption) || 0) / max) * 26);
    page.drawRectangle({
      x: x + slot / 2 - 5,
      y: 260,
      width: 10,
      height: bar,
      color: index === history.length - 1 ? green : lime,
    });
    center(page, regular, ref(item.reference), x, 253, slot, 4.7, gray);
  });
  box(page, margin, 132, content, 106);
  text(page, bold, "PAGAMENTO VIA PIX", 35, 224, 7, green);
  const pixPayload = buildPixPayload(invoice, p),
    paymentUrl = pixPaymentUrl(invoice, pixPayload);
  let qr = null,
    dynamicPix = false;
  try {
    const source = await createPixQrDataUrl(invoice, p);
    dynamicPix = Boolean(source);
    const bytes = dataUrlBytes(source);
    if (bytes) qr = await pdf.embedPng(bytes);
  } catch {}
  if (qr) {
    const s = qr.scaleToFit(82, 82);
    page.drawImage(qr, { x: 40, y: 140, width: s.width, height: s.height });
  } else {
    box(page, 40, 143, 76, 70, pale);
    center(page, bold, "PIX", 40, 180, 76, 8, green);
    center(page, regular, "QR não configurado", 40, 165, 76, 5.5, gray);
  }
  labelValue(
    page,
    bold,
    regular,
    "Beneficiário",
    p.pixBeneficiary,
    135,
    207,
    185,
  );
  labelValue(page, bold, regular, "Chave PIX", p.pixKey, 135, 178, 215);
  labelValue(page, bold, regular, "Valor", brl(invoice.total), 385, 207, 85);
  labelValue(
    page,
    bold,
    regular,
    "Vencimento",
    date(invoice.dueDate),
    475,
    207,
    85,
  );
  text(
    page,
    regular,
    dynamicPix
      ? "QR PIX gerado com o valor desta fatura."
      : "Use somente a chave confirmada pelo administrador.",
    135,
    146,
    6,
    gray,
  );
  if (paymentUrl) {
    page.drawRectangle({
      x: 385,
      y: 140,
      width: 175,
      height: 27,
      color: green,
      borderColor: green,
      borderWidth: 0.5,
    });
    center(
      page,
      bold,
      "CLIQUE AQUI PARA PAGAR",
      385,
      150,
      175,
      7,
      rgb(1, 1, 1),
    );
    addLink(page, pdf, paymentUrl, 385, 140, 175, 27);
  }
  box(page, margin, 45, content, 75, yellow, rgb(0.9, 0.78, 0.3));
  text(page, bold, "ATRASO NO PAGAMENTO", 35, 106, 7, red);
  const lateNotice =
    "Após o vencimento: multa de 2% sobre o valor vencido e juros de 0,033% ao dia de atraso. Solicite à TSP Energy Solar o valor atualizado antes de pagar.";
  wrap(lateNotice, bold, 8, content - 20)
    .slice(0, 2)
    .forEach((line, index) =>
      text(page, bold, line, 35, 89 - index * 11, 8, ink),
    );
  text(
    page,
    regular,
    "O QR Code e o botão acima contêm o valor original desta fatura.",
    35,
    57,
    6.5,
    gray,
  );
  text(
    page,
    regular,
    "Fatura de cobrança emitida pela TSP Energy Solar. Pagamento não confirmado automaticamente.",
    25,
    24,
    5.5,
    gray,
  );
  text(
    page,
    regular,
    `Emissão: ${date(invoice.issueDate)}`,
    455,
    24,
    5.5,
    gray,
  );
  pdf.setTitle(`Fatura ${ref(invoice.reference)} - ${invoice.client.name}`);
  pdf.setAuthor(p.tradeName || "TSP Energy Solar");
  pdf.setSubject("Fatura de energia elétrica / repasse solar");
  return pdf.save();
}
export function downloadPdf(bytes, name) {
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/pdf" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function openPdf(bytes) {
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "application/pdf" }),
  );
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}
