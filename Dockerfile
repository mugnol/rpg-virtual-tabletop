# Multi-stage Dockerfile for RPG Virtual Tabletop
# Stage 1: Build client and server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and workspace package manifests
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install all dependencies (including devDependencies required for compilation)
RUN npm ci

# Copy full application source
COPY . .

# Generate Prisma client for database operations
RUN npm --workspace server run postinstall

# Build backend (tsc) and frontend (vite build)
RUN npm run build

# Prune devDependencies to keep production image lean
RUN npm prune --omit=dev

# Stage 2: Production runtime image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy workspace package manifests
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Copy hoisted production node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/prisma ./server/prisma
COPY --from=builder /app/server/data ./server/data
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/scripts ./scripts

EXPOSE 3001

# Start the unified Node.js server (serves REST API, WebSocket server, and static React SPA)
CMD ["node", "server/dist/index.js"]
