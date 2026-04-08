# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────
# Stage 1 – deps: install production dependencies only
# ─────────────────────────────────────────────
FROM node:22-alpine AS deps

# Install libc compatibility shim required by some native modules on Alpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy lockfiles first so Docker can cache this layer
COPY app/package.json app/package-lock.json ./

# Install with exact versions from lockfile, no lifecycle scripts from untrusted packages
RUN npm ci --omit=dev --ignore-scripts

# ─────────────────────────────────────────────
# Stage 2 – builder: compile the Next.js app
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Re-install ALL dependencies (including devDeps) for the build
COPY app/package.json app/package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source
COPY app/ .

# Build without telemetry and without collecting any secrets at build time
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─────────────────────────────────────────────
# Stage 3 – runner: minimal production image
# ─────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Default port – can be overridden at runtime
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create a dedicated non-root user and group
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy only what Next.js standalone output needs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static

USER nextjs

EXPOSE 3000

# Env vars are injected at runtime – never baked into the image
# Required: UDM_API_URL, UDM_API_KEY
# Optional: UDM_API_SITE_ID (auto-resolved if unset)

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
