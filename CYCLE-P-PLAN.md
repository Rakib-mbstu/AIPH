# Cycle P — Deployment

**Goal:** Containerize the app, wire up CI/CD, and get it running on a
production server with real environment variables and monitored health.

**Estimated touches:** 6 new files (Dockerfiles, compose, GitHub Actions, nginx
config), 2 updated files (`.gitignore`, root `package.json`).

---

## 1. Project Structure After This Cycle

```
/
  docker-compose.yml          ← dev + prod compose
  docker-compose.prod.yml     ← prod overrides
  .github/
    workflows/
      ci.yml                  ← lint, type-check, test on every push
      deploy.yml              ← build + deploy on merge to main
  client/
    Dockerfile
    nginx.conf
  server/
    Dockerfile
```

---

## 2. Client Dockerfile

### File: `client/Dockerfile` (NEW)

Multi-stage: build with Node, serve with nginx.

```dockerfile
# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

# Copy workspace root for npm workspaces resolution
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm ci --workspace=client --ignore-scripts

COPY client/ ./client/

# Build args for Vite env vars (injected at build time)
ARG VITE_API_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_POSTHOG_KEY
ARG VITE_POSTHOG_HOST

RUN npm run build -w client

# ── Stage 2: Serve ────────────────────────────────────────────────────────────
FROM nginx:1.25-alpine AS serve

COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
```

### File: `client/nginx.conf` (NEW)

SPA routing: all paths fall back to `index.html` for React Router.

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Serve static assets with long cache
    location ~* \.(js|css|png|svg|ico|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # All other routes → index.html (React Router handles them)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 3. Server Dockerfile

### File: `server/Dockerfile` (NEW)

Multi-stage: build TypeScript, run compiled JS with Prisma.

```dockerfile
# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm ci --workspace=server --ignore-scripts

COPY server/ ./server/
COPY data/ ./data/

RUN npm run build -w server

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm ci --workspace=server --omit=dev --ignore-scripts

# Copy compiled output
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/data ./data

# Generate Prisma client for the runtime image's platform
RUN cd server && npx prisma generate

EXPOSE 4000

# Run migrations then start the server
CMD ["sh", "-c", "cd server && npx prisma migrate deploy && node dist/index.js"]
```

**Note:** The `CMD` runs `prisma migrate deploy` (applies pending migrations, no
reset) then starts the server. This is the standard Prisma production pattern.

---

## 4. docker-compose.yml (development)

### File: `docker-compose.yml` (NEW, repo root)

Used for local dev with a Dockerized Postgres (alternative to a local install).
Frontend and backend still run with `npm run dev` (hot reload), only DB is
containerized.

```yaml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: aiph
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

  db_test:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: aiph_test
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '5433:5432'
    volumes:
      - pgdata_test:/var/lib/postgresql/data

volumes:
  pgdata:
  pgdata_test:
```

---

## 5. docker-compose.prod.yml

### File: `docker-compose.prod.yml` (NEW, repo root)

Full stack: client + server + db. Used for a single-server deployment (VPS,
Railway, Render, etc.).

```yaml
version: '3.9'

services:
  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-aiph}
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    # Do NOT expose port publicly in prod

  server:
    build:
      context: .
      dockerfile: server/Dockerfile
    restart: always
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      CLERK_SECRET_KEY: ${CLERK_SECRET_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      NODE_ENV: production
      PORT: 4000
    depends_on:
      - db
    ports:
      - '4000:4000'

  client:
    build:
      context: .
      dockerfile: client/Dockerfile
      args:
        VITE_API_URL: ${VITE_API_URL}
        VITE_CLERK_PUBLISHABLE_KEY: ${VITE_CLERK_PUBLISHABLE_KEY}
        VITE_POSTHOG_KEY: ${VITE_POSTHOG_KEY:-}
        VITE_POSTHOG_HOST: ${VITE_POSTHOG_HOST:-https://us.i.posthog.com}
    restart: always
    ports:
      - '80:80'
    depends_on:
      - server

volumes:
  pgdata:
```

**Production deploy command:**
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 6. CI — GitHub Actions

### File: `.github/workflows/ci.yml` (NEW)

Runs on every push and PR. Does NOT deploy.

```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type-check
        run: npm run type-check

      - name: Unit tests (client)
        run: npm run test -w client

      - name: Unit tests (server)
        run: npm run test -w server
```

**Note:** Integration tests (Cycle O) are NOT in the CI pipeline — they require
a running Postgres. They run manually or in a separate workflow that provisions
a DB service. Add that later if needed:

```yaml
      # Optional: integration tests with Postgres service
      - name: Integration tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/aiph_test
          BYPASS_AUTH: 'true'
        services:
          postgres:
            image: postgres:16
            env:
              POSTGRES_PASSWORD: postgres
              POSTGRES_DB: aiph_test
```

### File: `.github/workflows/deploy.yml` (NEW)

Runs only on merge to `main`. Builds and pushes images, then SSHes into the
server to pull and restart.

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/aiph
            git pull origin main
            docker compose -f docker-compose.prod.yml up -d --build
            docker image prune -f
```

**Required GitHub Secrets:**
- `PROD_HOST` — server IP or hostname
- `PROD_USER` — SSH username (e.g. `ubuntu`)
- `PROD_SSH_KEY` — private SSH key for the server

**Required `.env` on the production server at `/opt/aiph/.env`:**
```env
POSTGRES_PASSWORD=...
CLERK_SECRET_KEY=...
ANTHROPIC_API_KEY=...
OPENROUTER_API_KEY=...
VITE_API_URL=https://api.yourdomain.com
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_POSTHOG_KEY=phc_...
```

---

## 7. `.gitignore` Updates

### File: `.gitignore` (UPDATE)

Add:
```
# Docker
.env.prod
server/.env.test

# Build outputs
client/dist/
server/dist/
```

---

## 8. Root `package.json` — Add test + CI Scripts

### File: `package.json` (UPDATE)

```json
"scripts": {
  ...existing scripts...,
  "test": "npm run test -w client && npm run test -w server",
  "test:integration": "npm run test:integration -w server"
}
```

---

## What NOT to Do

- Do NOT commit `.env`, `.env.prod`, or `.env.test` — add them to `.gitignore`
- Do NOT use `npm run build` in the `CMD` — build happens in the Docker build
  stage, not at runtime
- Do NOT use `prisma migrate reset` in the prod `CMD` — that drops all data.
  Use `prisma migrate deploy`
- Do NOT expose the Postgres port in the prod compose file — the DB should not
  be reachable from outside the Docker network
- Do NOT bake secrets into Dockerfiles as `ENV` instructions — pass them via
  `docker-compose.prod.yml` environment block from host `.env`
- Do NOT add a reverse proxy (nginx/Caddy) in front of the server container
  unless you're handling SSL — use a managed SSL terminator (Cloudflare, Render,
  Railway) instead

---

## Verification Checklist

- [ ] `docker compose up db` starts Postgres on port 5432 cleanly
- [ ] `docker compose -f docker-compose.prod.yml build` completes without error
- [ ] `docker compose -f docker-compose.prod.yml up -d` starts all 3 services
- [ ] `curl http://localhost/` returns the React app's HTML
- [ ] `curl http://localhost:4000/api/health` returns 200 (add a `/api/health`
      route to the server that returns `{ ok: true }` — required for container
      health checks and load balancers)
- [ ] CI workflow triggers on push and passes type-check + unit tests
- [ ] Deploy workflow triggers on merge to main and SSHes successfully
- [ ] No secrets visible in `git log` or Docker image layers
- [ ] `docker image prune -f` runs after deploy to prevent disk growth

---

## Optional: `/api/health` Route

Add before deploying. This is referenced in the checklist above and is needed
for Docker health checks and any load balancer/uptime monitor.

### File: `server/src/app.ts`

```ts
// Health check — no auth required
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }))
```

Add this before the other routes so it can't be accidentally protected by
middleware.
