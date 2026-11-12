FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npx tsc prisma/seed.ts --outDir dist-seed --module CommonJS --target ES2022 --esModuleInterop --skipLibCheck

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-seed ./dist-seed
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && node dist-seed/seed.js && node dist/server.js"]
