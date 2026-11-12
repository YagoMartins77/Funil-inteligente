import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { openApiSpec } from './config/swagger';
import { IFunilRepository } from './database/types';
import { errorHandler } from './middlewares/errorHandler';
import { createAdministracaoRouter } from './modules/administracao/administracao.routes';
import { createAnalyticsRouter } from './modules/analytics/analytics.routes';
import { createAtendimentosRouter } from './modules/atendimentos/atendimentos.routes';
import { createDesfechosRouter } from './modules/desfechos/desfechos.routes';
import { createEtapasRouter } from './modules/etapas/etapas.routes';
import { createPausasRouter } from './modules/pausas/pausas.routes';
import { createSimulacaoRouter } from './modules/simulacao/simulacao.routes';
import { createTelemetriaRouter } from './modules/telemetria/telemetria.routes';

export function createApp(repo: IFunilRepository): Express {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: env.CORS_ORIGENS.includes('*') ? true : env.CORS_ORIGENS,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  // Suporte para navigator.sendBeacon enviando text/plain JSON
  app.use(express.text({ type: 'text/plain', limit: '1mb' }));
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // Deixa o middleware de validação lidar se for inválido
      }
    }
    next();
  });

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/api/openapi.json', (_req, res) => res.json(openApiSpec));

  const apiV1 = express.Router();
  apiV1.get('/saude', (_req, res) => {
    res.json({ status: 'ok', servico: 'fastcar-funil-api', versao: '1.0.0' });
  });

  apiV1.use('/etapas', createEtapasRouter(repo));
  apiV1.use('/atendimentos', createAtendimentosRouter(repo));
  apiV1.use('/telemetria', createTelemetriaRouter(repo));
  apiV1.use('/', createPausasRouter(repo));
  apiV1.use('/', createDesfechosRouter(repo));
  apiV1.use('/analytics', createAnalyticsRouter(repo));
  apiV1.use('/admin', createSimulacaoRouter(repo));
  apiV1.use('/admin', createAdministracaoRouter(repo));

  app.use('/api/v1', apiV1);

  app.use((_req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada.', codigo: 'NOT_FOUND' });
  });

  app.use(errorHandler);

  return app;
}
