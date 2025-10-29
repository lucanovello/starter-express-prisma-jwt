# ---- Base ----
ARG NODE_VERSION=20.19.0
ARG ALPINE_VERSION=3.20
ARG LIBC6_COMPAT_VERSION=1.2.4-r2
ARG PRISMA_CLI_VERSION=6.17.1

FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS base
WORKDIR /app

# ---- Deps ----
# Install prod deps first (cache-friendly layer)
FROM base AS deps
ENV NODE_ENV=production
ARG LIBC6_COMPAT_VERSION
RUN apk add --no-cache "libc6-compat=${LIBC6_COMPAT_VERSION}"
COPY package*.json ./
RUN npm ci

# ---- Build ----
# Install dev deps for building, then compile
FROM base AS build
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ---- Prune ----
# Start from prod deps and prune (ensures prod-only)
FROM base AS prune
ENV NODE_ENV=production
ARG PRISMA_CLI_VERSION
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
RUN npm prune --omit=dev \
  && npm install "prisma@${PRISMA_CLI_VERSION}" --no-save
# Keep Prisma CLI (dev dependency) so migrate deploy works at runtime.

# ---- Runtime ----
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
USER app

COPY --from=build  /app/dist         ./dist
COPY --from=prune  /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma         ./prisma

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
