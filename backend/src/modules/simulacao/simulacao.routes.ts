import { Router } from 'express';
import { z } from 'zod';
import { IFunilRepository } from '../../database/types';
import { adminGuard } from '../../middlewares/adminGuard';
import { asyncHandler } from '../../shared/asyncHandler';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { executarSimulacao } from './simulacaoService';

export const SimularInSchema = z
  .object({
    regulares: z.number().int().min(0).max(2000).default(80),
    anomalas: z.number().int().min(0).max(2000).default(20),
    etapaAnomalia: z.number().int().min(1).max(5).default(2),
    semente: z.number().int().default(42),
    limparAntes: z.boolean().default(true),
    janela: z.number().int().min(3).max(1000).optional(),
    k: z.number().gt(0).max(10).optional(),
  })
  .strict();

export function createSimulacaoRouter(repo: IFunilRepository): Router {
  const router = Router();

  router.use(adminGuard);

  router.post(
    '/simular',
    asyncHandler(async (req, res) => {
      const dados = SimularInSchema.parse(req.body ?? {});
      if (dados.regulares + dados.anomalas < 1) {
        throw new ValidationError('A simulação deve gerar ao menos 1 sessão.');
      }
      const resultado = await executarSimulacao(repo, dados);
      res.status(201).json(resultado);
    }),
  );

  router.get(
    '/simular/historico',
    asyncHandler(async (_req, res) => {
      const historico = await repo.listarExecucoesSimulacao();
      res.json(historico);
    }),
  );

  router.get(
    '/simular/:id',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('ID da simulação inválido.');
      }
      const execucao = await repo.obterExecucaoSimulacao(id);
      if (!execucao) {
        throw new NotFoundError('Execução de simulação não encontrada.');
      }
      res.json(execucao);
    }),
  );

  router.delete(
    '/dados',
    asyncHandler(async (req, res) => {
      const escopo = req.query.escopo === 'tudo' ? 'tudo' : 'sinteticos';
      if (escopo === 'tudo') {
        if (req.query.confirmacao !== 'CONFIRMAR_EXCLUSAO_DADOS_REAIS') {
          throw new ForbiddenError(
            'Exclusão de dados reais exige ?escopo=tudo&confirmacao=CONFIRMAR_EXCLUSAO_DADOS_REAIS.',
          );
        }
        const result = await repo.limparTodosDados();
        res.json({ escopo: 'tudo', ...result });
        return;
      }

      const result = await repo.limparDadosSinteticos();
      res.json({ escopo: 'sinteticos', ...result });
    }),
  );

  return router;
}
