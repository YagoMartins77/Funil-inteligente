import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { MemoryFunilRepository } from '../src/database/memoryRepository';

describe('API FASTCAR v1 — Cenários CT-01 a CT-13', () => {
  let repo: MemoryFunilRepository;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    repo = new MemoryFunilRepository();
    app = createApp(repo);
  });

  it('CT-01: Atendimento real completo em 5 etapas com desfecho convertido', async () => {
    const inicio = await request(app).post('/api/v1/atendimentos').send({
      uuidExterno: 'ct01-uuid-1',
      dispositivo: 'tablet',
      sintetica: false,
    });
    expect(inicio.status).toBe(201);
    const atendimentoId = inicio.body.id;

    const etapas = ['acolhimento', 'diagnostico', 'cotacao', 'apresentacao', 'fechamento'];
    for (let i = 0; i < etapas.length; i++) {
      const ordem = i + 1;
      const resp = await request(app)
        .post('/api/v1/telemetria/visitas')
        .send({
          visitaId: `ct01-v-${ordem}`,
          atendimentoId,
          etapa: etapas[i],
          ordem,
          tempoTotalMs: 10000,
          tempoAtivoMs: 9500,
          tempoOciosoMs: 500,
          resultado: ordem === 5 ? 'concluiu' : 'avancou',
          overheadMs: 3.2,
        });
      expect(resp.status).toBe(202);
    }

    const desfecho = await request(app)
      .post(`/api/v1/atendimentos/${atendimentoId}/desfecho`)
      .send({ desfechoCodigo: 'convertido', etapaOrdem: 5 });
    expect(desfecho.status).toBe(200);
    expect(desfecho.body.status).toBe('finalizado');
    expect(desfecho.body.desfechoCodigo).toBe('convertido');

    const detalhes = await request(app).get(`/api/v1/atendimentos/${atendimentoId}`);
    expect(detalhes.status).toBe(200);
    expect(detalhes.body.visitas).toHaveLength(5);
    expect(detalhes.body.tempoAtivoMs).toBe(47500);
  });

  it('CT-02 & CT-03: Pausa operacional e Espera técnica da oficina contabilizadas separadamente', async () => {
    const inicio = await request(app).post('/api/v1/atendimentos').send({
      uuidExterno: 'ct02-uuid-1',
      dispositivo: 'tablet',
    });
    const id = inicio.body.id;

    // Pausa operacional
    const pIni = await request(app)
      .post(`/api/v1/atendimentos/${id}/pausas/iniciar`)
      .send({
        intervaloId: 'pausa-1',
        etapaOrdem: 2,
        motivoCodigo: 'busca_fisica_estoque',
        iniciadaEm: '2026-11-12T10:00:00.000Z',
      });
    expect(pIni.status).toBe(201);

    // Impede iniciar espera da oficina enquanto há pausa aberta
    const conflito = await request(app)
      .post(`/api/v1/atendimentos/${id}/espera-oficina/iniciar`)
      .send({
        intervaloId: 'espera-1',
        etapaOrdem: 2,
        motivoCodigo: 'compatibilidade_eletrica',
      });
    expect(conflito.status).toBe(409);

    const pFim = await request(app)
      .post(`/api/v1/atendimentos/${id}/pausas/finalizar`)
      .send({
        intervaloId: 'pausa-1',
        finalizadaEm: '2026-11-12T10:00:15.000Z',
      });
    expect(pFim.status).toBe(200);
    expect(pFim.body.duracaoMs).toBe(15000);

    // Espera técnica da oficina
    const eIni = await request(app)
      .post(`/api/v1/atendimentos/${id}/espera-oficina/iniciar`)
      .send({
        intervaloId: 'espera-1',
        etapaOrdem: 2,
        motivoCodigo: 'compatibilidade_eletrica',
        iniciadaEm: '2026-11-12T10:01:00.000Z',
      });
    expect(eIni.status).toBe(201);

    const eFim = await request(app)
      .post(`/api/v1/atendimentos/${id}/espera-oficina/finalizar`)
      .send({
        intervaloId: 'espera-1',
        finalizadaEm: '2026-11-12T10:01:45.000Z',
      });
    expect(eFim.status).toBe(200);
    expect(eFim.body.duracaoMs).toBe(45000);

    const intervalos = await request(app).get(`/api/v1/atendimentos/${id}/intervalos`);
    expect(intervalos.status).toBe(200);
    expect(intervalos.body.pausas).toHaveLength(1);
    expect(intervalos.body.esperasOficina).toHaveLength(1);

    const atend = await request(app).get(`/api/v1/atendimentos/${id}`);
    expect(atend.body.tempoPausaMs).toBe(15000);
    expect(atend.body.tempoEsperaOficinaMs).toBe(45000);
  });

  it('CT-04 & CT-05: Desistência exige motivo fechado e sessão interrompida marca abandonado', async () => {
    const a1 = await request(app).post('/api/v1/atendimentos').send({ uuidExterno: 'ct04-a1' });
    const id1 = a1.body.id;

    // Sem motivo -> 422
    const semMotivo = await request(app)
      .post(`/api/v1/atendimentos/${id1}/desfecho`)
      .send({ desfechoCodigo: 'desistiu' });
    expect(semMotivo.status).toBe(422);

    const comMotivo = await request(app)
      .post(`/api/v1/atendimentos/${id1}/desfecho`)
      .send({
        desfechoCodigo: 'desistiu',
        motivoDesistenciaCodigo: 'preco_acima_esperado',
        etapaOrdem: 4,
      });
    expect(comMotivo.status).toBe(200);
    expect(comMotivo.body.motivoDesistenciaCodigo).toBe('preco_acima_esperado');

    // CT-05: Interrompido
    const a2 = await request(app).post('/api/v1/atendimentos').send({ uuidExterno: 'ct05-a2' });
    const id2 = a2.body.id;
    const interr = await request(app)
      .post(`/api/v1/atendimentos/${id2}/desfecho`)
      .send({
        desfechoCodigo: 'interrompido',
        motivoDesistenciaCodigo: 'cliente_saiu_sem_retorno',
        etapaOrdem: 2,
      });
    expect(interr.status).toBe(200);
    expect(interr.body.status).toBe('abandonado');
  });

  it('CT-06: Idempotência de visitas, eventos e suporte a sendBeacon text/plain', async () => {
    const inicio = await request(app).post('/api/v1/atendimentos').send({ uuidExterno: 'ct06-1' });
    const id = inicio.body.id;

    const visitaPayload = {
      visitaId: 'visita-idem-1',
      atendimentoId: id,
      etapa: 'acolhimento',
      ordem: 1,
      tempoTotalMs: 5000,
      tempoAtivoMs: 5000,
      resultado: 'avancou',
    };

    // Envia 2 vezes (a segunda via text/plain simulando navigator.sendBeacon)
    await request(app).post('/api/v1/telemetria/visitas').send(visitaPayload);
    const second = await request(app)
      .post('/api/v1/telemetria/visitas')
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify(visitaPayload));
    expect(second.status).toBe(202);

    const visitas = await request(app).get(`/api/v1/atendimentos/${id}/etapas`);
    expect(visitas.body).toHaveLength(1);

    const evPayload = {
      eventoId: 'ev-idem-1',
      atendimentoId: id,
      tipo: 'etapa_iniciada',
      etapaOrdem: 1,
    };
    const ev1 = await request(app).post('/api/v1/telemetria/eventos').send(evPayload);
    const ev2 = await request(app).post('/api/v1/telemetria/eventos').send(evPayload);
    expect(ev1.body.duplicado).toBe(false);
    expect(ev2.body.duplicado).toBe(true);
  });

  it('CT-07: LGPD — Rejeita campos extras / PII com HTTP 422', async () => {
    const resp1 = await request(app).post('/api/v1/atendimentos').send({
      uuidExterno: 'ct07-1',
      nomeCliente: 'João Silva',
      cpf: '123.456.789-00',
    });
    expect(resp1.status).toBe(422);

    const inicio = await request(app).post('/api/v1/atendimentos').send({ uuidExterno: 'ct07-ok' });
    const resp2 = await request(app).post('/api/v1/telemetria/visitas').send({
      visitaId: 'v-lgpd',
      atendimentoId: inicio.body.id,
      etapa: 'acolhimento',
      ordem: 1,
      telefone: '14999999999',
    });
    expect(resp2.status).toBe(422);
  });

  it('CT-08 a CT-13: Simulação de 100 sessões, detecção de anomalia, segregação, limpeza e CSV', async () => {
    // Cria 1 atendimento real
    const real = await request(app).post('/api/v1/atendimentos').send({
      uuidExterno: 'real-01',
      sintetica: false,
    });
    await request(app).post('/api/v1/telemetria/visitas').send({
      visitaId: 'real-01-v1',
      atendimentoId: real.body.id,
      etapa: 'acolhimento',
      ordem: 1,
      tempoTotalMs: 8000,
      tempoAtivoMs: 8000,
      resultado: 'concluiu',
    });
    await request(app)
      .post(`/api/v1/atendimentos/${real.body.id}/desfecho`)
      .send({ desfechoCodigo: 'convertido' });

    // CT-08 & CT-09: Simula 100 sessões (80 regulares + 20 anômalas na etapa 3)
    const sim = await request(app).post('/api/v1/admin/simular').send({
      regulares: 80,
      anomalas: 20,
      etapaAnomalia: 3,
      semente: 42,
      limparAntes: true,
    });
    expect(sim.status).toBe(201);
    expect(sim.body.execucao.totalSessoes).toBe(100);
    expect(sim.body.comparacao.etapasDetectadas).toContain(3);
    expect(sim.body.comparacao.precisao).toBe(1);
    expect(sim.body.comparacao.revocacao).toBe(1);
    expect(sim.body.comparacao.falsosPositivos).toBe(0);

    // CT-10: Segregação — dados reais não incluem os 100 sintéticos
    const funilReal = await request(app).get('/api/v1/analytics/funil?sinteticas=false');
    expect(funilReal.status).toBe(200);
    expect(funilReal.body.resumo.totalAtendimentos).toBe(1);

    const funilSint = await request(app).get('/api/v1/analytics/funil?sinteticas=true');
    expect(funilSint.status).toBe(200);
    expect(funilSint.body.resumo.totalAtendimentos).toBe(100);

    // CT-12: Exportação CSV respeitando segregação
    const csvReal = await request(app).get('/api/v1/analytics/exportar.csv?sinteticas=false');
    expect(csvReal.status).toBe(200);
    expect(csvReal.text.split('\n')).toHaveLength(2); // header + 1 visita real

    // CT-11: Limpar sintéticos não apaga dados reais
    const delSint = await request(app).delete('/api/v1/admin/dados?escopo=sinteticos');
    expect(delSint.status).toBe(200);
    expect(delSint.body.atendimentosRemovidos).toBe(100);

    const funilRealApos = await request(app).get('/api/v1/analytics/funil?sinteticas=false');
    expect(funilRealApos.body.resumo.totalAtendimentos).toBe(1);

    // Tentativa de apagar tudo sem confirmação deve ser bloqueada (403)
    const delTudoSemConfirm = await request(app).delete('/api/v1/admin/dados?escopo=tudo');
    expect(delTudoSemConfirm.status).toBe(403);
  });
});
