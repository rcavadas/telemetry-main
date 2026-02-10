# =============================================================================
# Dockerfile - Sistema de Telemetria Multi-Protocolo
# Build multi-stage: compila TypeScript + Vite (React) e gera imagem final leve
# =============================================================================

# ---------- Stage 1: Build ----------
FROM node:22-alpine AS builder

# Dependências nativas para compilar better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copiar apenas os arquivos de dependência primeiro (melhor cache de camadas)
COPY package.json package-lock.json ./

# Instalar TODAS as dependências (incluindo devDependencies para build)
RUN npm install

# Copiar código-fonte e configs de build
COPY src/ src/
COPY scripts/ scripts/
COPY tsconfig.json tsconfig.client.json tsconfig.node.json ./
COPY vite.config.ts postcss.config.js tailwind.config.js ./

# Build do backend (TypeScript → dist/)
RUN npx tsc

# Copiar views para dist
RUN node scripts/copy-views.js

# Build do frontend (React + Vite → dist/client/)
RUN npx vite build

# ---------- Stage 2: Production ----------
FROM node:22-alpine AS production

# Dependências nativas para better-sqlite3 em runtime
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Metadados
LABEL maintainer="Telemetria OBD Team"
LABEL description="Sistema de Telemetria Multi-Protocolo com Rastreamento GPS"

# Copiar apenas package.json para instalar deps de produção
COPY package.json package-lock.json ./

# Instalar apenas dependências de produção
RUN npm install --omit=dev && npm cache clean --force

# Remover ferramentas de build (manter apenas runtime libs)
RUN apk del python3 make g++

# Copiar build do stage anterior
COPY --from=builder /app/dist ./dist

# Copiar scripts necessários em runtime
COPY scripts/ scripts/

# Criar diretórios de dados (serão montados como volumes)
RUN mkdir -p data obd_data logs

# Portas expostas:
#   3000 = HTTP (interface web + API REST)
#   5086 = TCP  (recepção de dados OBD — porta padrão Castel/Sinocastel)
EXPOSE 3000
EXPOSE 5086

# Variáveis de ambiente padrão (podem ser sobrescritas no docker-compose)
ENV NODE_ENV=production
ENV HTTP_PORT=3000
ENV TCP_PORT=5086

# Healthcheck: verifica se o servidor HTTP está respondendo
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Iniciar o servidor
CMD ["node", "dist/server.js"]
