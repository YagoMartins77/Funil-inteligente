import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3001),
  DATABASE_URL:
    process.env.DATABASE_URL ?? 'postgresql://funil:funil@localhost:5432/funil?schema=public',
  CORS_ORIGENS: (process.env.FUNIL_CORS_ORIGENS ?? '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  PERMITIR_ADMIN: (process.env.FUNIL_PERMITIR_ADMIN ?? '1') === '1',
  ADMIN_TOKEN: process.env.FUNIL_ADMIN_TOKEN ?? '',
};
