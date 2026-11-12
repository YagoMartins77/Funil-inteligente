export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Funil-Inteligente FASTCAR API',
    version: '1.0.0',
    description:
      'API REST v1 para telemetria presencial de orçamentação em 5 etapas, controle de pausas/espera técnica da oficina, desfechos padronizados (LGPD), analytics determinístico e simulação sintética.',
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  tags: [
    { name: 'Saúde', description: 'Monitoramento da API' },
    { name: 'Etapas', description: 'Fluxo de 5 etapas da FASTCAR' },
    { name: 'Atendimentos', description: 'Ciclo de vida do atendimento anônimo' },
    { name: 'Telemetria', description: 'Ingestão idempotente de visitas e eventos' },
    { name: 'Pausas e Oficina', description: 'Pausas operacionais e espera técnica' },
    { name: 'Desfechos', description: 'Desfechos e motivos fechados (LGPD)' },
    { name: 'Analytics', description: 'Funil, tempos, anomalias e exportação CSV' },
    { name: 'Administração', description: 'Simulação sintética, limpeza e parâmetros' },
  ],
  paths: {
    '/saude': {
      get: { tags: ['Saúde'], summary: 'Status da API', responses: { 200: { description: 'OK' } } },
    },
    '/etapas': {
      get: { tags: ['Etapas'], summary: 'Listar as 5 etapas da FASTCAR', responses: { 200: { description: 'Lista de etapas' } } },
    },
    '/atendimentos': {
      post: { tags: ['Atendimentos'], summary: 'Iniciar atendimento anônimo', responses: { 201: { description: 'Criado' } } },
      get: { tags: ['Atendimentos'], summary: 'Listar atendimentos paginados com filtros', responses: { 200: { description: 'Lista paginada' } } },
    },
    '/atendimentos/{id}': {
      get: { tags: ['Atendimentos'], summary: 'Consultar detalhes do atendimento', responses: { 200: { description: 'Detalhes' } } },
      patch: { tags: ['Atendimentos'], summary: 'Atualizar estado permitido', responses: { 200: { description: 'Atualizado' } } },
    },
    '/atendimentos/{id}/finalizar': {
      post: { tags: ['Atendimentos'], summary: 'Finalizar atendimento', responses: { 200: { description: 'Finalizado' } } },
    },
    '/atendimentos/{id}/pausas/iniciar': {
      post: { tags: ['Pausas e Oficina'], summary: 'Iniciar pausa operacional', responses: { 201: { description: 'Iniciada' } } },
    },
    '/atendimentos/{id}/pausas/finalizar': {
      post: { tags: ['Pausas e Oficina'], summary: 'Finalizar pausa operacional', responses: { 200: { description: 'Finalizada' } } },
    },
    '/atendimentos/{id}/espera-oficina/iniciar': {
      post: { tags: ['Pausas e Oficina'], summary: 'Iniciar espera técnica da oficina', responses: { 201: { description: 'Iniciada' } } },
    },
    '/atendimentos/{id}/espera-oficina/finalizar': {
      post: { tags: ['Pausas e Oficina'], summary: 'Finalizar espera técnica da oficina', responses: { 200: { description: 'Finalizada' } } },
    },
    '/atendimentos/{id}/desfecho': {
      post: { tags: ['Desfechos'], summary: 'Registrar desfecho fechado', responses: { 200: { description: 'Registrado' } } },
    },
    '/telemetria/visitas': {
      post: { tags: ['Telemetria'], summary: 'Ingestão idempotente de visita por etapa', responses: { 202: { description: 'Aceito' } } },
    },
    '/telemetria/eventos': {
      post: { tags: ['Telemetria'], summary: 'Ingestão idempotente de evento de telemetria', responses: { 202: { description: 'Aceito' } } },
    },
    '/analytics/funil': {
      get: { tags: ['Analytics'], summary: 'Funil completo, tempos, anomalias e motivos', responses: { 200: { description: 'Análise completa' } } },
    },
    '/analytics/exportar.csv': {
      get: { tags: ['Analytics'], summary: 'Exportação CSV anonimizada', responses: { 200: { description: 'Arquivo CSV' } } },
    },
    '/admin/simular': {
      post: { tags: ['Administração'], summary: 'Gerar sessões sintéticas e avaliar detector', responses: { 201: { description: 'Simulação executada' } } },
    },
    '/admin/dados': {
      delete: { tags: ['Administração'], summary: 'Limpar dados sintéticos (ou reais com confirmação)', responses: { 200: { description: 'Removido' } } },
    },
  },
};
