import { Router } from 'express';
import { z } from 'zod';
import { IFunilRepository } from '../../database/types';
import { asyncHandler } from '../../shared/asyncHandler';
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors';

export const DesfechoInSchema = z
  .object({
    desfechoCodigo: z.enum(['convertido', 'desistiu', 'nao_fechou', 'interrompido']),
    motivoDesistenciaCodigo: z.string().min(1).max(60).nullable().optional(),
    etapaOrdem: z.number().int().min(1).max(5).optional(),
    finalizadoEm: z.coerce.date().optional(),
  })
  .strict();

export function createDesfechosRouter(repo: IFunilRepository): Router {
  const router = Router();

  router.get(
    '/desfechos',
    asyncHandler(async (_req, res) => {
      const desfechos = await repo.listarDesfechos();
      res.json(desfechos);
    }),
  );

  router.get(
    '/desfechos/motivos',
    asyncHandler(async (_req, res) => {
      const motivos = await repo.listarMotivosDesistencia();
      res.json(motivos);
    }),
  );

  router.post(
    '/atendimentos/:id/desfecho',
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new ValidationError('ID do atendimento inválido.');
      }
      const dados = DesfechoInSchema.parse(req.body);

      const atendimento = await repo.obterAtendimentoPorId(id);
      if (!atendimento) {
        throw new NotFoundError('Atendimento não encontrado.');
      }

      const desfechos = await repo.listarDesfechos();
      const desfechoDef = desfechos.find((d) => d.codigo === dados.desfechoCodigo);
      if (!desfechoDef) {
        throw new ValidationError('Código de desfecho inválido.');
      }

      if (desfechoDef.exigeMotivo) {
        if (!dados.motivoDesistenciaCodigo) {
          throw new ValidationError(
            `O desfecho "${desfechoDef.nome}" exige um motivo padronizado de desistência.`,
          );
        }
        const motivos = await repo.listarMotivosDesistencia();
        const motivoExiste = motivos.some((m) => m.codigo === dados.motivoDesistenciaCodigo);
        if (!motivoExiste) {
          throw new ValidationError('Código de motivo de desistência inválido.');
        }
      } else if (dados.motivoDesistenciaCodigo) {
        throw new ValidationError('Orçamento convertido não deve possuir motivo de desistência.');
      }

      // Garante que não haja pausa ou espera aberta ao registrar desfecho
      const pausaAberta = await repo.obterPausaAberta(id);
      if (pausaAberta) {
        throw new ConflictError('Finalize a pausa operacional aberta antes de registrar o desfecho.');
      }
      const esperaAberta = await repo.obterEsperaAberta(id);
      if (esperaAberta) {
        throw new ConflictError('Finalize a espera da oficina antes de registrar o desfecho.');
      }

      const agora = dados.finalizadoEm ?? new Date();
      const atualizado = await repo.atualizarAtendimento(id, {
        desfechoCodigo: dados.desfechoCodigo,
        motivoDesistenciaCodigo: dados.motivoDesistenciaCodigo ?? null,
        status: dados.desfechoCodigo === 'interrompido' ? 'abandonado' : 'finalizado',
        finalizadoEm: agora,
        atualizadoEm: agora,
        ...(dados.etapaOrdem ? { etapaAtualOrdem: dados.etapaOrdem } : {}),
      });

      res.json(atualizado);
    }),
  );

  return router;
}
