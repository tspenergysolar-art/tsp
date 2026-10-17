# ETAPA 6 — PIX, boleto e compartilhamento

A fatura gera automaticamente um QR PIX com o valor e identificador da cobrança quando chave, beneficiário e cidade estão configurados. Linha digitável e código de barras são campos manuais; o documento informa quando não existe boleto bancário registrado.

A área de ações permite baixar PDF, preparar WhatsApp, preparar e-mail e copiar mensagem. WhatsApp e e-mail usam os aplicativos do dispositivo e não prometem anexo automático. O sistema só cria um registro em `shares` depois que o administrador confirma que concluiu o compartilhamento.

Não há integração bancária, envio automático, Cloud Functions ou serviço pago.

