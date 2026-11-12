import {
  MOTIVOS_DESISTENCIA_FASTCAR,
  MOTIVOS_ESPERA_OFICINA,
  MOTIVOS_PAUSA_OPERACIONAL,
} from '../../config/constants';
import {
  AtendimentoRecord,
  EsperaOficinaRecord,
  IFunilRepository,
  PausaOperacionalRecord,
  VisitaEtapaRecord,
} from '../../database/types';
import { analisarFunilCompleto } from '../analytics/analyticsEngine';

function createRng(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export interface ParametrosSimulacao {
  regulares: number;
  anomalas: number;
  etapaAnomalia: number;
  semente: number;
  limparAntes: boolean;
  janela?: number;
  k?: number;
}

export async function executarSimulacao(repo: IFunilRepository, params: ParametrosSimulacao) {
  const { regulares, anomalas, etapaAnomalia, semente, limparAntes } = params;
  const total = regulares + anomalas;

  if (limparAntes) {
    await repo.limparDadosSinteticos();
  }

  const [etapas, cfg] = await Promise.all([
    repo.listarEtapas(),
    repo.obterConfiguracaoEstatistica(),
  ]);
  const etapasOrdenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const rng = createRng(semente);
  const agora = new Date();
  const baseTempo = agora.getTime() - total * 90_000;

  const sessoesParaInserir: Array<{
    atendimento: Omit<AtendimentoRecord, 'id'>;
    visitas: Array<Omit<VisitaEtapaRecord, 'id' | 'atendimentoId'>>;
    pausas: Array<Omit<PausaOperacionalRecord, 'id' | 'atendimentoId'>>;
    esperas: Array<Omit<EsperaOficinaRecord, 'id' | 'atendimentoId'>>;
  }> = [];

  for (let idx = 0; idx < total; idx++) {
    const isAnomala = idx >= regulares;
    const inicioSessaoMs = baseTempo + idx * 90_000;
    const uuidExterno = `sim-${semente}-${Date.now()}-${idx + 1}`;

    // Determina desfecho
    const rDesfecho = rng();
    let desfechoCodigo: string | null = 'convertido';
    let motivoDesistenciaCodigo: string | null = null;
    let etapaAbandono = 5;

    if (rDesfecho < 0.25) {
      desfechoCodigo = 'desistiu';
      motivoDesistenciaCodigo =
        MOTIVOS_DESISTENCIA_FASTCAR[randInt(rng, 0, MOTIVOS_DESISTENCIA_FASTCAR.length - 1)].codigo;
      etapaAbandono = randInt(rng, 2, 5);
    } else if (rDesfecho < 0.35) {
      desfechoCodigo = 'nao_fechou';
      motivoDesistenciaCodigo =
        MOTIVOS_DESISTENCIA_FASTCAR[randInt(rng, 0, MOTIVOS_DESISTENCIA_FASTCAR.length - 1)].codigo;
      etapaAbandono = 5;
    }

    const visitas: Array<Omit<VisitaEtapaRecord, 'id' | 'atendimentoId'>> = [];
    const pausas: Array<Omit<PausaOperacionalRecord, 'id' | 'atendimentoId'>> = [];
    const esperas: Array<Omit<EsperaOficinaRecord, 'id' | 'atendimentoId'>> = [];

    let cursorMs = inicioSessaoMs;
    let somaTotal = 0;
    let somaAtivo = 0;
    let somaPausa = 0;
    let somaEspera = 0;
    let somaOcioso = 0;

    for (const etapa of etapasOrdenadas) {
      if (etapa.ordem > etapaAbandono) break;

      const baseAtivoMs = 15_000 + randInt(rng, 5_000, 25_000);
      const extraAnomaliaMs =
        isAnomala && etapa.ordem === etapaAnomalia ? 95_000 + randInt(rng, 10_000, 45_000) : 0;
      const tempoAtivoMs = baseAtivoMs + extraAnomaliaMs;

      const temPausa = rng() < 0.2;
      const tempoPausaMs = temPausa ? randInt(rng, 4_000, 15_000) : 0;

      const temEspera = etapa.ordem === 2 && rng() < 0.35;
      const tempoEsperaMs = temEspera ? randInt(rng, 8_000, 30_000) : 0;

      const tempoOciosoMs = randInt(rng, 0, 2_500);
      const tempoTotalMs = tempoAtivoMs + tempoPausaMs + tempoEsperaMs + tempoOciosoMs;

      const iniciadaEm = new Date(cursorMs);
      const finalizadaEm = new Date(cursorMs + tempoTotalMs);
      cursorMs += tempoTotalMs;

      if (temPausa) {
        pausas.push({
          pausaId: `${uuidExterno}:pausa:${etapa.ordem}`,
          etapaOrdem: etapa.ordem,
          motivoCodigo:
            MOTIVOS_PAUSA_OPERACIONAL[randInt(rng, 0, MOTIVOS_PAUSA_OPERACIONAL.length - 1)].codigo,
          iniciadaEm: new Date(iniciadaEm.getTime() + 2_000),
          finalizadaEm: new Date(iniciadaEm.getTime() + 2_000 + tempoPausaMs),
          duracaoMs: tempoPausaMs,
          sintetica: true,
        });
      }

      if (temEspera) {
        esperas.push({
          esperaId: `${uuidExterno}:espera:${etapa.ordem}`,
          etapaOrdem: etapa.ordem,
          motivoCodigo:
            MOTIVOS_ESPERA_OFICINA[randInt(rng, 0, MOTIVOS_ESPERA_OFICINA.length - 1)].codigo,
          iniciadaEm: new Date(iniciadaEm.getTime() + 3_000),
          finalizadaEm: new Date(iniciadaEm.getTime() + 3_000 + tempoEsperaMs),
          duracaoMs: tempoEsperaMs,
          sintetica: true,
        });
      }

      let resultado = 'avancou';
      if (etapa.ordem === etapaAbandono) {
        resultado = desfechoCodigo === 'convertido' ? 'concluiu' : 'abandonou';
      }

      visitas.push({
        visitaId: `${uuidExterno}:${etapa.slug}`,
        etapaId: etapa.id,
        etapaSlug: etapa.slug,
        ordem: etapa.ordem,
        iniciadaEm,
        atualizadaEm: finalizadaEm,
        finalizadaEm,
        tempoTotalMs,
        tempoAtivoMs,
        tempoPausaMs,
        tempoEsperaOficinaMs: tempoEsperaMs,
        tempoOciosoMs,
        resultado,
        overheadMs: Number((2 + rng() * 6).toFixed(2)),
        sintetica: true,
      });

      somaTotal += tempoTotalMs;
      somaAtivo += tempoAtivoMs;
      somaPausa += tempoPausaMs;
      somaEspera += tempoEsperaMs;
      somaOcioso += tempoOciosoMs;
    }

    sessoesParaInserir.push({
      atendimento: {
        uuidExterno,
        status: 'finalizado',
        etapaAtualOrdem: etapaAbandono,
        iniciadoEm: new Date(inicioSessaoMs),
        atualizadoEm: new Date(cursorMs),
        finalizadoEm: new Date(cursorMs),
        tempoTotalMs: somaTotal,
        tempoAtivoMs: somaAtivo,
        tempoPausaMs: somaPausa,
        tempoEsperaOficinaMs: somaEspera,
        tempoOciosoMs: somaOcioso,
        desfechoCodigo,
        motivoDesistenciaCodigo,
        dispositivo: 'tablet',
        cenario: `simulacao_etapa_${etapaAnomalia}`,
        sintetica: true,
      },
      visitas,
      pausas,
      esperas,
    });
  }

  await repo.inserirSessoesSinteticas(sessoesParaInserir);

  // Executa o detector estatístico sobre os dados sintéticos
  const { atendimentos, visitas } = await repo.listarVisitasParaAnalytics({ sintetica: true });
  const janela = params.janela ?? Math.max(anomalas, cfg.janelaPadrao);
  const k = params.k ?? cfg.kDesvios;

  const analise = analisarFunilCompleto(atendimentos, visitas, etapas, {
    janela,
    k,
    minBaseline: cfg.minBaseline,
    minJanela: cfg.minJanela,
    timeoutS: cfg.timeoutAbandonoS,
  });

  const esperadas = anomalas > 0 ? new Set([etapaAnomalia]) : new Set<number>();
  const detectadas = new Set(analise.alertas.map((a) => a.ordem));

  let vp = 0;
  let fp = 0;
  for (const d of detectadas) {
    if (esperadas.has(d)) vp++;
    else fp++;
  }
  const fn = Array.from(esperadas).filter((e) => !detectadas.has(e)).length;

  const precisao = detectadas.size > 0 ? Number((vp / (vp + fp)).toFixed(4)) : esperadas.size === 0 ? 1 : 0;
  const revocacao = esperadas.size > 0 ? Number((vp / (vp + fn)).toFixed(4)) : 1;

  const execucao = await repo.registrarExecucaoSimulacao({
    semente,
    totalSessoes: total,
    regulares,
    anomalas,
    etapaAnomalia,
    precisao,
    revocacao,
    falsosPositivos: fp,
    detalhesJson: {
      etapasEsperadas: Array.from(esperadas),
      etapasDetectadas: Array.from(detectadas),
      janelaUtilizada: janela,
      kUtilizado: k,
      resumo: analise.resumo,
      alertas: analise.alertas,
    },
  });

  return {
    ok: true,
    execucao,
    comparacao: {
      etapasEsperadas: Array.from(esperadas),
      etapasDetectadas: Array.from(detectadas),
      verdadeirosPositivos: vp,
      falsosPositivos: fp,
      falsosNegativos: fn,
      precisao,
      revocacao,
    },
    analise,
  };
}
