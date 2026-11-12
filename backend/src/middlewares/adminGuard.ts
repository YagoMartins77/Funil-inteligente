import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { ForbiddenError } from '../shared/errors';

export function adminGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!env.PERMITIR_ADMIN) {
    throw new ForbiddenError(
      'Operações administrativas desativadas (FUNIL_PERMITIR_ADMIN=0).',
    );
  }

  if (env.ADMIN_TOKEN) {
    const token = req.header('x-admin-token');
    if (token !== env.ADMIN_TOKEN) {
      throw new ForbiddenError('Token administrativo inválido ou ausente.');
    }
  }

  next();
}
