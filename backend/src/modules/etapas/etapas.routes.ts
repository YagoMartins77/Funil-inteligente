import { Router } from 'express';
import { IFunilRepository } from '../../database/types';
import { asyncHandler } from '../../shared/asyncHandler';
import { NotFoundError, ValidationError } from '../../shared/errors';

export function createEtapasRouter(repo: IFunilRepository): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const etapas = await repo.listarEtapas();
      res.json(etapas);
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('ID da etapa deve ser um inteiro positivo.');
      }
      const etapa = await repo.obterEtapaPorId(id);
      if (!etapa) {
        throw new NotFoundError('Etapa não encontrada.');
      }
      res.json(etapa);
    }),
  );

  return router;
}
