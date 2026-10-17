# ETAPA 5 — Cálculos e faturas PDF

Implementada a tela **Faturamento mensal**, com tarifas versionadas, fórmula documentada, conferência de itens, total manual identificado, emissão individual ou em lote e segunda via. Cada documento guarda cópias dos dados do cliente, consumo, fórmula, itens, tributos e histórico de seis meses, além da referência para a versão imutável da empresa.

O PDF é criado no navegador com `pdf-lib` 1.17.1, em A4, usando textos, linhas, tabelas e gráficos reais. Nenhuma imagem estática da fatura é usada. Os valores padrão são zero; nenhuma tarifa ou alíquota foi inventada. O PDF não é salvo em pasta pública nem no Firestore.

Testes executados: 21 testes de lógica, 25 testes de regras após a conclusão das etapas, build Vite, emissão no emulador e inspeção visual/textual do PDF de teste em A4. O arquivo fictício de validação está em `output/pdf/` apenas na máquina local e é ignorado pelo Git.

