import { describe, expect, it } from 'vitest';
import {
  avaliarAnomalia,
  estatisticas,
  pearsonCorrelation,
  percentil,
  relacaoTempoAbandono,
  resumoOverhead,
} from '../src/modules/analytics/analyticsEngine';
import { VisitaEtapaRecord } from '../src/database/types';

describe('Motor Estatístico (analyticsEngine)', () => {
  it('calcula estatísticas descritivas básicas corretamente', () => {
    const res = estatisticas([100, 200, 300, 400, 500]);
    expect(res.n).toBe(5);
    expect(res.media).toBe(300);
    expect(res.mediana).toBe(300);
    expect(res.minimo).toBe(100);
    expect(res.maximo).toBe(500);
    expect(res.p95).toBe(480);
    expect(res.desvio).toBeCloseTo(158.1, 1);
  });

  it('retorna dados_insuficientes quando histórico ou janela são menores que o mínimo', () => {
    const res = avaliarAnomalia([100, 110, 120], [500, 520, 540], 2.0, 10, 3);
    expect(res.status).toBe('dados_insuficientes');
    expect(res.nHistorico).toBe(3);
  });

  it('detecta anomalia quando média da janela > mediana histórica + k * desvio-padrão', () => {
    const base = [1000, 1050, 980, 1020, 990, 1010, 1030, 970, 1005, 995];
    const atual = [1800, 1950, 2100];
    const res = avaliarAnomalia(base, atual, 2.0, 10, 3);
    expect(res.status).toBe('anomalia');
    expect(res.desviosAcimaMediana).toBeGreaterThan(2.0);
    expect(res.explicacao).toContain('Possível gargalo operacional');
  });

  it('classifica como normal quando média da janela está dentro do limiar', () => {
    const base = [1000, 1100, 900, 1050, 950, 1020, 980, 1010, 990, 1000];
    const atual = [1010, 1030, 990];
    const res = avaliarAnomalia(base, atual, 2.0, 10, 3);
    expect(res.status).toBe('normal');
  });

  it('calcula percentil e correlação de Pearson corretamente', () => {
    expect(percentil([10, 20, 30, 40], 50)).toBe(25);
    const r = pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8]);
    expect(r).toBeCloseTo(1.0, 4);

    const rel = relacaoTempoAbandono([
      { tempoMs: 100, abandonou: false },
      { tempoMs: 200, abandonou: false },
      { tempoMs: 300, abandonou: false },
      { tempoMs: 400, abandonou: false },
      { tempoMs: 500, abandonou: true },
      { tempoMs: 600, abandonou: true },
      { tempoMs: 700, abandonou: true },
      { tempoMs: 800, abandonou: true },
    ]);
    expect(rel.n).toBe(8);
    expect(rel.quartis).toHaveLength(4);
    expect(rel.pearsonR).toBeGreaterThan(0.5);
  });

  it('avalia RNF01 (overhead p95 < 50 ms)', () => {
    const visitas = [2.1, 3.4, 4.0, 5.2, 8.1].map(
      (overheadMs, idx): VisitaEtapaRecord => ({
        id: idx + 1,
        visitaId: `v-${idx}`,
        atendimentoId: 1,
        etapaId: 1,
        etapaSlug: 'acolhimento',
        ordem: 1,
        iniciadaEm: new Date(),
        atualizadaEm: new Date(),
        finalizadaEm: new Date(),
        tempoTotalMs: 1000,
        tempoAtivoMs: 1000,
        tempoPausaMs: 0,
        tempoEsperaOficinaMs: 0,
        tempoOciosoMs: 0,
        resultado: 'avancou',
        overheadMs,
        sintetica: false,
      }),
    );
    const oh = resumoOverhead(visitas, 50);
    expect(oh.atende).toBe(true);
    expect(oh.p95Ms).toBeLessThan(50);
  });
});
