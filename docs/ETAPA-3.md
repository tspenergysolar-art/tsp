# ETAPA 3 — Clientes e histórico de consumo

Concluída em 16/10/2026.

## Entregas

- Cadastro, consulta, pesquisa, edição e inativação de clientes.
- Pesquisa por nome, CPF/CNPJ, número da instalação e telefone.
- Alerta antes de salvar cadastro com CPF/CNPJ, telefone ou instalação repetidos.
- Dados técnicos da unidade, tarifa contratual e desconto informados pelo administrador.
- Lançamento mensal com datas e leituras, fator multiplicador, energia injetada, TUSD, TE, desconto solar, bandeira, iluminação, tributos, outros lançamentos, vencimento e observações.
- Cálculo automático `(leitura atual − leitura anterior) × fator multiplicador`.
- Identificação permanente quando o consumo informado difere do cálculo.
- Chave única por cliente e referência, impedindo duplicidade silenciosa.
- Correções como novas versões, sem apagar a versão anterior.
- Histórico de consumos e alterações dentro dos detalhes do cliente.
- Regras do Firestore para as quatro novas coleções, com acesso exclusivo a administradores ativos e bloqueio de exclusões.

## Arquivos criados ou alterados

- Criado: `src/clients.js`.
- Alterados: `src/app.js`, `src/database.js`, `src/validation.js`, `src/ui.js`, `src/styles.css`.
- Alterados: `firestore.rules`, `tests/rules.test.js`, `tests/validation.test.js`.
- Alterados: `package.json`, `README.md`.

## Testes executados

- 12 testes JavaScript: passaram.
- 20 testes das regras do Firestore: passaram.
- Build de produção com Vite: passou.
- Regras publicadas no projeto real `tsp-energy`; leitura da coleção real vazia confirmada com a conta administrativa.
- No emulador: login, cadastro, pesquisa, salvamento, lançamento mensal, cálculo automático, marcação de valor manual, bloqueio de duplicidade, correção por nova versão e inativação: passaram.

## Limites desta etapa

- Não foram cadastrados clientes fictícios no banco real.
- O comparativo gráfico, faturamento, PDF, planilhas e pagamentos pertencem às etapas seguintes.
- Tarifas e valores financeiros não são inventados; o administrador informa os valores usados.
