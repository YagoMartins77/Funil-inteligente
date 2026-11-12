import { Router } from 'express';
import { z } from 'zod';
import {
  MOTIVOS_ESPERA_OFICINA,
  MOTIVOS_PAUSA_OPERACIONAL,
} from '../../config/constants';
import { IFunilRepository } from '../../database/types';
import { asyncHandler } from '../../shared/asyncHandler';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';

const MOTIVOS_PAUSA_SET = new Set<string>(MOTIVOS_PAUSA_OPERACIONAL.map((m) => m.codigo));
const MOTIVOS_ESPERA_SET = new Set<string>(MOTIVOS_ESPERA_OFICINA.map((m) => m.codigo));

export const IniciarIntervaloSchema = z
  .object({
    intervaloId: z.string().min(3).max(120),
    etapaOrdem: z.number().int().min(1).max(5),
    motivoCodigo: z.string().min(1).max(60),
    iniciadaEm: z.coerce.date().optional(),
  })
  .strict();

export const FinalizarIntervaloSchema = z
  .object({
    intervaloId: z.string().min(3).max(120).optional(),
    finalizadaEm: z.coerce.date().optional(),
  })
  .strict();

export function createPausasRouter(repo: IFunilRepository): Router {
  const router = Router();

  router.get(
    '/atendimentos/:id/intervalos',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('ID do atendimento inválido.');
      }
      const atendimento = await repo.obterAtendimentoPorId(id);
      if (!atendimento) {
        throw new NotFoundError('Atendimento não encontrado.');
      }
      const [pausas, esperasOficina] = await Promise.all([
        repo.listarPausasPorAtendimento(id),
        repo.listarEsperasPorAtendimento(id),
      ]);
      res.json({
        pausas,
        esperasOficina,
        motivosPausa: MOTIVOS_PAUSA_OPERACIONAL,
        motivosEspera: MOTIVOS_ESPERA_OFICINA,
      });
    }),
  );

  router.post(
    '/atendimentos/:id/pausas/iniciar',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('ID do atendimento inválido.');
      }
      const dados = IniciarIntervaloSchema.parse(req.body);
      if (!MOTIVOS_PAUSA_SET.has(dados.motivoCodigo)) {
        throw new ValidationError('Motivo de pausa operacional inválido.');
      }

      const atendimento = await repo.obterAtendimentoPorId(id);
      if (!atendimento) {
        throw new NotFoundError('Atendimento não encontrado.');
      }
      if (atendimento.status === 'finalizado' || atendimento.status === 'abandonado') {
        throw new ConflictError('Não é possível iniciar pausa em atendimento encerrado.');
      }

      // Idempotência
      const existente = await repo.obterPausaPorPausaId(dados.intervaloId);
      if (existente) {
        res.status(200).json(existente);
        return;
      }

      const pausaAberta = await repo.obterPausaAberta(id);
      if (pausaAberta) {
        throw new ConflictError('Já existe uma pausa operacional em andamento.');
      }
      const esperaAberta = await repo.obterEsperaAberta(id);
      if (esperaAberta) {
        throw new ConflictError('Finalize a espera da oficina antes de iniciar uma pausa.');
      }

      const iniciadaEm = dados.iniciadaEm ?? new Date();
      const pausa = await repo.criarPausa({
        pausaId: dados.intervaloId,
        atendimentoId: id,
        etapaOrdem: dados.etapaOrdem,
        motivoCodigo: dados.motivoCodigo,
        iniciadaEm,
        sintetica: atendimento.sintetica,
      });

      await repo.atualizarAtendimento(id, {
        status: 'em_pausa',
        atualizadoEm: iniciadaEm,
      });

      res.status(201).json(pausa);
    }),
  );

  router.post(
    '/atendimentos/:id/pausas/finalizar',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('ID do atendimento inválido.');
      }
      const dados = FinalizarIntervaloSchema.parse(req.body ?? {});

      const atendimento = await repo.obterAtendimentoPorId(id);
      if (!atendimento) {
        throw new NotFoundError('Atendimento não encontrado.');
      }

      const pausaAberta = dados.intervaloId
        ? await repo.obterPausaPorPausaId(dados.intervaloId)
        : await repo.obterPausaAberta(id);

      if (!pausaAberta || pausaAberta.atendimentoId !== id) {
        throw new NotFoundError('Nenhuma pausa operacional aberta encontrada.');
      }
      if (pausaAberta.finalizadaEm !== null) {
        res.status(200).json(pausaAberta);
        return;
      }

      const finalizadaEm = dados.finalizadaEm ?? new Date();
      if (finalizadaEm.getTime() < pausaAberta.iniciadaEm.getTime()) {
        throw new ValidationError('Horário de término da pausa não pode ser anterior ao início.');
      }

      const duracaoMs = Math.max(0, finalizadaEm.getTime() - pausaAberta.iniciadaEm.getTime());
      const finalizada = await repo.finalizarPausa(pausaAberta.id, finalizadaEm, duracaoMs);

      await repo.atualizarAtendimento(id, {
        status: 'em_andamento',
        tempoPausaMs: atendimento.tempoPausaMs + duracaoMs,
        atualizadoEm: finalizadaEm,
      });

      res.json(finalizada);
    }),
  );

  router.post(
    '/atendimentos/:id/espera-oficina/iniciar',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('ID do atendimento inválido.');
      }
      const dados = IniciarIntervaloSchema.parse(req.body);
      if (!MOTIVOS_ESPERA_SET.has(dados.motivoCodigo)) {
        throw new ValidationError('Motivo de espera da oficina inválido.');
      }

      const atendimento = await repo.obterAtendimentoPorId(id);
      if (!atendimento) {
        throw new NotFoundError('Atendimento não encontrado.');
      }
      if (atendimento.status === 'finalizado' || atendimento.status === 'abandonado') {
        throw new ConflictError('Não é possível iniciar espera técnica em atendimento encerrado.');
      }

      const existente = await repo.obterEsperaPorEsperaId(dados.intervaloId);
      if (existente) {
        res.status(200).json(existente);
        return;
      }

      const esperaAberta = await repo.obterEsperaAberta(id);
      if (esperaAberta) {
        throw new ConflictError('Já existe uma espera técnica da oficina em andamento.');
      }
      const pausaAberta = await repo.obterPausaAberta(id);
      if (pausaAberta) {
        throw new ConflictError('Finalize a pausa operacional antes de iniciar espera da oficina.');
      }

      const iniciadaEm = dados.iniciadaEm ?? new Date();
      const espera = await repo.criarEsperaOficina({
        esperaId: dados.intervaloId,
        atendimentoId: id,
        etapaOrdem: dados.etapaOrdem,
        motivoCodigo: dados.motivoCodigo,
        iniciadaEm,
        sintetica: atendimento.sintetica,
      });

      await repo.atualizarAtendimento(id, {
        status: 'aguardando_oficina',
        atualizadoEm: iniciadaEm,
      });

      res.status(201).json(espera);
    }),
  );

  router.post(
    '/atendimentos/:id/espera-oficina/finalizar',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('ID do atendimento inválido.');
      }
      const dados = FinalizarIntervaloSchema.parse(req.body ?? {});

      const atendimento = await repo.obterAtendimentoPorId(id);
      if (!atendimento) {
        throw new NotFoundError('Atendimento não encontrado.');
      }

      const esperaAberta = dados.intervaloId
        ? await repo.obterEsperaPorEsperaId(dados.intervaloId)
        : await repo.obterEsperaAberta(id);

      if (!esperaAberta || esperaAberta.atendimentoId !== id) {
        throw new NotFoundError('Nenhuma espera técnica da oficina aberta encontrada.');
      }
      if (esperaAberta.finalizadaEm !== null) {
        res.status(200).json(esperaAberta);
        return;
      }

      const finalizadaEm = dados.finalizadaEm ?? new Date();
      if (finalizadaEm.getTime() < esperaAberta.iniciadaEm.getTime()) {
        throw new ValidationError('Horário de término da espera não pode ser anterior ao início.');
      }

      const duracaoMs = Math.max(0, finalizadaEm.getTime() - esperaAberta.iniciadaEm.getTime());
      const finalizada = await repo.finalizarEspera(esperaAberta.id, finalizadaEm, duracaoMs);

      await repo.atualizarAtendimento(id, {
        status: 'em_andamento',
        tempoEsperaOficinaMs: atendimento.tempoEsperaOficinaMs + duracaoMs,
        atualizadoEm: finalizadaEm,
      });

      res.json(finalizada);
    }),
  );

  return router;
}
