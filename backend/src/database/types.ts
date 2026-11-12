export type StatusAtendimento =
  | 'em_andamento'
  | 'em_pausa'
  | 'aguardando_oficina'
  | 'finalizado'
  | 'abandonado';

export type ResultadoVisita =
  | 'em_andamento'
  | 'avancou'
  | 'retornou'
  | 'concluiu'
  | 'abandonou';

export interface EtapaRecord {
  id: number;
  ordem: number;
  slug: string;
  nome: string;
  descricao: string;
  ativa: boolean;
}

export interface DesfechoCatalogoRecord {
  id: number;
  codigo: string;
  nome: string;
  exigeMotivo: boolean;
}

export interface MotivoDesistenciaRecord {
  id: number;
  codigo: string;
  nome: string;
  categoria: string;
}

export interface AtendimentoRecord {
  id: number;
  uuidExterno: string;
  status: string;
  etapaAtualOrdem: number;
  iniciadoEm: Date;
  atualizadoEm: Date;
  finalizadoEm: Date | null;
  tempoTotalMs: number;
  tempoAtivoMs: number;
  tempoPausaMs: number;
  tempoEsperaOficinaMs: number;
  tempoOciosoMs: number;
  desfechoCodigo: string | null;
  motivoDesistenciaCodigo: string | null;
  dispositivo: string;
  cenario: string | null;
  sintetica: boolean;
}

export interface VisitaEtapaRecord {
  id: number;
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
}

export interface EventoTelemetriaRecord {
  id: number;
  eventoId: string;
  atendimentoId: number;
  tipo: string;
  etapaOrdem: number;
  ocorridoEm: Date;
  payloadSeguro: Record<string, unknown> | null;
  sintetica: boolean;
}

export interface PausaOperacionalRecord {
  id: number;
  pausaId: string;
  atendimentoId: number;
  etapaOrdem: number;
  motivoCodigo: string;
  iniciadaEm: Date;
  finalizadaEm: Date | null;
  duracaoMs: number;
  sintetica: boolean;
}

export interface EsperaOficinaRecord {
  id: number;
  esperaId: string;
  atendimentoId: number;
  etapaOrdem: number;
  motivoCodigo: string;
  iniciadaEm: Date;
  finalizadaEm: Date | null;
  duracaoMs: number;
  sintetica: boolean;
}

export interface ExecucaoSimulacaoRecord {
  id: number;
  semente: number;
  totalSessoes: number;
  regulares: number;
  anomalas: number;
  etapaAnomalia: number;
  precisao: number;
  revocacao: number;
  falsosPositivos: number;
  detalhesJson: Record<string, unknown>;
  criadoEm: Date;
}

export interface ConfiguracaoEstatisticaRecord {
  id: number;
  janelaPadrao: number;
  kDesvios: number;
  minBaseline: number;
  minJanela: number;
  timeoutAbandonoS: number;
  atualizadoEm: Date;
}

export interface FiltroAtendimentos {
  sintetica: boolean;
  dataInicio?: Date;
  dataFim?: Date;
  desfecho?: string;
  etapaOrdem?: number;
  status?: string;
  page?: number;
  limit?: number;
}

export interface FiltroAnalytics {
  sintetica: boolean;
  dataInicio?: Date;
  dataFim?: Date;
  desfecho?: string;
  etapaOrdem?: number;
  cenario?: string;
}

export interface IFunilRepository {
  listarEtapas(): Promise<EtapaRecord[]>;
  obterEtapaPorId(id: number): Promise<EtapaRecord | null>;
  obterEtapaPorSlug(slug: string): Promise<EtapaRecord | null>;
  obterEtapaPorOrdem(ordem: number): Promise<EtapaRecord | null>;

  listarDesfechos(): Promise<DesfechoCatalogoRecord[]>;
  listarMotivosDesistencia(): Promise<MotivoDesistenciaRecord[]>;

  criarAtendimento(data: {
    uuidExterno: string;
    dispositivo: string;
    cenario: string | null;
    sintetica: boolean;
    iniciadoEm?: Date;
  }): Promise<AtendimentoRecord>;
  obterAtendimentoPorId(id: number): Promise<AtendimentoRecord | null>;
  obterAtendimentoPorUuid(uuidExterno: string): Promise<AtendimentoRecord | null>;
  listarAtendimentos(filtro: FiltroAtendimentos): Promise<{
    itens: AtendimentoRecord[];
    total: number;
  }>;
  atualizarAtendimento(
    id: number,
    data: Partial<Omit<AtendimentoRecord, 'id' | 'uuidExterno'>>,
  ): Promise<AtendimentoRecord>;

  upsertVisitaEtapa(data: {
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
  }): Promise<VisitaEtapaRecord>;
  listarVisitasPorAtendimento(atendimentoId: number): Promise<VisitaEtapaRecord[]>;
  listarVisitasParaAnalytics(filtro: FiltroAnalytics): Promise<{
    atendimentos: AtendimentoRecord[];
    visitas: VisitaEtapaRecord[];
  }>;

  registrarEvento(data: {
    eventoId: string;
    atendimentoId: number;
    tipo: string;
    etapaOrdem: number;
    ocorridoEm: Date;
    payloadSeguro: Record<string, unknown> | null;
    sintetica: boolean;
  }): Promise<{ registro: EventoTelemetriaRecord; duplicado: boolean }>;
  listarEventosPorAtendimento(atendimentoId: number): Promise<EventoTelemetriaRecord[]>;

  criarPausa(data: {
    pausaId: string;
    atendimentoId: number;
    etapaOrdem: number;
    motivoCodigo: string;
    iniciadaEm: Date;
    sintetica: boolean;
  }): Promise<PausaOperacionalRecord>;
  obterPausaAberta(atendimentoId: number): Promise<PausaOperacionalRecord | null>;
  obterPausaPorPausaId(pausaId: string): Promise<PausaOperacionalRecord | null>;
  finalizarPausa(id: number, finalizadaEm: Date, duracaoMs: number): Promise<PausaOperacionalRecord>;
  listarPausasPorAtendimento(atendimentoId: number): Promise<PausaOperacionalRecord[]>;

  criarEsperaOficina(data: {
    esperaId: string;
    atendimentoId: number;
    etapaOrdem: number;
    motivoCodigo: string;
    iniciadaEm: Date;
    sintetica: boolean;
  }): Promise<EsperaOficinaRecord>;
  obterEsperaAberta(atendimentoId: number): Promise<EsperaOficinaRecord | null>;
  obterEsperaPorEsperaId(esperaId: string): Promise<EsperaOficinaRecord | null>;
  finalizarEspera(id: number, finalizadaEm: Date, duracaoMs: number): Promise<EsperaOficinaRecord>;
  listarEsperasPorAtendimento(atendimentoId: number): Promise<EsperaOficinaRecord[]>;

  inserirSessoesSinteticas(
    sessoes: Array<{
      atendimento: Omit<AtendimentoRecord, 'id'>;
      visitas: Array<Omit<VisitaEtapaRecord, 'id' | 'atendimentoId'>>;
      pausas: Array<Omit<PausaOperacionalRecord, 'id' | 'atendimentoId'>>;
      esperas: Array<Omit<EsperaOficinaRecord, 'id' | 'atendimentoId'>>;
    }>,
  ): Promise<number>;

  registrarExecucaoSimulacao(
    data: Omit<ExecucaoSimulacaoRecord, 'id' | 'criadoEm'>,
  ): Promise<ExecucaoSimulacaoRecord>;
  listarExecucoesSimulacao(): Promise<ExecucaoSimulacaoRecord[]>;
  obterExecucaoSimulacao(id: number): Promise<ExecucaoSimulacaoRecord | null>;

  limparDadosSinteticos(): Promise<{ atendimentosRemovidos: number }>;
  limparTodosDados(): Promise<{ atendimentosRemovidos: number }>;

  obterConfiguracaoEstatistica(): Promise<ConfiguracaoEstatisticaRecord>;
  atualizarConfiguracaoEstatistica(
    data: Partial<Omit<ConfiguracaoEstatisticaRecord, 'id' | 'atualizadoEm'>>,
  ): Promise<ConfiguracaoEstatisticaRecord>;
}
