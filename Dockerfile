# syntax=docker/dockerfile:1
# Vedax Job Buddy — single image serving the React dashboard + API on one port.

# ---- Stage 1: build the dashboard (React/Vite) ----
FROM node:20-slim AS dashboard
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# ---- Stage 2: build the server (TypeScript) ----
FROM node:20-slim AS server-build
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# ---- Stage 3: runtime ----
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/server

# Production dependencies only (includes sql.js + its wasm).
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Built server + built dashboard (served at ../../dashboard/dist).
COPY --from=server-build /app/server/dist ./dist
COPY --from=dashboard /app/dashboard/dist /app/dashboard/dist

# Persistent data (SQLite DB + uploaded resumes) — mount a volume here.
RUN mkdir -p /app/data

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
