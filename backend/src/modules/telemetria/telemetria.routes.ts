import { Router } from 'express';
import { z } from 'zod';
import { IFunilRepository } from '../../database/types';
import { asyncHandler } from '../../shared/asyncHandler';
import { NotFoundError, ValidationError } from '../../shared/errors';

export const VisitaTelemetriaInSchema = z
  .object({
    visitaId: z.string().min(3).max(120),
    atendimentoId: z.number().int().positive().optional(),
    uuidExterno: z.string().min(4).max(120).optional(),
    etapa: z.enum(['acolhimento', 'diagnostico', 'cotacao', 'apresentacao', 'fechamento']),
    ordem: z.number().int().min(1).max(5),
    iniciadaEm: z.coerce.date().optional(),
    atualizadaEm: z.coerce.date().optional(),
    finalizadaEm: z.coerce.date().nullable().optional(),
    tempoTotalMs: z.number().int().min(0).default(0),
    tempoAtivoMs: z.number().int().min(0).default(0),
    tempoPausaMs: z.number().int().min(0).default(0),
    tempoEsperaOficinaMs: z.number().int().min(0).default(0),
    tempoOciosoMs: z.number().int().min(0).default(0),
    resultado: z
      .enum(['em_andamento', 'avancou', 'retornou', 'concluiu', 'abandonou'])
      .default('em_andamento'),
    overheadMs: z.number().min(0).max(60000).nullable().optional(),
    dispositivo: z.enum(['tablet', 'desktop', 'mobile']).default('tablet'),
    cenario: z.string().max(80).nullable().optional(),
    sintetica: z.boolean().default(false),
  })
  .strict();

export const PayloadEventoSeguroSchema = z
  .object({
    etapaOrigem: z.number().int().min(1).max(5).optional(),
    etapaDestino: z.number().int().min(1).max(5).optional(),
    motivoCodigo: z.string().max(60).optional(),
    duracaoMs: z.number().int().min(0).optional(),
    overheadMs: z.number().min(0).max(60000).optional(),
    visivel: z.boolean().optional(),
  })
  .strict();

export const EventoTelemetriaInSchema = z
  .object({
    eventoId: z.string().min(3).max(120),
    atendimentoId: z.number().int().positive(),
    tipo: z.enum([
      'etapa_iniciada',
      'etapa_avancada',
      'etapa_retornada',
      'pausa_iniciada',
      'pausa_finalizada',
      'espera_oficina_iniciada',
      'espera_oficina_finalizada',
      'aba_oculta',
      'aba_visivel',
      'desfecho_registrado',
      'sessao_recuperada',
    ]),
    etapaOrdem: z.number().int().min(1).max(5),
    ocorridoEm: z.coerce.date().optional(),
    payloadSeguro: PayloadEventoSeguroSchema.nullable().optional(),
    sintetica: z.boolean().default(false),
  })
  .strict();

export function createTelemetriaRouter(repo: IFunilRepository): Router {
  const router = Router();

  router.post(
    '/visitas',
    asyncHandler(async (req, res) => {
      const dados = VisitaTelemetriaInSchema.parse(req.body);
      const etapa = await repo.obterEtapaPorSlug(dados.etapa);
      if (!etapa || etapa.ordem !== dados.ordem) {
        throw new ValidationError('Etapa ou ordem incompatível com o fluxo FASTCAR de 5 etapas.');
      }

      let atendimento = dados.atendimentoId
        ? await repo.obterAtendimentoPorId(dados.atendimentoId)
        : dados.uuidExterno
          ? await repo.obterAtendimentoPorUuid(dados.uuidExterno)
          : null;

      if (!atendimento && dados.uuidExterno) {
        atendimento = await repo.criarAtendimento({
          uuidExterno: dados.uuidExterno,
          dispositivo: dados.dispositivo,
          cenario: dados.cenario ?? null,
          sintetica: dados.sintetica,
          iniciadoEm: dados.iniciadaEm,
        });
      }

      if (!atendimento) {
        throw new NotFoundError('Atendimento não encontrado para registrar visita.');
      }

      const agora = new Date();
      const visita = await repo.upsertVisitaEtapa({
        visitaId: dados.visitaId,
        atendimentoId: atendimento.id,
        etapaId: etapa.id,
        etapaSlug: etapa.slug,
        ordem: dados.ordem,
        iniciadaEm: dados.iniciadaEm ?? agora,
        atualizadaEm: dados.atualizadaEm ?? agora,
        finalizadaEm: dados.finalizadaEm ?? null,
        tempoTotalMs: dados.tempoTotalMs,
        tempoAtivoMs: dados.tempoAtivoMs,
        tempoPausaMs: dados.tempoPausaMs,
        tempoEsperaOficinaMs: dados.tempoEsperaOficinaMs,
        tempoOciosoMs: dados.tempoOciosoMs,
        resultado: dados.resultado,
        overheadMs: dados.overheadMs ?? null,
        sintetica: atendimento.sintetica,
      });

      // Atualiza agregados do atendimento a partir das visitas registradas
      const todasVisitas = await repo.listarVisitasPorAtendimento(atendimento.id);
      const totais = todasVisitas.reduce(
        (acc, v) => ({
          total: acc.total + v.tempoTotalMs,
          ativo: acc.ativo + v.tempoAtivoMs,
          pausa: acc.pausa + v.tempoPausaMs,
          espera: acc.espera + v.tempoEsperaOficinaMs,
          ocioso: acc.ocioso + v.tempoOciosoMs,
        }),
        { total: 0, ativo: 0, pausa: 0, espera: 0, ocioso: 0 },
      );

      await repo.atualizarAtendimento(atendimento.id, {
        etapaAtualOrdem: dados.ordem,
        atualizadoEm: agora,
        tempoTotalMs: totais.total,
        tempoAtivoMs: totais.ativo,
        tempoPausaMs: Math.max(atendimento.tempoPausaMs, totais.pausa),
        tempoEsperaOficinaMs: Math.max(atendimento.tempoEsperaOficinaMs, totais.espera),
        tempoOciosoMs: totais.ocioso,
      });

      res.status(202).json({ ok: true, visita });
    }),
  );

  router.post(
    '/eventos',
    asyncHandler(async (req, res) => {
      const dados = EventoTelemetriaInSchema.parse(req.body);
      const atendimento = await repo.obterAtendimentoPorId(dados.atendimentoId);
      if (!atendimento) {
        throw new NotFoundError('Atendimento não encontrado para registrar evento.');
      }

      const { registro, duplicado } = await repo.registrarEvento({
        eventoId: dados.eventoId,
        atendimentoId: dados.atendimentoId,
        tipo: dados.tipo,
        etapaOrdem: dados.etapaOrdem,
        ocorridoEm: dados.ocorridoEm ?? new Date(),
        payloadSeguro: dados.payloadSeguro ?? null,
        sintetica: atendimento.sintetica,
      });

      res.status(202).json({ ok: true, duplicado, evento: registro });
    }),
  );

  router.get(
    '/atendimentos/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('ID do atendimento inválido.');
      }
      const atendimento = await repo.obterAtendimentoPorId(id);
      if (!atendimento) {
        throw new NotFoundError('Atendimento não encontrado.');
      }
      const [visitas, eventos] = await Promise.all([
        repo.listarVisitasPorAtendimento(id),
        repo.listarEventosPorAtendimento(id),
      ]);
      res.json({ atendimentoId: id, visitas, eventos });
    }),
  );

  return router;
}
