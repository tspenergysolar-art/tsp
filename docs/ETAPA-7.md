# ETAPA 7 — Pagamentos e dashboard

Implementado controle manual de contas a receber com pagamento parcial ou integral, data, valor, forma e observação. Cancelamentos de pagamentos e faturas preservam o lançamento e acrescentam motivo, UID e horário; nenhum registro financeiro é apagado.

A versão 0.9.0 amplia o módulo com totais de faturado, recebido, em aberto, vencido e a vencer, índice de inadimplência, faixas de atraso, pesquisa e filtros por situação, referência e cliente. Cada cobrança abre o histórico de pagamentos e o extrato completo do cliente. O relatório filtrado pode ser exportado em XLSX ou CSV.

Uma fatura corrigida é classificada como “Substituída”. Ela continua visível para auditoria, com saldo financeiro zerado, e não entra novamente nos indicadores. Se uma versão substituída já tiver pagamento, a tela mostra um alerta para revisão manual.

O dashboard calcula clientes ativos, consumo, faturado, recebido, pendente, vencido e faturas a partir das coleções reais. Há filtros por mês, ano e cliente, próximos vencimentos e gráficos de até seis referências.

As exportações XLSX/CSV incluem clientes, consumos, faturas, pagamentos e o relatório filtrado do contas a receber.

