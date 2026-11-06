import test from "node:test";
import assert from "node:assert/strict";
import { operationTableLayout } from "../src/invoice-pdf.js";

test("mantém linhas confortáveis quando há poucas operações", () => {
  const layout = operationTableLayout(7);
  assert.equal(layout.rowHeight, 14);
  assert.equal(layout.textSize, 5.7);
});

test("compacta todas as linhas dentro do retângulo com operações extras", () => {
  for (const count of [11, 12, 13]) {
    const layout = operationTableLayout(count);
    assert.ok(layout.rowHeight < 14);
    assert.ok(layout.rowHeight * count <= layout.availableHeight + 0.001);
    assert.ok(layout.textSize >= 5.4);
  }
});

test("nunca invade a faixa do total consolidado", () => {
  const count = 16,
    layout = operationTableLayout(count),
    lastRowBottom = 480 - 26 - count * layout.rowHeight;
  assert.ok(lastRowBottom >= layout.totalTop - 0.001);
});
