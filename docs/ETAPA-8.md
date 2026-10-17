# ETAPA 8 — Testes, segurança e publicação

## Verificações executadas

- 21 testes unitários: perfis, clientes, consumo, CSV/XLSX e cálculos de faturamento.
- 25 testes de regras no Firestore Emulator: autorização, versões, clientes, consumos, fórmulas, faturas imutáveis, pagamentos e compartilhamentos.
- Build de produção com Vite.
- `npm audit --omit=dev`: zero vulnerabilidades nas dependências enviadas ao navegador.
- Fluxo no navegador com Auth/Firestore Emulator: login, cálculo, emissão, histórico, pagamento parcial e atualização do dashboard.
- Layout responsivo conferido em viewport de 390 × 844.
- PDF renderizado com Poppler: uma página, A4 595,28 × 841,89 pontos, texto extraível e inspeção visual sem cortes após correção do cabeçalho.

## Publicação

O workflow `.github/workflows/pages.yml` testa, compila e publica `dist/` no GitHub Pages após cada push em `main`. O build usa base `/tsp/`. O domínio precisa permanecer autorizado no Firebase Authentication.

O Firestore continua fechado por padrão. Somente contas em `admins/{uid}` com `active: true` acessam as coleções. Não há Cloud Functions, Storage público, serviço de e-mail, confirmação bancária ou recurso pago.

## Backup

Use **Importação de dados → Exportar cópia dos dados** e guarde XLSX/CSV em local privado. Faça cópias periódicas e antes de alterações em massa. PDFs e backups com dados pessoais não devem ser enviados ao repositório.

