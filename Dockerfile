# Node.js only Dockerfile (Python agents converted to TypeScript)
# Build: 2026-01-18
FROM node:20-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/

# Build packages
RUN pnpm --filter @questybook/shared build && \
    pnpm --filter @questybook/backend build

# Production image
FROM node:20-slim AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/backend/package.json ./packages/backend/

# Copy built dist files
COPY --from=builder /app/packages/shared/dist/ ./packages/shared/dist/
COPY --from=builder /app/packages/backend/dist/ ./packages/backend/dist/

# Copy node_modules from builder
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/packages/shared/node_modules/ ./packages/shared/node_modules/
COPY --from=builder /app/packages/backend/node_modules/ ./packages/backend/node_modules/

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "packages/backend/dist/index.js"]
