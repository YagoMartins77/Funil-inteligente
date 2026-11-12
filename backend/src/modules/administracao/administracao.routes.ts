import { Router } from 'express';
import { z } from 'zod';
import { IFunilRepository } from '../../database/types';
import { adminGuard } from '../../middlewares/adminGuard';
import { asyncHandler } from '../../shared/asyncHandler';

export const AtualizarConfigSchema = z
  .object({
    janelaPadrao: z.number().int().min(3).max(500).optional(),
    kDesvios: z.number().gt(0).max(10).optional(),
    minBaseline: z.number().int().min(2).max(500).optional(),
    minJanela: z.number().int().min(1).max(200).optional(),
    timeoutAbandonoS: z.number().int().min(60).max(86400).optional(),
  })
  .strict();

export function createAdministracaoRouter(repo: IFunilRepository): Router {
  const router = Router();

  router.get(
    '/configuracoes',
    asyncHandler(async (_req, res) => {
      const cfg = await repo.obterConfiguracaoEstatistica();
      res.json(cfg);
    }),
  );

  router.put(
    '/configuracoes',
    adminGuard,
    asyncHandler(async (req, res) => {
      const dados = AtualizarConfigSchema.parse(req.body);
      const atualizado = await repo.atualizarConfiguracaoEstatistica(dados);
      res.json(atualizado);
    }),
  );

  return router;
}
