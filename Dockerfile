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

# Install Chromium for whatsapp-web.js / Puppeteer
RUN apt-get update && \
    apt-get install -y --no-install-recommends chromium && \
    rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV DATA_DIR=/data

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy compiled output + migration files from builder
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/drizzle/ ./drizzle/

RUN mkdir -p /data

# On startup: clean up stale session data (Chromium profiles from previous runs),
# run migrations, then start the app
CMD ["sh", "-c", "rm -rf /data/sessions && mkdir -p /data/sessions && node dist/db/migrate.js && node dist/index.js"]
