# ETAPA 4 — Importação e exportação de planilhas

Concluída em 16/10/2026.

## Entregas

- Área `Importação de dados` no menu administrativo.
- Importação de clientes e consumos em XLSX ou CSV.
- Modelos de clientes e consumos para download nos dois formatos.
- Prévia antes da gravação, com até dez linhas visíveis.
- Associação automática e manual das colunas da planilha.
- Validação de nomes, documentos, contatos, datas, referências, leituras e valores.
- Identificação de cliente por instalação, nome, CPF/CNPJ ou telefone.
- Alerta para possíveis clientes duplicados e confirmação explícita antes de continuar.
- Bloqueio de consumo repetido para o mesmo cliente e mês.
- Importação apenas das linhas válidas, sem apagar ou substituir registros existentes.
- Relatório final por linha e download do relatório em CSV.
- Exportação de clientes e consumos em XLSX ou CSV.
- Limites de 5 MB e 500 registros por importação para reduzir uso indevido das cotas gratuitas.

## Bibliotecas

- `read-excel-file` 9.3.12, licença MIT.
- `write-excel-file` 4.1.1, licença MIT.

As bibliotecas são carregadas somente quando um arquivo XLSX é lido ou gerado. Todo o processamento ocorre no navegador, sem serviço externo.

## Arquivos criados ou alterados

- Criados: `src/imports.js`, `src/sheet-data.js`, `src/spreadsheets.js`.
- Criado: `tests/spreadsheet.test.js` e planilhas CSV de teste em `tests/fixtures/`.
- Alterados: `src/app.js`, `src/styles.css`, `package.json`, `package-lock.json`, `README.md`.

## Testes executados

- 18 testes JavaScript: passaram, incluindo CSV com aspas/quebras de linha, associação de cabeçalhos, números brasileiros, duplicidades, cliente inexistente e roundtrip XLSX.
- Build de produção com carregamento separado das bibliotecas XLSX: passou.
- Auditoria das dependências de produção: zero vulnerabilidades conhecidas.
- No navegador com emuladores: importação de dois clientes CSV, importação de consumo CSV, associação automática, prévia, relatório final e bloqueio de confirmação de duplicidades: passaram.
- Exportação XLSX de clientes: arquivo baixado, relido e conferido com 14 colunas e dois registros: passou.

## Limites desta etapa

- Faturas e pagamentos ainda não têm coleções; suas exportações serão adicionadas junto dessas etapas.
- A importação não corrige registros existentes. Correções devem ser feitas nas telas próprias, preservando versões.
- Nenhum cliente fictício foi gravado no Firebase real.
