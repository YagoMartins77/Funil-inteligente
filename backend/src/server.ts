import { PrismaClient } from '@prisma/client';
import { createApp } from './app';
import { env } from './config/env';
import { PrismaFunilRepository } from './database/prismaRepository';

async function bootstrap() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  const repo = new PrismaFunilRepository(prisma);
  const app = createApp(repo);

  const server = app.listen(env.PORT, () => {
    console.log(`FASTCAR Funil API rodando em http://localhost:${env.PORT}/api/v1`);
    console.log(`Swagger Docs em http://localhost:${env.PORT}/api/docs`);
  });

  const shutdown = async () => {
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Falha ao iniciar servidor:', err);
  process.exit(1);
});
