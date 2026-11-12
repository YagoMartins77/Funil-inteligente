import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      erro: 'Dados inválidos ou campos não permitidos (LGPD).',
      codigo: 'VALIDATION_ERROR',
      detalhes: err.issues.map((issue) => ({
        campo: issue.path.join('.') || 'payload',
        mensagem: issue.message,
        codigo: issue.code,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      erro: err.message,
      codigo: err.code,
      ...(err.details !== undefined ? { detalhes: err.details } : {}),
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      erro: 'JSON inválido no corpo da requisição.',
      codigo: 'INVALID_JSON',
    });
    return;
  }

  console.error('[ERROR]', err instanceof Error ? err.message : 'Erro interno desconhecido');
  res.status(500).json({
    erro: 'Erro interno do servidor.',
    codigo: 'INTERNAL_SERVER_ERROR',
  });
}
