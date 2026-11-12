import { Router } from 'express';
import { z } from 'zod';
import { IFunilRepository } from '../../database/types';
import { asyncHandler } from '../../shared/asyncHandler';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';

export const CriarAtendimentoSchema = z
  .object({
    uuidExterno: z.string().min(4).max(120),
    dispositivo: z.enum(['tablet', 'desktop', 'mobile']).default('tablet'),
    cenario: z.string().max(80).nullable().optional(),
    sintetica: z.boolean().default(false),
    iniciadoEm: z.coerce.date().optional(),
  })
  .strict();

export const AtualizarAtendimentoSchema = z
  .object({
    etapaAtualOrdem: z.number().int().min(1).max(5).optional(),
    status: z
      .enum(['em_andamento', 'em_pausa', 'aguardando_oficina', 'finalizado', 'abandonado'])
      .optional(),
    tempoTotalMs: z.number().int().min(0).optional(),
    tempoAtivoMs: z.number().int().min(0).optional(),
    tempoPausaMs: z.number().int().min(0).optional(),
    tempoEsperaOficinaMs: z.number().int().min(0).optional(),
    tempoOciosoMs: z.number().int().min(0).optional(),
  })
  .strict();

export const FinalizarAtendimentoSchema = z
  .object({
    tempoTotalMs: z.number().int().min(0).optional(),
    tempoAtivoMs: z.number().int().min(0).optional(),
    tempoPausaMs: z.number().int().min(0).optional(),
    tempoEsperaOficinaMs: z.number().int().min(0).optional(),
    tempoOciosoMs: z.number().int().min(0).optional(),
    finalizadoEm: z.coerce.date().optional(),
  })
  .strict();

export function createAtendimentosRouter(repo: IFunilRepository): Router {
  const router = Router();

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const dados = CriarAtendimentoSchema.parse(req.body);
      const existente = await repo.obterAtendimentoPorUuid(dados.uuidExterno);
      if (existente) {
        res.status(200).json(existente);
        return;
      }
      const criado = await repo.criarAtendimento({
        uuidExterno: dados.uuidExterno,
        dispositivo: dados.dispositivo,
        cenario: dados.cenario ?? null,
        sintetica: dados.sintetica,
        iniciadoEm: dados.iniciadoEm,
      });
      res.status(201).json(criado);
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const sintetica = req.query.sinteticas === 'true';
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const etapaOrdem = req.query.etapa ? Number(req.query.etapa) : undefined;
      const desfecho =
        typeof req.query.desfecho === 'string' && req.query.desfecho.trim()
          ? req.query.desfecho.trim()
          : undefined;
      const status =
        typeof req.query.status === 'string' && req.query.status.trim()
          ? req.query.status.trim()
          : undefined;
      const dataInicio =
        typeof req.query.dataInicio === 'string' && req.query.dataInicio
          ? new Date(req.query.dataInicio)
          : undefined;
      const dataFim =
        typeof req.query.dataFim === 'string' && req.query.dataFim
          ? new Date(req.query.dataFim)
          : undefined;

      const { itens, total } = await repo.listarAtendimentos({
        sintetica,
        page: Number.isFinite(page) ? page : 1,
        limit: Number.isFinite(limit) ? limit : 20,
        etapaOrdem: etapaOrdem && Number.isInteger(etapaOrdem) ? etapaOrdem : undefined,
        desfecho,
        status,
        dataInicio: dataInicio && !Number.isNaN(dataInicio.getTime()) ? dataInicio : undefined,
        dataFim: dataFim && !Number.isNaN(dataFim.getTime()) ? dataFim : undefined,
      });

      res.json({
        itens,
        paginacao: {
          page,
          limit,
          total,
          totalPaginas: Math.max(1, Math.ceil(total / Math.max(1, limit))),
        },
      });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('ID do atendimento inválido.');
      }
      const atendimento = await repo.obterAtendimentoPorId(id);
      if (!atendimento) {
        throw new NotFoundError('Atendimento não encontrado.');
      }
      const [visitas, pausas, esperasOficina, eventos] = await Promise.all([
        repo.listarVisitasPorAtendimento(id),
        repo.listarPausasPorAtendimento(id),
        repo.listarEsperasPorAtendimento(id),
        repo.listarEventosPorAtendimento(id),
      ]);
      res.json({
        ...atendimento,
        visitas,
        pausas,
        esperasOficina,
        eventos,
      });
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('ID do atendimento inválido.');
      }
      const dados = AtualizarAtendimentoSchema.parse(req.body);
      const atendimento = await repo.obterAtendimentoPorId(id);
      if (!atendimento) {
        throw new NotFoundError('Atendimento não encontrado.');
      }
      if (atendimento.status === 'finalizado' || atendimento.status === 'abandonado') {
        throw new ConflictError('Atendimento já encerrado não pode ser alterado.');
      }

      const atualizado = await repo.atualizarAtendimento(id, {
        ...dados,
        atualizadoEm: new Date(),
      });
      res.json(atualizado);
    }),
  );

  router.post(
    '/:id/finalizar',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('ID do atendimento inválido.');
      }
      const dados = FinalizarAtendimentoSchema.parse(req.body ?? {});
      const atendimento = await repo.obterAtendimentoPorId(id);
      if (!atendimento) {
        throw new NotFoundError('Atendimento não encontrado.');
      }

      const agora = dados.finalizadoEm ?? new Date();
      const visitas = await repo.listarVisitasPorAtendimento(id);
      const somaVisitas = visitas.reduce(
        (acc, v) => ({
          total: acc.total + v.tempoTotalMs,
          ativo: acc.ativo + v.tempoAtivoMs,
          pausa: acc.pausa + v.tempoPausaMs,
          espera: acc.espera + v.tempoEsperaOficinaMs,
          ocioso: acc.ocioso + v.tempoOciosoMs,
        }),
        { total: 0, ativo: 0, pausa: 0, espera: 0, ocioso: 0 },
      );

      const atualizado = await repo.atualizarAtendimento(id, {
        status: atendimento.desfechoCodigo === 'interrompido' ? 'abandonado' : 'finalizado',
        finalizadoEm: atendimento.finalizadoEm ?? agora,
        atualizadoEm: agora,
        tempoTotalMs: dados.tempoTotalMs ?? Math.max(atendimento.tempoTotalMs, somaVisitas.total),
        tempoAtivoMs: dados.tempoAtivoMs ?? Math.max(atendimento.tempoAtivoMs, somaVisitas.ativo),
        tempoPausaMs: dados.tempoPausaMs ?? Math.max(atendimento.tempoPausaMs, somaVisitas.pausa),
        tempoEsperaOficinaMs:
          dados.tempoEsperaOficinaMs ??
          Math.max(atendimento.tempoEsperaOficinaMs, somaVisitas.espera),
        tempoOciosoMs: dados.tempoOciosoMs ?? Math.max(atendimento.tempoOciosoMs, somaVisitas.ocioso),
      });

      res.json(atualizado);
    }),
  );

  router.get(
    '/:id/etapas',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('ID do atendimento inválido.');
      }
      const atendimento = await repo.obterAtendimentoPorId(id);
      if (!atendimento) {
        throw new NotFoundError('Atendimento não encontrado.');
      }
      const visitas = await repo.listarVisitasPorAtendimento(id);
      res.json(visitas);
    }),
  );

  return router;
}
