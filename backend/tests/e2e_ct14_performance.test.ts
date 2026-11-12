import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { MemoryFunilRepository } from '../src/database/memoryRepository';

describe('CT-14: Integração Ponta a Ponta & Performance (RNF01 < 50 ms)', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const repo = new MemoryFunilRepository();
    const app = createApp(repo);
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it('CT-14: Fluxo completo Orçamentador -> API -> Dashboard -> Exportação CSV', async () => {
    // 1. Orçamentador carrega etapas
    const etapasRes = await fetch(`${baseUrl}/etapas`);
    expect(etapasRes.status).toBe(200);
    const etapas = (await etapasRes.json()) as Array<{ ordem: number; slug: string }>;
    expect(etapas).toHaveLength(5);

    // 2. Inicia atendimento real no balcão
    const iniRes = await fetch(`${baseUrl}/atendimentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuidExterno: 'ct14-e2e-1', dispositivo: 'tablet', sintetica: false }),
    });
    expect(iniRes.status).toBe(201);
    const atend = (await iniRes.json()) as { id: number };

    // 3. Percorre as 5 etapas com pausa na etapa 2 e espera da oficina na etapa 3
    for (const et of etapas) {
      if (et.ordem === 2) {
        await fetch(`${baseUrl}/atendimentos/${atend.id}/pausas/iniciar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intervaloId: 'ct14-pausa-1',
            etapaOrdem: 2,
            motivoCodigo: 'busca_fisica_estoque',
          }),
        });
        await fetch(`${baseUrl}/atendimentos/${atend.id}/pausas/finalizar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intervaloId: 'ct14-pausa-1' }),
        });
      }

      if (et.ordem === 3) {
        await fetch(`${baseUrl}/atendimentos/${atend.id}/espera-oficina/iniciar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intervaloId: 'ct14-espera-1',
            etapaOrdem: 3,
            motivoCodigo: 'disponibilidade_box',
          }),
        });
        await fetch(`${baseUrl}/atendimentos/${atend.id}/espera-oficina/finalizar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ intervaloId: 'ct14-espera-1' }),
        });
      }

      const visitaRes = await fetch(`${baseUrl}/telemetria/visitas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitaId: `ct14-v-${et.ordem}`,
          atendimentoId: atend.id,
          etapa: et.slug,
          ordem: et.ordem,
          tempoTotalMs: 12000,
          tempoAtivoMs: 11000,
          tempoOciosoMs: 1000,
          resultado: et.ordem === 5 ? 'concluiu' : 'avancou',
          overheadMs: 1.8,
        }),
      });
      expect(visitaRes.status).toBe(202);
    }

    // 4. Registra desfecho convertido e finaliza
    const desfRes = await fetch(`${baseUrl}/atendimentos/${atend.id}/desfecho`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ desfechoCodigo: 'convertido', etapaOrdem: 5 }),
    });
    expect(desfRes.status).toBe(200);

    // 5. Dashboard consulta analytics real
    const dashRes = await fetch(`${baseUrl}/analytics/funil?sinteticas=false`);
    expect(dashRes.status).toBe(200);
    const dash = (await dashRes.json()) as {
      resumo: { totalAtendimentos: number; convertidos: number; taxaConversao: number };
      funil: Array<{ ordem: number; entradas: number }>;
    };
    expect(dash.resumo.totalAtendimentos).toBe(1);
    expect(dash.resumo.convertidos).toBe(1);
    expect(dash.resumo.taxaConversao).toBe(1);
    expect(dash.funil).toHaveLength(5);
    expect(dash.funil.every((e) => e.entradas === 1)).toBe(true);

    // 6. Exporta CSV
    const csvRes = await fetch(`${baseUrl}/analytics/exportar.csv?sinteticas=false`);
    expect(csvRes.status).toBe(200);
    const csv = await csvRes.text();
    expect(csv.split('\n')).toHaveLength(6); // header + 5 etapas
  });

  it('RNF01: Overhead de telemetria (serialização + ingestão) inferior a 50 ms', async () => {
    const iniRes = await fetch(`${baseUrl}/atendimentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuidExterno: 'rnf01-perf', dispositivo: 'tablet' }),
    });
    const atend = (await iniRes.json()) as { id: number };

    const tempos: number[] = [];
    for (let i = 0; i < 20; i++) {
      const t0 = performance.now();
      const resp = await fetch(`${baseUrl}/telemetria/visitas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitaId: `rnf01-v-${i}`,
          atendimentoId: atend.id,
          etapa: 'acolhimento',
          ordem: 1,
          tempoTotalMs: 5000,
          tempoAtivoMs: 5000,
          resultado: 'avancou',
          overheadMs: 1.5,
        }),
      });
      const dt = performance.now() - t0;
      expect(resp.status).toBe(202);
      tempos.push(dt);
    }

    tempos.sort((a, b) => a - b);
    const p95 = tempos[Math.floor(tempos.length * 0.95)];
    expect(p95).toBeLessThan(50);
  });
});
