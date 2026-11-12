import { REGRAS_ESTATISTICAS_PADRAO } from '../../config/constants';
import { AtendimentoRecord, EtapaRecord, VisitaEtapaRecord } from '../../database/types';

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

export interface QuartilTempoAbandono {
  faixa: string;
  deMs: number | null;
  ateMs: number | null;
  n: number;
  abandonos: number;
  taxaAbandono: number | null;
}

export interface RelacaoTempoAbandono {
  n: number;
  pearsonR: number | null;
  quartis: QuartilTempoAbandono[];
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
  relacaoTempoAbandono: RelacaoTempoAbandono;
}

const AVANCOS = new Set(['avancou', 'concluiu']);
const FINAIS = new Set(['avancou', 'concluiu', 'abandonou']);

function roundOrNull(val: number | null, casas = 1): number | null {
  if (val === null || Number.isNaN(val)) return null;
  const fator = 10 ** casas;
  return Math.round(val * fator) / fator;
}

export function fmean(valores: number[]): number {
  if (valores.length === 0) return 0;
  return valores.reduce((acc, v) => acc + v, 0) / valores.length;
}

export function median(ordenados: number[]): number {
  const n = ordenados.length;
  if (n === 0) return 0;
  const meio = Math.floor(n / 2);
  if (n % 2 === 1) return ordenados[meio];
  return (ordenados[meio - 1] + ordenados[meio]) / 2;
}

export function stdev(valores: number[]): number {
  const n = valores.length;
  if (n <= 1) return 0;
  const media = fmean(valores);
  const somaQuad = valores.reduce((acc, v) => acc + (v - media) ** 2, 0);
  return Math.sqrt(somaQuad / (n - 1));
}

export function percentil(ordenados: number[], p: number): number | null {
  if (ordenados.length === 0) return null;
  const pos = ((ordenados.length - 1) * p) / 100;
  const i = Math.floor(pos);
  const frac = pos - i;
  if (i + 1 < ordenados.length) {
    return ordenados[i] + (ordenados[i + 1] - ordenados[i]) * frac;
  }
  return ordenados[i];
}

export function estatisticas(valores: number[]): EstatisticasBasicas {
  const v = [...valores].sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) {
    return {
      n: 0,
      media: null,
      mediana: null,
      desvio: null,
      p95: null,
      minimo: null,
      maximo: null,
    };
  }
  return {
    n,
    media: roundOrNull(fmean(v)),
    mediana: roundOrNull(median(v)),
    desvio: roundOrNull(n > 1 ? stdev(v) : 0),
    p95: roundOrNull(percentil(v, 95)),
    minimo: v[0],
    maximo: v[n - 1],
  };
}

export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return null;
  const mx = fmean(xs);
  const my = fmean(ys);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  if (denom === 0) return null;
  return num / denom;
}

export function resultadoEfetivoVisita(
  v: VisitaEtapaRecord,
  agora: Date,
  timeoutS: number = REGRAS_ESTATISTICAS_PADRAO.timeoutAbandonoS,
): string {
  if (v.resultado === 'em_andamento') {
    const diffS = (agora.getTime() - v.atualizadaEm.getTime()) / 1000;
    return diffS > timeoutS ? 'abandonou' : 'em_andamento';
  }
  return v.resultado;
}

export function dividirBaselineJanela(
  atendimentos: AtendimentoRecord[],
  janela: number,
): { idsBase: Set<number>; idsJanela: Set<number> } {
  const ordenados = [...atendimentos].sort(
    (a, b) => a.iniciadoEm.getTime() - b.iniciadoEm.getTime() || a.id - b.id,
  );
  const nJanela = Math.max(0, Math.min(janela, ordenados.length));
  const corte = ordenados.length - nJanela;
  return {
    idsBase: new Set(ordenados.slice(0, corte).map((a) => a.id)),
    idsJanela: new Set(ordenados.slice(corte).map((a) => a.id)),
  };
}

export function avaliarAnomalia(
  base: number[],
  atual: number[],
  k: number = REGRAS_ESTATISTICAS_PADRAO.kDesvios,
  minBaseline: number = REGRAS_ESTATISTICAS_PADRAO.minBaseline,
  minJanela: number = REGRAS_ESTATISTICAS_PADRAO.minJanela,
): ResultadoAnomalia {
  if (base.length < Math.max(minBaseline, 2) || atual.length < minJanela) {
    return {
      status: 'dados_insuficientes',
      nHistorico: base.length,
      nJanela: atual.length,
      medianaHistoricaMs: null,
      desvioHistoricoMs: null,
      limiarMs: null,
      mediaJanelaMs: null,
      desviosAcimaMediana: null,
      explicacao: `Amostra insuficiente para comparação (histórico: ${base.length}/${minBaseline}, janela: ${atual.length}/${minJanela}).`,
    };
  }

  const baseOrd = [...base].sort((a, b) => a - b);
  const med = median(baseOrd);
  const dp = Math.max(stdev(baseOrd), 1.0); // piso de 1 ms evita limiar degenerado
  const media = fmean(atual);
  const limiar = med + k * dp;
  const desvios = (media - med) / dp;
  const isAnomalia = media > limiar;

  return {
    status: isAnomalia ? 'anomalia' : 'normal',
    nHistorico: base.length,
    nJanela: atual.length,
    medianaHistoricaMs: roundOrNull(med),
    desvioHistoricoMs: roundOrNull(dp),
    limiarMs: roundOrNull(limiar),
    mediaJanelaMs: roundOrNull(media),
    desviosAcimaMediana: roundOrNull(desvios, 2),
    explicacao: isAnomalia
      ? `Possível gargalo operacional: a média da janela recente (${Math.round(media)} ms) superou o limiar estatístico de ${Math.round(limiar)} ms (mediana histórica + ${k}σ, desvio de ${roundOrNull(desvios, 2)}σ). Requer interpretação gerencial no balcão.`
      : `Desempenho dentro do padrão histórico esperado (média recente ${Math.round(media)} ms <= limiar ${Math.round(limiar)} ms).`,
  };
}

export function relacaoTempoAbandono(
  pares: Array<{ tempoMs: number; abandonou: boolean }>,
): RelacaoTempoAbandono {
  const n = pares.length;
  if (n < 8) {
    return { n, pearsonR: null, quartis: [] };
  }

  const xs = pares.map((p) => p.tempoMs);
  const ys = pares.map((p) => (p.abandonou ? 1 : 0));
  const r = pearsonCorrelation(xs, ys);

  const ordenados = [...pares].sort((a, b) => a.tempoMs - b.tempoMs);
  const cortes = [0, 1, 2, 3, 4].map((i) => Math.round((i * n) / 4));
  const quartis: QuartilTempoAbandono[] = [];

  for (let q = 0; q < 4; q++) {
    const fatia = ordenados.slice(cortes[q], cortes[q + 1]);
    if (fatia.length === 0) continue;
    const abandonos = fatia.filter((f) => f.abandonou).length;
    quartis.push({
      faixa: `Q${q + 1}`,
      deMs: roundOrNull(fatia[0].tempoMs),
      ateMs: roundOrNull(fatia[fatia.length - 1].tempoMs),
      n: fatia.length,
      abandonos,
      taxaAbandono: roundOrNull(abandonos / fatia.length, 3),
    });
  }

  return {
    n,
    pearsonR: roundOrNull(r, 3),
    quartis,
  };
}

export function resumoOverhead(
  visitas: VisitaEtapaRecord[],
  limiteMs: number = REGRAS_ESTATISTICAS_PADRAO.limiteOverheadMs,
) {
  const valores = visitas
    .map((v) => v.overheadMs)
    .filter((v): v is number => v !== null && v !== undefined)
    .sort((a, b) => a - b);

  if (valores.length === 0) {
    return {
      n: 0,
      mediaMs: null,
      p95Ms: null,
      maximoMs: null,
      limiteMs,
      atende: null as boolean | null,
    };
  }

  const p95 = percentil(valores, 95);
  return {
    n: valores.length,
    mediaMs: roundOrNull(fmean(valores), 2),
    p95Ms: roundOrNull(p95, 2),
    maximoMs: roundOrNull(valores[valores.length - 1], 2),
    limiteMs,
    atende: p95 !== null ? p95 < limiteMs : null,
  };
}

export interface ParametrosAnalise {
  janela?: number;
  k?: number;
  minBaseline?: number;
  minJanela?: number;
  timeoutS?: number;
  agora?: Date;
}

export function analisarFunilCompleto(
  atendimentos: AtendimentoRecord[],
  visitas: VisitaEtapaRecord[],
  etapas: EtapaRecord[],
  params: ParametrosAnalise = {},
) {
  const agora = params.agora ?? new Date();
  const janela = params.janela ?? REGRAS_ESTATISTICAS_PADRAO.janelaPadrao;
  const k = params.k ?? REGRAS_ESTATISTICAS_PADRAO.kDesvios;
  const minBaseline = params.minBaseline ?? REGRAS_ESTATISTICAS_PADRAO.minBaseline;
  const minJanela = params.minJanela ?? REGRAS_ESTATISTICAS_PADRAO.minJanela;
  const timeoutS = params.timeoutS ?? REGRAS_ESTATISTICAS_PADRAO.timeoutAbandonoS;

  const { idsBase, idsJanela } = dividirBaselineJanela(atendimentos, janela);
  const visitasComEfetivo = visitas.map((v) => ({
    visita: v,
    efetivo: resultadoEfetivoVisita(v, agora, timeoutS),
  }));

  const etapasOrdenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  let entradasPrimeira: number | null = null;
  const funil: EtapaFunilAnalise[] = [];

  for (const etapa of etapasOrdenadas) {
    const daEtapa = visitasComEfetivo.filter((item) => item.visita.etapaSlug === etapa.slug);
    const porAtendimento = new Map<number, string[]>();
    for (const item of daEtapa) {
      const lista = porAtendimento.get(item.visita.atendimentoId) ?? [];
      lista.push(item.efetivo);
      porAtendimento.set(item.visita.atendimentoId, lista);
    }

    let avancaram = 0;
    let abandonos = 0;
    let emAndamento = 0;
    for (const efs of porAtendimento.values()) {
      if (efs.some((e) => AVANCOS.has(e))) avancaram++;
      else if (efs.includes('abandonou')) abandonos++;
      else emAndamento++;
    }

    const entradas = porAtendimento.size;
    if (entradasPrimeira === null) entradasPrimeira = entradas;
    const decididas = avancaram + abandonos;

    const finalizadas = daEtapa
      .filter((item) => FINAIS.has(item.efetivo))
      .map((item) => item.visita);

    const base = finalizadas
      .filter((v) => idsBase.has(v.atendimentoId))
      .map((v) => v.tempoAtivoMs);
    const atual = finalizadas
      .filter((v) => idsJanela.has(v.atendimentoId))
      .map((v) => v.tempoAtivoMs);

    const pares = daEtapa
      .filter((item) => FINAIS.has(item.efetivo))
      .map((item) => ({
        tempoMs: item.visita.tempoAtivoMs,
        abandonou: item.efetivo === 'abandonou',
      }));

    funil.push({
      ordem: etapa.ordem,
      slug: etapa.slug,
      nome: etapa.nome,
      entradas,
      avancaram,
      abandonos,
      emAndamento,
      taxaContinuidade: decididas > 0 ? roundOrNull(avancaram / decididas, 4) : null,
      taxaAbandono: decididas > 0 ? roundOrNull(abandonos / decididas, 4) : null,
      conversaoAcumulada:
        entradasPrimeira && entradasPrimeira > 0
          ? roundOrNull(entradas / entradasPrimeira, 4)
          : null,
      tempoAtivo: estatisticas(finalizadas.map((v) => v.tempoAtivoMs)),
      tempoPausaMedioMs:
        finalizadas.length > 0
          ? roundOrNull(fmean(finalizadas.map((v) => v.tempoPausaMs)))
          : null,
      tempoEsperaOficinaMedioMs:
        finalizadas.length > 0
          ? roundOrNull(fmean(finalizadas.map((v) => v.tempoEsperaOficinaMs)))
          : null,
      tempoOciosoMedioMs:
        finalizadas.length > 0
          ? roundOrNull(fmean(finalizadas.map((v) => v.tempoOciosoMs)))
          : null,
      anomalia: avaliarAnomalia(base, atual, k, minBaseline, minJanela),
      relacaoTempoAbandono: relacaoTempoAbandono(pares),
    });
  }

  // Resumo geral dos atendimentos
  const totalAtendimentos = atendimentos.length;
  const convertidos = atendimentos.filter((a) => a.desfechoCodigo === 'convertido').length;
  const desistencias = atendimentos.filter(
    (a) => a.desfechoCodigo === 'desistiu' || a.status === 'abandonado',
  ).length;
  const naoConvertidos = atendimentos.filter(
    (a) => a.desfechoCodigo && a.desfechoCodigo !== 'convertido',
  ).length;
  const emAndamento = atendimentos.filter(
    (a) => a.status === 'em_andamento' || a.status === 'em_pausa' || a.status === 'aguardando_oficina',
  ).length;
  const encerrados = totalAtendimentos - emAndamento;

  // Atendimentos com tempo total atípico (> mediana + k * desvio dos atendimentos encerrados)
  const temposAtivosTotais = atendimentos
    .filter((a) => a.tempoAtivoMs > 0)
    .map((a) => a.tempoAtivoMs);
  const statsTotal = estatisticas(temposAtivosTotais);
  const limiarAtipico =
    statsTotal.mediana !== null && statsTotal.desvio !== null
      ? statsTotal.mediana + k * Math.max(statsTotal.desvio, 1)
      : null;
  const atendimentosAtipicos =
    limiarAtipico !== null
      ? atendimentos.filter((a) => a.tempoAtivoMs > limiarAtipico).length
      : 0;

  // Tempo x Desfecho
  const porDesfecho = new Map<string, AtendimentoRecord[]>();
  for (const a of atendimentos) {
    const key = a.desfechoCodigo ?? a.status;
    const list = porDesfecho.get(key) ?? [];
    list.push(a);
    porDesfecho.set(key, list);
  }
  const tempoDesfecho = Array.from(porDesfecho.entries()).map(([codigo, lista]) => ({
    desfecho: codigo,
    quantidade: lista.length,
    tempoTotal: estatisticas(lista.map((a) => a.tempoTotalMs)),
    tempoAtivo: estatisticas(lista.map((a) => a.tempoAtivoMs)),
    tempoEsperaOficinaMedioMs: roundOrNull(fmean(lista.map((a) => a.tempoEsperaOficinaMs))),
    tempoPausaMedioMs: roundOrNull(fmean(lista.map((a) => a.tempoPausaMs))),
  }));

  // Motivos de desistência
  const motivosMap = new Map<string, number>();
  for (const a of atendimentos) {
    if (a.motivoDesistenciaCodigo) {
      motivosMap.set(
        a.motivoDesistenciaCodigo,
        (motivosMap.get(a.motivoDesistenciaCodigo) ?? 0) + 1,
      );
    }
  }
  const motivosAbandono = Array.from(motivosMap.entries())
    .map(([codigo, quantidade]) => ({
      codigo,
      quantidade,
      percentual:
        naoConvertidos > 0 ? roundOrNull((quantidade / naoConvertidos) * 100, 1) : 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const alertas = funil
    .filter((e) => e.anomalia.status === 'anomalia')
    .map((e) => ({
      ordem: e.ordem,
      slug: e.slug,
      nome: e.nome,
      ...e.anomalia,
    }));

  return {
    atualizadoEm: agora.toISOString(),
    parametros: { janela, k, minBaseline, minJanela },
    janela: {
      sessoesJanela: idsJanela.size,
      sessoesHistorico: idsBase.size,
    },
    resumo: {
      totalAtendimentos,
      convertidos,
      naoConvertidos,
      desistencias,
      emAndamento,
      taxaConversao: encerrados > 0 ? roundOrNull(convertidos / encerrados, 4) : null,
      taxaAbandono: encerrados > 0 ? roundOrNull(desistencias / encerrados, 4) : null,
      tempoMedioAtendimentoMs: statsTotal.media,
      medianaAtendimentoMs: statsTotal.mediana,
      desvioAtendimentoMs: statsTotal.desvio,
      tempoMedioEsperaOficinaMs:
        atendimentos.length > 0
          ? roundOrNull(fmean(atendimentos.map((a) => a.tempoEsperaOficinaMs)))
          : null,
      tempoMedioPausaMs:
        atendimentos.length > 0
          ? roundOrNull(fmean(atendimentos.map((a) => a.tempoPausaMs)))
          : null,
      atendimentosAtipicos,
    },
    funil,
    alertas,
    tempoDesfecho,
    motivosAbandono,
    overhead: resumoOverhead(visitas),
  };
}
