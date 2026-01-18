# Multi-stage build for Node.js + Python
FROM node:20-slim AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY packages/curriculum-agent/ ./packages/curriculum-agent/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/

# Build
RUN pnpm --filter @questybook/shared build
RUN pnpm --filter @questybook/backend build

# Production image with Python
FROM node:20-slim

# Install Python
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Create symlink for python3 -> python
RUN ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Copy built files from builder
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy curriculum-agent to the path expected by backend (/app/curriculum-agent)
COPY packages/curriculum-agent/ ./curriculum-agent/

# Install Python dependencies
RUN pip3 install --no-cache-dir -r curriculum-agent/requirements.txt --break-system-packages

# Set environment
ENV NODE_ENV=production
ENV PYTHON_PATH=/usr/bin/python3

EXPOSE 3001

CMD ["node", "packages/backend/dist/index.js"]
