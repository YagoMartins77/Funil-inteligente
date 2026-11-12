export interface Etapa {
  id: number;
  ordem: number;
  slug: string;
  nome: string;
  descricao: string;
  ativa: boolean;
}

export interface DesfechoCatalogo {
  id: number;
  codigo: string;
  nome: string;
  exigeMotivo: boolean;
}

export interface MotivoDesistencia {
  id: number;
  codigo: string;
  nome: string;
  categoria: string;
}

export interface Atendimento {
  id: number;
  uuidExterno: string;
  status: string;
  etapaAtualOrdem: number;
  iniciadoEm: string;
  atualizadoEm: string;
  finalizadoEm: string | null;
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

export interface VisitaEtapa {
  id: number;
  visitaId: string;
  atendimentoId: number;
  etapaId: number;
  etapaSlug: string;
  ordem: number;
  iniciadaEm: string;
  atualizadaEm: string;
  finalizadaEm: string | null;
  tempoTotalMs: number;
  tempoAtivoMs: number;
  tempoPausaMs: number;
  tempoEsperaOficinaMs: number;
  tempoOciosoMs: number;
  resultado: string;
  overheadMs: number | null;
  sintetica: boolean;
}

export interface IntervaloOperacional {
  id: number;
  atendimentoId: number;
  etapaOrdem: number;
  motivoCodigo: string;
  iniciadaEm: string;
  finalizadaEm: string | null;
  duracaoMs: number;
}

export interface EstatisticasBasicas {
  n: number;
  media: number | null;
  mediana: number | null;
  desvio: number | null;
  p95: number | null;
  minimo: number | null;
  maximo: number | null;
}

export interface ResultadoAnomalia {
  status: 'dados_insuficientes' | 'normal' | 'anomalia';
  nHistorico: number;
  nJanela: number;
  medianaHistoricaMs: number | null;
  desvioHistoricoMs: number | null;
  limiarMs: number | null;
  mediaJanelaMs: number | null;
  desviosAcimaMediana: number | null;
  explicacao: string;
}

export interface EtapaFunilAnalise {
  ordem: number;
  slug: string;
  nome: string;
  entradas: number;
  avancaram: number;
  abandonos: number;
  emAndamento: number;
  taxaContinuidade: number | null;
  taxaAbandono: number | null;
  conversaoAcumulada: number | null;
  tempoAtivo: EstatisticasBasicas;
  tempoPausaMedioMs: number | null;
  tempoEsperaOficinaMedioMs: number | null;
  tempoOciosoMedioMs: number | null;
  anomalia: ResultadoAnomalia;
}

export interface AnaliseFunilResponse {
  atualizadoEm: string;
  parametros: { janela: number; k: number; minBaseline: number; minJanela: number };
  janela: { sessoesJanela: number; sessoesHistorico: number };
  resumo: {
    totalAtendimentos: number;
    convertidos: number;
    naoConvertidos: number;
    desistencias: number;
    emAndamento: number;
    taxaConversao: number | null;
    taxaAbandono: number | null;
    tempoMedioAtendimentoMs: number | null;
    medianaAtendimentoMs: number | null;
    desvioAtendimentoMs: number | null;
    tempoMedioEsperaOficinaMs: number | null;
    tempoMedioPausaMs: number | null;
    atendimentosAtipicos: number;
  };
  funil: EtapaFunilAnalise[];
  alertas: Array<ResultadoAnomalia & { ordem: number; slug: string; nome: string }>;
  tempoDesfecho: Array<{
    desfecho: string;
    quantidade: number;
    tempoTotal: EstatisticasBasicas;
    tempoAtivo: EstatisticasBasicas;
    tempoEsperaOficinaMedioMs: number | null;
    tempoPausaMedioMs: number | null;
  }>;
  motivosAbandono: Array<{ codigo: string; quantidade: number; percentual: number | null }>;
  overhead: {
    n: number;
    mediaMs: number | null;
    p95Ms: number | null;
    maximoMs: number | null;
    limiteMs: number;
    atende: boolean | null;
  };
}

export interface ExecucaoSimulacao {
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
  criadoEm: string;
}

export interface ConfiguracaoEstatistica {
  id: number;
  janelaPadrao: number;
  kDesvios: number;
  minBaseline: number;
  minJanela: number;
  timeoutAbandonoS: number;
  atualizadoEm: string;
}
