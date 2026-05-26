# ============================================================
# ClaudiaClaw 🦞 — Multi-stage Docker build
# ============================================================

# ─── Stage 1: Install dependencies + build ────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first (for layer caching)
COPY package.json package-lock.json .npmrc ./
COPY packages/core/package.json packages/core/
COPY packages/config/package.json packages/config/
COPY packages/memory/package.json packages/memory/
COPY packages/tools/package.json packages/tools/
COPY packages/provider-deepseek/package.json packages/provider-deepseek/
COPY packages/platform-telegram/package.json packages/platform-telegram/
COPY packages/skill/package.json packages/skill/
COPY packages/cli/package.json packages/cli/

# Install dependencies (including native deps for sql.js)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY packages/core/src/ packages/core/src/
COPY packages/config/src/ packages/config/src/
COPY packages/memory/src/ packages/memory/src/
COPY packages/tools/src/ packages/tools/src/
COPY packages/provider-deepseek/src/ packages/provider-deepseek/src/
COPY packages/platform-telegram/src/ packages/platform-telegram/src/
COPY packages/skill/src/ packages/skill/src/
COPY packages/cli/src/ packages/cli/src/

# Build all packages
RUN npm run build

# ─── Stage 2: Production image ───────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built artifacts from builder
COPY --from=builder /app/packages /app/packages
COPY --from=builder /app/node_modules /app/node_modules

# Copy config
COPY ecosystem.config.js ./

# Create data directory
RUN mkdir -p /app/data

# Environment
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:8443/health').then(r => process.exit(r.ok?0:1)).catch(() => process.exit(1))" || exit 1

# Volumes for persistence
VOLUME ["/app/data", "/app/skills"]

# Expose webhook port
EXPOSE 8443

# Default: run with node (PM2 optional)
CMD ["node", "./packages/cli/dist/index.js", "start"]
