export interface EtapaConfig {
  id: number;
  ordem: number;
  slug: string;
  nome: string;
  descricao: string;
  ativa: boolean;
}

export const ETAPAS_FASTCAR: readonly EtapaConfig[] = [
  {
    id: 1,
    ordem: 1,
    slug: 'acolhimento',
    nome: 'Acolhimento',
    descricao: 'Recepção no balcão e identificação inicial da demanda automotiva',
    ativa: true,
  },
  {
    id: 2,
    ordem: 2,
    slug: 'diagnostico',
    nome: 'Diagnóstico Técnico',
    descricao: 'Avaliação de compatibilidade, iluminação, som ou acessórios no veículo',
    ativa: true,
  },
  {
    id: 3,
    ordem: 3,
    slug: 'cotacao',
    nome: 'Cotação e Estoque',
    descricao: 'Verificação de disponibilidade de peças, valores e prazos',
    ativa: true,
  },
  {
    id: 4,
    ordem: 4,
    slug: 'apresentacao',
    nome: 'Apresentação do Orçamento',
    descricao: 'Exposição das opções, condições de pagamento e prazo ao cliente',
    ativa: true,
  },
  {
    id: 5,
    ordem: 5,
    slug: 'fechamento',
    nome: 'Fechamento',
    descricao: 'Decisão final do cliente e registro padronizado do desfecho',
    ativa: true,
  },
] as const;

export const DESFECHOS_FASTCAR = [
  { id: 1, codigo: 'convertido', nome: 'Orçamento convertido', exigeMotivo: false },
  { id: 2, codigo: 'desistiu', nome: 'Cliente desistiu', exigeMotivo: true },
  { id: 3, codigo: 'nao_fechou', nome: 'Não houve fechamento', exigeMotivo: true },
  { id: 4, codigo: 'interrompido', nome: 'Atendimento interrompido', exigeMotivo: true },
] as const;

export const MOTIVOS_DESISTENCIA_FASTCAR = [
  { id: 1, codigo: 'preco_acima_esperado', nome: 'Preço acima do esperado', categoria: 'comercial' },
  { id: 2, codigo: 'prazo_instalacao_longo', nome: 'Prazo de instalação longo', categoria: 'operacional' },
  { id: 3, codigo: 'tempo_espera_elevado', nome: 'Tempo de espera elevado no balcão', categoria: 'atendimento' },
  { id: 4, codigo: 'produto_indisponivel', nome: 'Produto ou acessório indisponível', categoria: 'estoque' },
  { id: 5, codigo: 'pesquisa_de_preco', nome: 'Cliente apenas pesquisando preço', categoria: 'comercial' },
  { id: 6, codigo: 'incompatibilidade_tecnica', nome: 'Incompatibilidade técnica com o veículo', categoria: 'tecnico' },
  { id: 7, codigo: 'cliente_saiu_sem_retorno', nome: 'Cliente saiu antes da conclusão', categoria: 'atendimento' },
  { id: 8, codigo: 'outro_motivo_padronizado', nome: 'Outro motivo operacional padronizado', categoria: 'outros' },
] as const;

export const MOTIVOS_PAUSA_OPERACIONAL = [
  { codigo: 'atendimento_simultaneo', nome: 'Apoio a outro cliente no balcão' },
  { codigo: 'busca_fisica_estoque', nome: 'Busca física de peça/amostra no estoque' },
  { codigo: 'consulta_sistema_interno', nome: 'Verificação em sistema de fornecedor' },
  { codigo: 'intervalo_operacional', nome: 'Pausa operacional rápida' },
] as const;

export const MOTIVOS_ESPERA_OFICINA = [
  { codigo: 'compatibilidade_eletrica', nome: 'Consulta de compatibilidade elétrica/som' },
  { codigo: 'disponibilidade_box', nome: 'Verificação de vaga/tempo de box na oficina' },
  { codigo: 'inspecao_presencial_veiculo', nome: 'Inspeção presencial do técnico no veículo' },
  { codigo: 'orcamento_mao_de_obra', nome: 'Definição de complexidade de mão de obra' },
] as const;

export const REGRAS_ESTATISTICAS_PADRAO = {
  janelaPadrao: 20,
  kDesvios: 2.0,
  minBaseline: 10,
  minJanela: 3,
  limiteOverheadMs: 50.0,
  timeoutAbandonoS: 30 * 60,
} as const;
