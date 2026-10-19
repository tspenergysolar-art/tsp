# TSP Energy Solar

Sistema de faturamento em português brasileiro. As **etapas 1 a 8** estão implementadas: login administrativo, configurações, clientes, cadastro mensal, planilhas, faturamento PDF, compartilhamento, pagamentos e dashboard. A versão 0.18.3 oferece instalação própria da área do cliente pelo botão do cabeçalho, abrindo diretamente o portal após instalar. O acesso inicial usa a senha editável definida pelo administrador e não grava essa senha no Firestore. A área protegida em `portal.html` permite que cada cliente consulte somente suas faturas, pagamentos, pendências e consumos. A partir da versão 0.10.0, o painel administrativo também é um aplicativo web instalável (PWA) para Android, iPhone, iPad e computador.

## Leitura local de contas CPFL

Em **Cadastro mensal**, o administrador pode selecionar uma conta CPFL em PDF. O sistema tenta ler primeiro o texto digital e usa OCR local quando o arquivo contém apenas imagem. Os campos aparecem para revisão, seleção e edição antes de preencher o formulário; nenhum lançamento é salvo automaticamente. O PDF fica somente na memória do navegador durante a leitura, não é enviado ao Firebase e é descartado ao terminar. Os recursos de PDF e OCR são preparados no próprio projeto durante desenvolvimento, teste e compilação.

## Executar

Node 24.12+ e npm. Instale as dependências com `npm ci` e execute `npm run dev`. Compilação estática: `npm run build`; resultado em `dist/`. Não é necessário servidor de aplicação, cartão ou plano pago.

## Configuração Firebase

Projeto `tsp-energy`, Authentication e Firestore Standard. A configuração web pública está em `src/firebase.js`; não é uma senha. Não adicionar credenciais de conta de serviço ao frontend.

1. Confirmar Spark no console, habilitar Authentication com e-mail/senha, criar usuário.
2. Criar Firestore `(default)` em modo de produção. Região escolhida pelo administrador: `southamerica-east1`.
3. Criar `admins/UID_DO_USUARIO`, campo booleano `active: true`, pelo console. A aplicação não escreve nessa coleção.
4. Publicar `firestore.rules` e `firestore.indexes.json` após os testes. Acesso público, contas não autorizadas e coleções futuras ficam bloqueados.
5. Conferir domínios em Authentication → Configurações → Domínios autorizados. Para desenvolvimento, permitir localhost/127.0.0.1 quando necessário.
6. Fazer login, importar `private/configuracoes-iniciais.json`, revisar e salvar.

O diretório `private/` é ignorado pelo Git e está fora de `public/` e do build. O arquivo inicial é transcrito do PDF do usuário; não publicá-lo. O dia padrão de vencimento fica em branco até decisão do administrador. As mensagens de compartilhamento são sugestões para revisão, não condições extraídas do contrato. Sem tarifas ou regras financeiras inventadas. CNPJ/CPF têm validação matemática; isso não confirma identidade nem titularidade PIX.

## Publicar

O sistema é publicado gratuitamente no GitHub Pages por `.github/workflows/pages.yml`. A URL é `https://tspenergysolar-art.github.io/tsp/`. O domínio deve constar em Authentication → Configurações → Domínios autorizados.

Firebase Hosting estático também é compatível, mas não é necessário para a publicação atual. O comando `npm run deploy` aponta para `tsp-energy`; use somente com uma conta Firebase autorizada e sem ativar faturamento.

Somente `dist/` é publicado. Não publicar PDFs de clientes, backups ou o diretório `private/`.

## Backup local por versão

Depois de compilar e confirmar cada versão, execute `npm run backup`. O pacote é criado somente neste computador, em `backups/versao-X.Y.Z/`, contendo o site pronto para publicação, o código-fonte versionado e um arquivo de identificação. A pasta `backups/` é ignorada pelo Git e nunca é enviada ao GitHub.

## Aplicativo instalável

O manifesto, os ícones e o service worker ficam em `public/`. No Android, a instalação usa o aviso do Chrome ou a opção “Instalar app”. No iPhone/iPad, usa Safari → Compartilhar → Adicionar à Tela de Início → Abrir como App Web. O aplicativo utiliza a mesma URL, autenticação e base de dados do site; não precisa ser publicado em loja.

O service worker armazena somente os arquivos estáticos da própria origem. Chamadas ao Firebase e dados administrativos não são colocados no cache do aplicativo. Sem conexão, a estrutura já visitada pode abrir, mas login, leitura atualizada e gravações continuam exigindo internet.

## Dados e histórico

- `admins/{uid}`: autorização criada no console; leitura apenas da própria conta, sem escrita pelo cliente.
- `settings/company`: configurações atuais e metadados de versão.
- `settingsVersions/{uuid}`: cópia imutável de cada salvamento. As regras exigem criação atômica da versão e atualização da configuração, com UID e horário do servidor.
- `clients/{uuid}` e `clientVersions/{uuid}`: cadastro atual e versões imutáveis. Clientes com histórico são inativados, não excluídos.
- `consumptions/{cliente--AAAA-MM}` e `consumptionVersions/{uuid}`: um lançamento atual por cliente e referência, acompanhado de cada versão anterior.
- `billingSettings/current` e `billingSettingsVersions/{uuid}`: tarifas e alíquotas atuais com histórico imutável.
- `invoices/{uuid}`: snapshot imutável de cada emissão. A segunda via usa os dados originais.
- `payments/{uuid}`: pagamento manual; cancelamento mantém histórico e auditoria. O contas a receber oferece resumo financeiro, faixas de atraso, filtros, extrato por cliente e exportação XLSX/CSV.
- `customerAccounts/{uid}`: vínculo entre a conta autenticada e um único cliente, com bloqueio imediato pelo administrador.
- `portalSettings/company`: dados empresariais estritamente necessários para mostrar a marca e gerar a segunda via no portal, sem os campos internos da configuração administrativa.
- `shares/{uuid}`: confirmação manual de compartilhamento concluído.
- Revisão esperada evita sobrescrever silenciosamente alterações simultâneas.
- Faturas corrigidas continuam disponíveis como “Substituídas”, mas deixam de compor faturamento, pendências e indicadores para evitar cobrança duplicada.
- O logotipo é convertido no navegador para PNG com transparência e limitado a 90.000 caracteres. Ele é armazenado com a versão, sem Cloud Storage. O QR PIX é gerado em cada fatura e não precisa ser armazenado como imagem.
- Cache do Firestore somente em memória. Sessão padrão limitada à aba; “Manter conectado” usa persistência do Firebase Auth no dispositivo. Logout limpa os dados da interface. Revogar `active` bloqueia acesso no servidor e encerra a visualização na próxima atualização recebida.
- Importação JSON só prepara o formulário; depende de Salvar. Exportação permite rascunho privado. O histórico lista as dez versões mais recentes e permite exportá-las.

## Testar

`npm test`: validações puras de configurações, clientes, consumo, faturamento, CSV, mapeamento e XLSX.

`npm run test:rules`: testes isolados no emulador Firestore, projeto `demo-tsp-energy`; não acessa dados reais. Java 11+ para a versão de emulador fixada nesta entrega. A CLI Firebase 13.35.1 está fixada para compatibilidade com o Java instalado e é ferramenta local, não enviada ao navegador.

Para conferir a interface com emuladores, execute `npm run emulators`, `node scripts/seed-emulator.mjs` e `npm run dev:emulator`. Só o modo de desenvolvimento e `.env.emulator` habilitam emuladores. O build normal sempre aponta para produção. Contas e dados de teste são fictícios.

Não executar os testes de regras contra produção. Os emuladores limpam somente o projeto de demonstração. Os resultados finais estão em `docs/ETAPA-8.md`.

## Planos gratuitos

Firebase Spark: cotas gratuitas sujeitas às condições atuais do provedor. Bibliotecas: Firebase Apache-2.0; Vite, `pdf-lib`, `read-excel-file` e `write-excel-file` MIT. Planilhas e PDFs são processados no navegador. Não há Cloud Functions, Cloud Storage, SMS, APIs pagas nem integração bancária. Consultar limites atuais antes de expandir a operação.

Não existe promessa de uso ilimitado. Backups devem ser feitos manualmente e guardados em local privado. A evolução das etapas deve incluir rotina de restauração dos dados financeiros antes de sua utilização real.
