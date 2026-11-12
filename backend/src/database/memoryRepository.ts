import {
  DESFECHOS_FASTCAR,
  ETAPAS_FASTCAR,
  MOTIVOS_DESISTENCIA_FASTCAR,
  REGRAS_ESTATISTICAS_PADRAO,
} from '../config/constants';
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

export class MemoryFunilRepository implements IFunilRepository {
  private etapas: EtapaRecord[] = ETAPAS_FASTCAR.map((e) => ({ ...e }));
  private desfechos: DesfechoCatalogoRecord[] = DESFECHOS_FASTCAR.map((d) => ({ ...d }));
  private motivos: MotivoDesistenciaRecord[] = MOTIVOS_DESISTENCIA_FASTCAR.map((m) => ({ ...m }));

  private atendimentos: AtendimentoRecord[] = [];
  private visitas: VisitaEtapaRecord[] = [];
  private eventos: EventoTelemetriaRecord[] = [];
  private pausas: PausaOperacionalRecord[] = [];
  private esperas: EsperaOficinaRecord[] = [];
  private simulacoes: ExecucaoSimulacaoRecord[] = [];

  private nextAtendimentoId = 1;
  private nextVisitaId = 1;
  private nextEventoId = 1;
  private nextPausaId = 1;
  private nextEsperaId = 1;
  private nextSimulacaoId = 1;

  private config: ConfiguracaoEstatisticaRecord = {
    id: 1,
    janelaPadrao: REGRAS_ESTATISTICAS_PADRAO.janelaPadrao,
    kDesvios: REGRAS_ESTATISTICAS_PADRAO.kDesvios,
    minBaseline: REGRAS_ESTATISTICAS_PADRAO.minBaseline,
    minJanela: REGRAS_ESTATISTICAS_PADRAO.minJanela,
    timeoutAbandonoS: REGRAS_ESTATISTICAS_PADRAO.timeoutAbandonoS,
    atualizadoEm: new Date(),
  };

  async listarEtapas(): Promise<EtapaRecord[]> {
    return [...this.etapas].sort((a, b) => a.ordem - b.ordem);
  }

  async obterEtapaPorId(id: number): Promise<EtapaRecord | null> {
    return this.etapas.find((e) => e.id === id) ?? null;
  }

  async obterEtapaPorSlug(slug: string): Promise<EtapaRecord | null> {
    return this.etapas.find((e) => e.slug === slug) ?? null;
  }

  async obterEtapaPorOrdem(ordem: number): Promise<EtapaRecord | null> {
    return this.etapas.find((e) => e.ordem === ordem) ?? null;
  }

  async listarDesfechos(): Promise<DesfechoCatalogoRecord[]> {
    return [...this.desfechos];
  }

  async listarMotivosDesistencia(): Promise<MotivoDesistenciaRecord[]> {
    return [...this.motivos];
  }

  async criarAtendimento(data: {
    uuidExterno: string;
    dispositivo: string;
    cenario: string | null;
    sintetica: boolean;
    iniciadoEm?: Date;
  }): Promise<AtendimentoRecord> {
    const existing = this.atendimentos.find((a) => a.uuidExterno === data.uuidExterno);
    if (existing) return { ...existing };

    const iniciado = data.iniciadoEm ?? new Date();
    const record: AtendimentoRecord = {
      id: this.nextAtendimentoId++,
      uuidExterno: data.uuidExterno,
      status: 'em_andamento',
      etapaAtualOrdem: 1,
      iniciadoEm: iniciado,
      atualizadoEm: iniciado,
      finalizadoEm: null,
      tempoTotalMs: 0,
      tempoAtivoMs: 0,
      tempoPausaMs: 0,
      tempoEsperaOficinaMs: 0,
      tempoOciosoMs: 0,
      desfechoCodigo: null,
      motivoDesistenciaCodigo: null,
      dispositivo: data.dispositivo,
      cenario: data.cenario,
      sintetica: data.sintetica,
    };
    this.atendimentos.push(record);
    return { ...record };
  }

  async obterAtendimentoPorId(id: number): Promise<AtendimentoRecord | null> {
    const found = this.atendimentos.find((a) => a.id === id);
    return found ? { ...found } : null;
  }

  async obterAtendimentoPorUuid(uuidExterno: string): Promise<AtendimentoRecord | null> {
    const found = this.atendimentos.find((a) => a.uuidExterno === uuidExterno);
    return found ? { ...found } : null;
  }

  async listarAtendimentos(filtro: FiltroAtendimentos): Promise<{
    itens: AtendimentoRecord[];
    total: number;
  }> {
    const etapaAtendimentos = filtro.etapaOrdem
      ? new Set(this.visitas.filter((v) => v.ordem === filtro.etapaOrdem).map((v) => v.atendimentoId))
      : null;

    const filtrados = this.atendimentos
      .filter((a) => {
        if (a.sintetica !== filtro.sintetica) return false;
        if (filtro.status && a.status !== filtro.status) return false;
        if (filtro.desfecho && a.desfechoCodigo !== filtro.desfecho) return false;
        if (filtro.dataInicio && a.iniciadoEm < filtro.dataInicio) return false;
        if (filtro.dataFim && a.iniciadoEm > filtro.dataFim) return false;
        if (etapaAtendimentos && !etapaAtendimentos.has(a.id)) return false;
        return true;
      })
      .sort((a, b) => b.iniciadoEm.getTime() - a.iniciadoEm.getTime() || b.id - a.id);

    const page = Math.max(1, filtro.page ?? 1);
    const limit = Math.min(100, Math.max(1, filtro.limit ?? 20));
    const start = (page - 1) * limit;
    return {
      itens: filtrados.slice(start, start + limit).map((a) => ({ ...a })),
      total: filtrados.length,
    };
  }

  async atualizarAtendimento(
    id: number,
    data: Partial<Omit<AtendimentoRecord, 'id' | 'uuidExterno'>>,
  ): Promise<AtendimentoRecord> {
    const idx = this.atendimentos.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error(`Atendimento ${id} não encontrado`);
    this.atendimentos[idx] = { ...this.atendimentos[idx], ...data };
    return { ...this.atendimentos[idx] };
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
    const idx = this.visitas.findIndex((v) => v.visitaId === data.visitaId);
    if (idx >= 0) {
      this.visitas[idx] = {
        ...this.visitas[idx],
        atualizadaEm: data.atualizadaEm,
        finalizadaEm: data.finalizadaEm,
        tempoTotalMs: data.tempoTotalMs,
        tempoAtivoMs: data.tempoAtivoMs,
        tempoPausaMs: data.tempoPausaMs,
        tempoEsperaOficinaMs: data.tempoEsperaOficinaMs,
        tempoOciosoMs: data.tempoOciosoMs,
        resultado: data.resultado,
        overheadMs: data.overheadMs,
      };
      return { ...this.visitas[idx] };
    }
    const created: VisitaEtapaRecord = { id: this.nextVisitaId++, ...data };
    this.visitas.push(created);
    return { ...created };
  }

  async listarVisitasPorAtendimento(atendimentoId: number): Promise<VisitaEtapaRecord[]> {
    return this.visitas
      .filter((v) => v.atendimentoId === atendimentoId)
      .sort((a, b) => a.ordem - b.ordem || a.iniciadaEm.getTime() - b.iniciadaEm.getTime())
      .map((v) => ({ ...v }));
  }

  async listarVisitasParaAnalytics(filtro: FiltroAnalytics): Promise<{
    atendimentos: AtendimentoRecord[];
    visitas: VisitaEtapaRecord[];
  }> {
    const atendimentos = this.atendimentos
      .filter((a) => {
        if (a.sintetica !== filtro.sintetica) return false;
        if (filtro.desfecho && a.desfechoCodigo !== filtro.desfecho) return false;
        if (filtro.cenario && a.cenario !== filtro.cenario) return false;
        if (filtro.dataInicio && a.iniciadoEm < filtro.dataInicio) return false;
        if (filtro.dataFim && a.iniciadoEm > filtro.dataFim) return false;
        return true;
      })
      .sort((a, b) => a.iniciadoEm.getTime() - b.iniciadoEm.getTime() || a.id - b.id);

    const ids = new Set(atendimentos.map((a) => a.id));
    const visitas = this.visitas
      .filter((v) => {
        if (v.sintetica !== filtro.sintetica) return false;
        if (!ids.has(v.atendimentoId)) return false;
        if (filtro.etapaOrdem && v.ordem !== filtro.etapaOrdem) return false;
        return true;
      })
      .sort((a, b) => a.iniciadaEm.getTime() - b.iniciadaEm.getTime() || a.id - b.id);

    return {
      atendimentos: atendimentos.map((a) => ({ ...a })),
      visitas: visitas.map((v) => ({ ...v })),
    };
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
    const existing = this.eventos.find((e) => e.eventoId === data.eventoId);
    if (existing) return { registro: { ...existing }, duplicado: true };
    const created: EventoTelemetriaRecord = { id: this.nextEventoId++, ...data };
    this.eventos.push(created);
    return { registro: { ...created }, duplicado: false };
  }

  async listarEventosPorAtendimento(atendimentoId: number): Promise<EventoTelemetriaRecord[]> {
    return this.eventos
      .filter((e) => e.atendimentoId === atendimentoId)
      .sort((a, b) => a.ocorridoEm.getTime() - b.ocorridoEm.getTime())
      .map((e) => ({ ...e }));
  }

  async criarPausa(data: {
    pausaId: string;
    atendimentoId: number;
    etapaOrdem: number;
    motivoCodigo: string;
    iniciadaEm: Date;
    sintetica: boolean;
  }): Promise<PausaOperacionalRecord> {
    const created: PausaOperacionalRecord = {
      id: this.nextPausaId++,
      ...data,
      finalizadaEm: null,
      duracaoMs: 0,
    };
    this.pausas.push(created);
    return { ...created };
  }

  async obterPausaAberta(atendimentoId: number): Promise<PausaOperacionalRecord | null> {
    const found = [...this.pausas]
      .reverse()
      .find((p) => p.atendimentoId === atendimentoId && p.finalizadaEm === null);
    return found ? { ...found } : null;
  }

  async obterPausaPorPausaId(pausaId: string): Promise<PausaOperacionalRecord | null> {
    const found = this.pausas.find((p) => p.pausaId === pausaId);
    return found ? { ...found } : null;
  }

  async finalizarPausa(
    id: number,
    finalizadaEm: Date,
    duracaoMs: number,
  ): Promise<PausaOperacionalRecord> {
    const idx = this.pausas.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Pausa ${id} não encontrada`);
    this.pausas[idx] = { ...this.pausas[idx], finalizadaEm, duracaoMs };
    return { ...this.pausas[idx] };
  }

  async listarPausasPorAtendimento(atendimentoId: number): Promise<PausaOperacionalRecord[]> {
    return this.pausas
      .filter((p) => p.atendimentoId === atendimentoId)
      .sort((a, b) => a.iniciadaEm.getTime() - b.iniciadaEm.getTime())
      .map((p) => ({ ...p }));
  }

  async criarEsperaOficina(data: {
    esperaId: string;
    atendimentoId: number;
    etapaOrdem: number;
    motivoCodigo: string;
    iniciadaEm: Date;
    sintetica: boolean;
  }): Promise<EsperaOficinaRecord> {
    const created: EsperaOficinaRecord = {
      id: this.nextEsperaId++,
      ...data,
      finalizadaEm: null,
      duracaoMs: 0,
    };
    this.esperas.push(created);
    return { ...created };
  }

  async obterEsperaAberta(atendimentoId: number): Promise<EsperaOficinaRecord | null> {
    const found = [...this.esperas]
      .reverse()
      .find((e) => e.atendimentoId === atendimentoId && e.finalizadaEm === null);
    return found ? { ...found } : null;
  }

  async obterEsperaPorEsperaId(esperaId: string): Promise<EsperaOficinaRecord | null> {
    const found = this.esperas.find((e) => e.esperaId === esperaId);
    return found ? { ...found } : null;
  }

  async finalizarEspera(
    id: number,
    finalizadaEm: Date,
    duracaoMs: number,
  ): Promise<EsperaOficinaRecord> {
    const idx = this.esperas.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error(`Espera ${id} não encontrada`);
    this.esperas[idx] = { ...this.esperas[idx], finalizadaEm, duracaoMs };
    return { ...this.esperas[idx] };
  }

  async listarEsperasPorAtendimento(atendimentoId: number): Promise<EsperaOficinaRecord[]> {
    return this.esperas
      .filter((e) => e.atendimentoId === atendimentoId)
      .sort((a, b) => a.iniciadaEm.getTime() - b.iniciadaEm.getTime())
      .map((e) => ({ ...e }));
  }

  async inserirSessoesSinteticas(
    sessoes: Array<{
      atendimento: Omit<AtendimentoRecord, 'id'>;
      visitas: Array<Omit<VisitaEtapaRecord, 'id' | 'atendimentoId'>>;
      pausas: Array<Omit<PausaOperacionalRecord, 'id' | 'atendimentoId'>>;
      esperas: Array<Omit<EsperaOficinaRecord, 'id' | 'atendimentoId'>>;
    }>,
  ): Promise<number> {
    for (const s of sessoes) {
      const atendimentoId = this.nextAtendimentoId++;
      this.atendimentos.push({ ...s.atendimento, id: atendimentoId, sintetica: true });
      for (const v of s.visitas) {
        this.visitas.push({ ...v, id: this.nextVisitaId++, atendimentoId, sintetica: true });
      }
      for (const p of s.pausas) {
        this.pausas.push({ ...p, id: this.nextPausaId++, atendimentoId, sintetica: true });
      }
      for (const e of s.esperas) {
        this.esperas.push({ ...e, id: this.nextEsperaId++, atendimentoId, sintetica: true });
      }
    }
    return sessoes.length;
  }

  async registrarExecucaoSimulacao(
    data: Omit<ExecucaoSimulacaoRecord, 'id' | 'criadoEm'>,
  ): Promise<ExecucaoSimulacaoRecord> {
    const created: ExecucaoSimulacaoRecord = {
      ...data,
      id: this.nextSimulacaoId++,
      criadoEm: new Date(),
    };
    this.simulacoes.push(created);
    return { ...created };
  }

  async listarExecucoesSimulacao(): Promise<ExecucaoSimulacaoRecord[]> {
    return [...this.simulacoes].sort((a, b) => b.id - a.id);
  }

  async obterExecucaoSimulacao(id: number): Promise<ExecucaoSimulacaoRecord | null> {
    return this.simulacoes.find((s) => s.id === id) ?? null;
  }

  async limparDadosSinteticos(): Promise<{ atendimentosRemovidos: number }> {
    const antes = this.atendimentos.length;
    const idsSinteticos = new Set(this.atendimentos.filter((a) => a.sintetica).map((a) => a.id));
    this.atendimentos = this.atendimentos.filter((a) => !a.sintetica);
    this.visitas = this.visitas.filter((v) => !v.sintetica && !idsSinteticos.has(v.atendimentoId));
    this.eventos = this.eventos.filter((e) => !e.sintetica && !idsSinteticos.has(e.atendimentoId));
    this.pausas = this.pausas.filter((p) => !p.sintetica && !idsSinteticos.has(p.atendimentoId));
    this.esperas = this.esperas.filter((e) => !e.sintetica && !idsSinteticos.has(e.atendimentoId));
    return { atendimentosRemovidos: antes - this.atendimentos.length };
  }

  async limparTodosDados(): Promise<{ atendimentosRemovidos: number }> {
    const count = this.atendimentos.length;
    this.atendimentos = [];
    this.visitas = [];
    this.eventos = [];
    this.pausas = [];
    this.esperas = [];
    return { atendimentosRemovidos: count };
  }

  async obterConfiguracaoEstatistica(): Promise<ConfiguracaoEstatisticaRecord> {
    return { ...this.config };
  }

  async atualizarConfiguracaoEstatistica(
    data: Partial<Omit<ConfiguracaoEstatisticaRecord, 'id' | 'atualizadoEm'>>,
  ): Promise<ConfiguracaoEstatisticaRecord> {
    this.config = {
      ...this.config,
      ...data,
      atualizadoEm: new Date(),
    };
    return { ...this.config };
  }
}
