# ETAPA 2 — Estrutura visual e Firebase

Concluída em 16/10/2026.

## Entregas

- Aplicação web estática responsiva em português brasileiro.
- Tela de login administrativo com sessão na aba ou persistente por escolha do usuário, recuperação de senha e logout.
- Autorização adicional pela coleção `admins`: autenticar não basta; o documento do UID precisa ter `active: true`.
- Painel inicial responsivo, menu lateral no computador e menu compacto no celular.
- Tela de configurações da empresa com identidade, contato, dados PIX, banco, contrato, avisos e mensagens.
- Upload local de logo e QR Code em PNG/JPG/WebP, com redimensionamento, limite e confirmação manual do QR.
- Dia padrão de vencimento opcional. Nenhuma data contratual foi inventada.
- Salvamento transacional no Firestore com revisão otimista e versão imutável de cada alteração.
- Importação e exportação privada das configurações em JSON.
- Guia de primeiro acesso e documentação de execução, testes e publicação.
- Cabeçalhos de segurança no Firebase Hosting e política CSP sem fontes ou scripts externos.
- Regras Firestore publicadas no projeto `tsp-energy`, banco `(default)`, região `southamerica-east1`.
- Dados iniciais transcritos do modelo da fatura e salvos como versão 1 no Firestore real. Campos ausentes no PDF ficaram vazios.

## Arquivos criados

- `.env.emulator`, `.firebaserc`, `.gitignore`
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`
- `index.html`, `package.json`, `package-lock.json`
- `public/configuracao.html`, `public/guia.css`, `public/sun.svg`
- `src/app.js`, `src/assets.js`, `src/database.js`, `src/firebase.js`, `src/styles.css`, `src/ui.js`, `src/validation.js`
- `scripts/seed-emulator.mjs`
- `tests/validation.test.js`, `tests/rules.test.js`
- `README.md`, `docs/ETAPA-2.md`

O arquivo `private/configuracoes-iniciais.json` foi criado localmente, está ignorado pelo Git e não entra no build.

## Testes executados

- 8 testes de validação JavaScript: passaram.
- 16 testes das regras no Firestore Emulator: passaram. Abrangem anônimo, conta não autorizada, administrador inativo, autopromoção, versão atômica, revisão sequencial, histórico imutável, identidade/timestamp falsos, imagens inválidas, vencimento opcional, revogação e coleções futuras bloqueadas.
- `npm run build`: passou com Vite 8.3.4.
- `npm audit --omit=dev`: zero vulnerabilidades conhecidas após fixar `@grpc/grpc-js` 1.14.6.
- Login e logout no emulador: passaram.
- Login real com o usuário criado pelo administrador: passou.
- Leitura da autorização real em `admins/{uid}`: passou.
- Primeiro salvamento no Firestore real e leitura após recarregar: passaram; versão 1 confirmada.
- Edição, segunda versão, recarga e consulta do histórico: passaram no emulador.
- Importação JSON: passou no ambiente real.
- Interface desktop: conferida visualmente no navegador.
- Interface móvel em viewport de 390 × 844: menu, navegação e painel conferidos; sem rolagem horizontal.
- Regras publicadas no console Firebase e confirmação de sucesso observada.

## Não testado nesta etapa

- E-mail de recuperação recebido na caixa postal. Apenas a chamada e os estados de erro foram implementados.
- Interrupção física da internet. A interface e os erros foram implementados, mas o teste completo fica para a ETAPA 8.
- Publicação no Firebase Hosting ou GitHub Pages. A publicação definitiva está prevista na ETAPA 8.
- Clientes, consumos, planilhas, faturas PDF, pagamentos, compartilhamentos e dashboard financeiro, pois pertencem às etapas seguintes.

## Configuração manual pendente

Na tela de configurações, o administrador ainda deve completar e confirmar os campos que não constavam no PDF: endereço, cidade do beneficiário PIX, banco/dados bancários, informações contratuais, dia padrão de vencimento, logotipo e QR Code bancário. A chave PIX e o beneficiário foram salvos a partir do documento de referência, mas a titularidade bancária não pode ser comprovada pelo sistema.
