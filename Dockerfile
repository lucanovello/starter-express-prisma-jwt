# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app

# ---- Deps ----
# Install prod deps first (cache-friendly layer)
FROM base AS deps
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat
COPY package*.json ./
RUN npm ci

# ---- Build ----
# Install dev deps for building, then compile
FROM base AS build
ENV NODE_ENV=development
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Prune ----
# Start from prod deps and prune (ensures prod-only)
FROM base AS prune
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
RUN npm prune --omit=dev

# ---- Runtime ----
FROM node:20-alpine AS runner
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
