import { Prisma, PrismaClient } from '@prisma/client';
import { REGRAS_ESTATISTICAS_PADRAO } from '../config/constants';
import {
  AtendimentoRecord,
  ConfiguracaoEstatisticaRecord,
  DesfechoCatalogoRecord,
  EsperaOficinaRecord,
  EtapaRecord,
  EventoTelemetriaRecord,
  ExecucaoSimulacaoRecord,
  FiltroAnalytics,
  FiltroAtendimentos,
  IFunilRepository,
  MotivoDesistenciaRecord,
  PausaOperacionalRecord,
  VisitaEtapaRecord,
} from './types';

export class PrismaFunilRepository implements IFunilRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listarEtapas(): Promise<EtapaRecord[]> {
    return this.prisma.etapa.findMany({ orderBy: { ordem: 'asc' } });
  }

  async obterEtapaPorId(id: number): Promise<EtapaRecord | null> {
    return this.prisma.etapa.findUnique({ where: { id } });
  }

  async obterEtapaPorSlug(slug: string): Promise<EtapaRecord | null> {
    return this.prisma.etapa.findUnique({ where: { slug } });
  }

  async obterEtapaPorOrdem(ordem: number): Promise<EtapaRecord | null> {
    return this.prisma.etapa.findUnique({ where: { ordem } });
  }

  async listarDesfechos(): Promise<DesfechoCatalogoRecord[]> {
    return this.prisma.desfechoCatalogo.findMany({ orderBy: { id: 'asc' } });
  }

  async listarMotivosDesistencia(): Promise<MotivoDesistenciaRecord[]> {
    return this.prisma.motivoDesistencia.findMany({ orderBy: { id: 'asc' } });
  }

  async criarAtendimento(data: {
    uuidExterno: string;
    dispositivo: string;
    cenario: string | null;
    sintetica: boolean;
    iniciadoEm?: Date;
  }): Promise<AtendimentoRecord> {
    const iniciado = data.iniciadoEm ?? new Date();
    return this.prisma.atendimento.upsert({
      where: { uuidExterno: data.uuidExterno },
      update: {},
      create: {
        uuidExterno: data.uuidExterno,
        dispositivo: data.dispositivo,
        cenario: data.cenario,
        sintetica: data.sintetica,
        iniciadoEm: iniciado,
        atualizadoEm: iniciado,
      },
    });
  }

  async obterAtendimentoPorId(id: number): Promise<AtendimentoRecord | null> {
    return this.prisma.atendimento.findUnique({ where: { id } });
  }

  async obterAtendimentoPorUuid(uuidExterno: string): Promise<AtendimentoRecord | null> {
    return this.prisma.atendimento.findUnique({ where: { uuidExterno } });
  }

  async listarAtendimentos(filtro: FiltroAtendimentos): Promise<{
    itens: AtendimentoRecord[];
    total: number;
  }> {
    const page = Math.max(1, filtro.page ?? 1);
    const limit = Math.min(100, Math.max(1, filtro.limit ?? 20));
    const where: Prisma.AtendimentoWhereInput = {
      sintetica: filtro.sintetica,
      ...(filtro.status ? { status: filtro.status } : {}),
      ...(filtro.desfecho ? { desfechoCodigo: filtro.desfecho } : {}),
      ...(filtro.dataInicio || filtro.dataFim
        ? {
            iniciadoEm: {
              ...(filtro.dataInicio ? { gte: filtro.dataInicio } : {}),
              ...(filtro.dataFim ? { lte: filtro.dataFim } : {}),
            },
          }
        : {}),
      ...(filtro.etapaOrdem
        ? {
            visitas: {
              some: { ordem: filtro.etapaOrdem },
            },
          }
        : {}),
    };

    const [itens, total] = await Promise.all([
      this.prisma.atendimento.findMany({
        where,
        orderBy: { iniciadoEm: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.atendimento.count({ where }),
    ]);

    return { itens, total };
  }

  async atualizarAtendimento(
    id: number,
    data: Partial<Omit<AtendimentoRecord, 'id' | 'uuidExterno'>>,
  ): Promise<AtendimentoRecord> {
    return this.prisma.atendimento.update({
      where: { id },
      data,
    });
  }

  async upsertVisitaEtapa(data: {
    visitaId: string;
    atendimentoId: number;
    etapaId: number;
    etapaSlug: string;
    ordem: number;
    iniciadaEm: Date;
    atualizadaEm: Date;
    finalizadaEm: Date | null;
    tempoTotalMs: number;
    tempoAtivoMs: number;
    tempoPausaMs: number;
    tempoEsperaOficinaMs: number;
    tempoOciosoMs: number;
    resultado: string;
    overheadMs: number | null;
    sintetica: boolean;
  }): Promise<VisitaEtapaRecord> {
    return this.prisma.visitaEtapa.upsert({
      where: { visitaId: data.visitaId },
      update: {
        atualizadaEm: data.atualizadaEm,
        finalizadaEm: data.finalizadaEm,
        tempoTotalMs: data.tempoTotalMs,
        tempoAtivoMs: data.tempoAtivoMs,
        tempoPausaMs: data.tempoPausaMs,
        tempoEsperaOficinaMs: data.tempoEsperaOficinaMs,
        tempoOciosoMs: data.tempoOciosoMs,
        resultado: data.resultado,
        overheadMs: data.overheadMs,
      },
      create: data,
    });
  }

  async listarVisitasPorAtendimento(atendimentoId: number): Promise<VisitaEtapaRecord[]> {
    return this.prisma.visitaEtapa.findMany({
      where: { atendimentoId },
      orderBy: [{ ordem: 'asc' }, { iniciadaEm: 'asc' }],
    });
  }

  async listarVisitasParaAnalytics(filtro: FiltroAnalytics): Promise<{
    atendimentos: AtendimentoRecord[];
    visitas: VisitaEtapaRecord[];
  }> {
    const atendimentoWhere: Prisma.AtendimentoWhereInput = {
      sintetica: filtro.sintetica,
      ...(filtro.desfecho ? { desfechoCodigo: filtro.desfecho } : {}),
      ...(filtro.cenario ? { cenario: filtro.cenario } : {}),
      ...(filtro.dataInicio || filtro.dataFim
        ? {
            iniciadoEm: {
              ...(filtro.dataInicio ? { gte: filtro.dataInicio } : {}),
              ...(filtro.dataFim ? { lte: filtro.dataFim } : {}),
            },
          }
        : {}),
    };

    const atendimentos = await this.prisma.atendimento.findMany({
      where: atendimentoWhere,
      orderBy: [{ iniciadoEm: 'asc' }, { id: 'asc' }],
    });

    if (atendimentos.length === 0) {
      return { atendimentos: [], visitas: [] };
    }

    const ids = atendimentos.map((a) => a.id);
    const visitas = await this.prisma.visitaEtapa.findMany({
      where: {
        sintetica: filtro.sintetica,
        atendimentoId: { in: ids },
        ...(filtro.etapaOrdem ? { ordem: filtro.etapaOrdem } : {}),
      },
      orderBy: [{ iniciadaEm: 'asc' }, { id: 'asc' }],
    });

    return { atendimentos, visitas };
  }

  async registrarEvento(data: {
    eventoId: string;
    atendimentoId: number;
    tipo: string;
    etapaOrdem: number;
    ocorridoEm: Date;
    payloadSeguro: Record<string, unknown> | null;
    sintetica: boolean;
  }): Promise<{ registro: EventoTelemetriaRecord; duplicado: boolean }> {
    const existente = await this.prisma.eventoTelemetria.findUnique({
      where: { eventoId: data.eventoId },
    });
    if (existente) {
      return {
        registro: {
          ...existente,
          payloadSeguro: (existente.payloadSeguro as Record<string, unknown> | null) ?? null,
        },
        duplicado: true,
      };
    }

    const criado = await this.prisma.eventoTelemetria.create({
      data: {
        eventoId: data.eventoId,
        atendimentoId: data.atendimentoId,
        tipo: data.tipo,
        etapaOrdem: data.etapaOrdem,
        ocorridoEm: data.ocorridoEm,
        payloadSeguro:
          data.payloadSeguro === null
            ? Prisma.JsonNull
            : (data.payloadSeguro as Prisma.InputJsonValue),
        sintetica: data.sintetica,
      },
    });

    return {
      registro: {
        ...criado,
        payloadSeguro: (criado.payloadSeguro as Record<string, unknown> | null) ?? null,
      },
      duplicado: false,
    };
  }

  async listarEventosPorAtendimento(atendimentoId: number): Promise<EventoTelemetriaRecord[]> {
    const rows = await this.prisma.eventoTelemetria.findMany({
      where: { atendimentoId },
      orderBy: { ocorridoEm: 'asc' },
    });
    return rows.map((r) => ({
      ...r,
      payloadSeguro: (r.payloadSeguro as Record<string, unknown> | null) ?? null,
    }));
  }

  async criarPausa(data: {
    pausaId: string;
    atendimentoId: number;
    etapaOrdem: number;
    motivoCodigo: string;
    iniciadaEm: Date;
    sintetica: boolean;
  }): Promise<PausaOperacionalRecord> {
    return this.prisma.pausaOperacional.create({ data });
  }

  async obterPausaAberta(atendimentoId: number): Promise<PausaOperacionalRecord | null> {
    return this.prisma.pausaOperacional.findFirst({
      where: { atendimentoId, finalizadaEm: null },
      orderBy: { iniciadaEm: 'desc' },
    });
  }

  async obterPausaPorPausaId(pausaId: string): Promise<PausaOperacionalRecord | null> {
    return this.prisma.pausaOperacional.findUnique({ where: { pausaId } });
  }

  async finalizarPausa(
    id: number,
    finalizadaEm: Date,
    duracaoMs: number,
  ): Promise<PausaOperacionalRecord> {
    return this.prisma.pausaOperacional.update({
      where: { id },
      data: { finalizadaEm, duracaoMs },
    });
  }

  async listarPausasPorAtendimento(atendimentoId: number): Promise<PausaOperacionalRecord[]> {
    return this.prisma.pausaOperacional.findMany({
      where: { atendimentoId },
      orderBy: { iniciadaEm: 'asc' },
    });
  }

  async criarEsperaOficina(data: {
    esperaId: string;
    atendimentoId: number;
    etapaOrdem: number;
    motivoCodigo: string;
    iniciadaEm: Date;
    sintetica: boolean;
  }): Promise<EsperaOficinaRecord> {
    return this.prisma.esperaOficina.create({ data });
  }

  async obterEsperaAberta(atendimentoId: number): Promise<EsperaOficinaRecord | null> {
    return this.prisma.esperaOficina.findFirst({
      where: { atendimentoId, finalizadaEm: null },
      orderBy: { iniciadaEm: 'desc' },
    });
  }

  async obterEsperaPorEsperaId(esperaId: string): Promise<EsperaOficinaRecord | null> {
    return this.prisma.esperaOficina.findUnique({ where: { esperaId } });
  }

  async finalizarEspera(
    id: number,
    finalizadaEm: Date,
    duracaoMs: number,
  ): Promise<EsperaOficinaRecord> {
    return this.prisma.esperaOficina.update({
      where: { id },
      data: { finalizadaEm, duracaoMs },
    });
  }

  async listarEsperasPorAtendimento(atendimentoId: number): Promise<EsperaOficinaRecord[]> {
    return this.prisma.esperaOficina.findMany({
      where: { atendimentoId },
      orderBy: { iniciadaEm: 'asc' },
    });
  }

  async inserirSessoesSinteticas(
    sessoes: Array<{
      atendimento: Omit<AtendimentoRecord, 'id'>;
      visitas: Array<Omit<VisitaEtapaRecord, 'id' | 'atendimentoId'>>;
      pausas: Array<Omit<PausaOperacionalRecord, 'id' | 'atendimentoId'>>;
      esperas: Array<Omit<EsperaOficinaRecord, 'id' | 'atendimentoId'>>;
    }>,
  ): Promise<number> {
    await this.prisma.$transaction(async (tx) => {
      for (const s of sessoes) {
        const created = await tx.atendimento.create({
          data: {
            ...s.atendimento,
            sintetica: true,
          },
        });
        if (s.visitas.length > 0) {
          await tx.visitaEtapa.createMany({
            data: s.visitas.map((v) => ({
              ...v,
              atendimentoId: created.id,
              sintetica: true,
            })),
          });
        }
        if (s.pausas.length > 0) {
          await tx.pausaOperacional.createMany({
            data: s.pausas.map((p) => ({
              ...p,
              atendimentoId: created.id,
              sintetica: true,
            })),
          });
        }
        if (s.esperas.length > 0) {
          await tx.esperaOficina.createMany({
            data: s.esperas.map((e) => ({
              ...e,
              atendimentoId: created.id,
              sintetica: true,
            })),
          });
        }
      }
    });
    return sessoes.length;
  }

  async registrarExecucaoSimulacao(
    data: Omit<ExecucaoSimulacaoRecord, 'id' | 'criadoEm'>,
  ): Promise<ExecucaoSimulacaoRecord> {
    const created = await this.prisma.execucaoSimulacao.create({
      data: {
        semente: data.semente,
        totalSessoes: data.totalSessoes,
        regulares: data.regulares,
        anomalas: data.anomalas,
        etapaAnomalia: data.etapaAnomalia,
        precisao: data.precisao,
        revocacao: data.revocacao,
        falsosPositivos: data.falsosPositivos,
        detalhesJson: data.detalhesJson as Prisma.InputJsonValue,
      },
    });
    return {
      ...created,
      detalhesJson: (created.detalhesJson as Record<string, unknown>) ?? {},
    };
  }

  async listarExecucoesSimulacao(): Promise<ExecucaoSimulacaoRecord[]> {
    const rows = await this.prisma.execucaoSimulacao.findMany({
      orderBy: { criadoEm: 'desc' },
      take: 50,
    });
    return rows.map((r) => ({
      ...r,
      detalhesJson: (r.detalhesJson as Record<string, unknown>) ?? {},
    }));
  }

  async obterExecucaoSimulacao(id: number): Promise<ExecucaoSimulacaoRecord | null> {
    const row = await this.prisma.execucaoSimulacao.findUnique({ where: { id } });
    if (!row) return null;
    return {
      ...row,
      detalhesJson: (row.detalhesJson as Record<string, unknown>) ?? {},
    };
  }

  async limparDadosSinteticos(): Promise<{ atendimentosRemovidos: number }> {
    const res = await this.prisma.atendimento.deleteMany({
      where: { sintetica: true },
    });
    return { atendimentosRemovidos: res.count };
  }

  async limparTodosDados(): Promise<{ atendimentosRemovidos: number }> {
    const res = await this.prisma.atendimento.deleteMany({});
    return { atendimentosRemovidos: res.count };
  }

  async obterConfiguracaoEstatistica(): Promise<ConfiguracaoEstatisticaRecord> {
    const cfg = await this.prisma.configuracaoEstatistica.findUnique({ where: { id: 1 } });
    if (cfg) return cfg;
    return this.prisma.configuracaoEstatistica.create({
      data: {
        id: 1,
        janelaPadrao: REGRAS_ESTATISTICAS_PADRAO.janelaPadrao,
        kDesvios: REGRAS_ESTATISTICAS_PADRAO.kDesvios,
        minBaseline: REGRAS_ESTATISTICAS_PADRAO.minBaseline,
        minJanela: REGRAS_ESTATISTICAS_PADRAO.minJanela,
        timeoutAbandonoS: REGRAS_ESTATISTICAS_PADRAO.timeoutAbandonoS,
      },
    });
  }

  async atualizarConfiguracaoEstatistica(
    data: Partial<Omit<ConfiguracaoEstatisticaRecord, 'id' | 'atualizadoEm'>>,
  ): Promise<ConfiguracaoEstatisticaRecord> {
    return this.prisma.configuracaoEstatistica.upsert({
      where: { id: 1 },
      update: { ...data, atualizadoEm: new Date() },
      create: {
        id: 1,
        janelaPadrao: data.janelaPadrao ?? REGRAS_ESTATISTICAS_PADRAO.janelaPadrao,
        kDesvios: data.kDesvios ?? REGRAS_ESTATISTICAS_PADRAO.kDesvios,
        minBaseline: data.minBaseline ?? REGRAS_ESTATISTICAS_PADRAO.minBaseline,
        minJanela: data.minJanela ?? REGRAS_ESTATISTICAS_PADRAO.minJanela,
        timeoutAbandonoS: data.timeoutAbandonoS ?? REGRAS_ESTATISTICAS_PADRAO.timeoutAbandonoS,
        atualizadoEm: new Date(),
      },
    });
  }
}
