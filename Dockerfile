## Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json drizzle.config.ts ./
COPY src/ ./src/
COPY drizzle/ ./drizzle/
RUN npm run build

## Stage 2: Run
FROM node:20-slim

ENV DATA_DIR=/data

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output + migration files from builder
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/drizzle/ ./drizzle/

RUN mkdir -p /data

CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
