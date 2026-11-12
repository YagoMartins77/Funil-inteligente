import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const ETAPAS_PADRAO = [
  {
    ordem: 1,
    slug: 'acolhimento',
    nome: 'Acolhimento',
    descricao: 'Recepção no balcão e identificação inicial da demanda automotiva',
  },
  {
    ordem: 2,
    slug: 'diagnostico',
    nome: 'Diagnóstico Técnico',
    descricao: 'Avaliação de compatibilidade, iluminação, som ou acessórios no veículo',
  },
  {
    ordem: 3,
    slug: 'cotacao',
    nome: 'Cotação e Estoque',
    descricao: 'Verificação de disponibilidade de peças, valores e prazos',
  },
  {
    ordem: 4,
    slug: 'apresentacao',
    nome: 'Apresentação do Orçamento',
    descricao: 'Exposição das opções, condições de pagamento e prazo ao cliente',
  },
  {
    ordem: 5,
    slug: 'fechamento',
    nome: 'Fechamento',
    descricao: 'Decisão final do cliente e registro padronizado do desfecho',
  },
];

export const DESFECHOS_PADRAO = [
  { codigo: 'convertido', nome: 'Orçamento convertido', exigeMotivo: false },
  { codigo: 'desistiu', nome: 'Cliente desistiu', exigeMotivo: true },
  { codigo: 'nao_fechou', nome: 'Não houve fechamento', exigeMotivo: true },
  { codigo: 'interrompido', nome: 'Atendimento interrompido', exigeMotivo: true },
];

export const MOTIVOS_DESISTENCIA_PADRAO = [
  { codigo: 'preco_acima_esperado', nome: 'Preço acima do esperado', categoria: 'comercial' },
  { codigo: 'prazo_instalacao_longo', nome: 'Prazo de instalação longo', categoria: 'operacional' },
  { codigo: 'tempo_espera_elevado', nome: 'Tempo de espera elevado no balcão', categoria: 'atendimento' },
  { codigo: 'produto_indisponivel', nome: 'Produto ou acessório indisponível', categoria: 'estoque' },
  { codigo: 'pesquisa_de_preco', nome: 'Cliente apenas pesquisando preço', categoria: 'comercial' },
  { codigo: 'incompatibilidade_tecnica', nome: 'Incompatibilidade técnica com o veículo', categoria: 'tecnico' },
  { codigo: 'cliente_saiu_sem_retorno', nome: 'Cliente saiu antes da conclusão', categoria: 'atendimento' },
  { codigo: 'outro_motivo_padronizado', nome: 'Outro motivo operacional padronizado', categoria: 'outros' },
];

async function main() {
  for (const etapa of ETAPAS_PADRAO) {
    await prisma.etapa.upsert({
      where: { slug: etapa.slug },
      update: { ordem: etapa.ordem, nome: etapa.nome, descricao: etapa.descricao, ativa: true },
      create: { ...etapa, ativa: true },
    });
  }

  for (const desfecho of DESFECHOS_PADRAO) {
    await prisma.desfechoCatalogo.upsert({
      where: { codigo: desfecho.codigo },
      update: { nome: desfecho.nome, exigeMotivo: desfecho.exigeMotivo },
      create: desfecho,
    });
  }

  for (const motivo of MOTIVOS_DESISTENCIA_PADRAO) {
    await prisma.motivoDesistencia.upsert({
      where: { codigo: motivo.codigo },
      update: { nome: motivo.nome, categoria: motivo.categoria },
      create: motivo,
    });
  }

  await prisma.configuracaoEstatistica.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      janelaPadrao: 20,
      kDesvios: 2.0,
      minBaseline: 10,
      minJanela: 3,
      timeoutAbandonoS: 1800,
    },
  });

  console.log('Seed FASTCAR concluído com sucesso.');
}

main()
  .catch((err) => {
    console.error('Erro no seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
