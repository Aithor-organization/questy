# Node.js only Dockerfile (Python agents converted to TypeScript)
# Build: 2026-01-18-v3 - Include questyCoachAgent package
FROM node:20-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config and package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY questyCoachAgent/package.json ./questyCoachAgent/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/
COPY questyCoachAgent/ ./questyCoachAgent/

# Build all packages in correct order
RUN pnpm --filter @questybook/shared build && \
    pnpm --filter @questy/coach-agent build && \
    pnpm --filter @questybook/backend build

# Production image
FROM node:20-slim AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/backend/package.json ./packages/backend/
COPY --from=builder /app/questyCoachAgent/package.json ./questyCoachAgent/

# Copy built dist files
COPY --from=builder /app/packages/shared/dist/ ./packages/shared/dist/
COPY --from=builder /app/packages/backend/dist/ ./packages/backend/dist/
COPY --from=builder /app/questyCoachAgent/dist/ ./questyCoachAgent/dist/

# Copy node_modules from builder (includes workspace links)
COPY --from=builder /app/node_modules/ ./node_modules/
COPY --from=builder /app/packages/shared/node_modules/ ./packages/shared/node_modules/
COPY --from=builder /app/packages/backend/node_modules/ ./packages/backend/node_modules/
COPY --from=builder /app/questyCoachAgent/node_modules/ ./questyCoachAgent/node_modules/

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "packages/backend/dist/index.js"]
