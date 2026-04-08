# UDM DNS Manager

A self-hosted web UI for managing DNS records on a **Ubiquiti UniFi Dream Machine (UDM)** via the UniFi Network Integration API.

Includes a scheduled sync job that automatically creates DNS records on the UDM for proxy hosts defined in **Nginx Proxy Manager (NPM)**.

Built with Next.js 16, React 19, TypeScript, and Tailwind CSS. Styled to match the UniFi Network dark interface.

---

## Features

### DNS record management

- **List** all DNS policy records with domain, value, type, and enabled status
- **Toggle** records on/off directly from the table
- **Bulk delete** multiple records at once via checkboxes
- **View** full record details in a modal (domain, type, value, TTL, origin, status)
- **Create** new records with client-side validation per DNS type
- **Edit** existing records inline in the same modal
- **Delete** individual records with confirmation

### NPM → UDM sync

- **Scheduled sync** runs automatically every N minutes (configurable via `CRON_INTERVAL_MINUTES`, default 10)
- **Manual trigger** via the "Run Job" button in the UI (calls `POST /api/cron`)
- Fetches enabled proxy hosts from Nginx Proxy Manager filtered by a configurable access list name
- For each matched domain not yet present on the UDM, creates an **A_RECORD** pointing to `NPM_IP`
- Sync is additive only — existing UDM records are never modified or deleted

### Supported DNS types

| Type | Value field |
|------|-------------|
| `A_RECORD` | IPv4 address |
| `AAAA_RECORD` | IPv6 address |
| `CNAME_RECORD` | Target domain |
| `MX_RECORD` | Mail server domain |
| `TXT_RECORD` | Free-form text |
| `SRV_RECORD` | Free-form value |
| `FORWARD_DOMAIN` | Target domain |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | React 19 |
| Styling | Tailwind CSS 3 |
| Runtime | Node.js 22 |

---

## Project structure

```
app/
├── src/
│   ├── app/
│   │   ├── globals.css              # Design tokens (UniFi dark theme)
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── not-found.tsx
│   │   └── api/
│   │       ├── dns/
│   │       │   ├── route.ts         # GET (list) + POST (create)
│   │       │   └── [id]/route.ts    # GET + PUT (update) + DELETE
│   │       └── cron/
│   │           └── route.ts         # GET (status) + POST (trigger sync)
│   ├── components/
│   │   ├── DnsTable.tsx             # Main table, bulk-delete, toggle, "Run Job" button
│   │   ├── RecordDetailModal.tsx    # View / edit / delete modal
│   │   └── CreateRecordModal.tsx    # Create record modal
│   └── lib/
│       ├── cron.ts                  # In-process scheduler + NPM→UDM sync logic
│       ├── npm.ts                   # Nginx Proxy Manager API client (auth + proxy hosts)
│       ├── types.ts                 # DnsRecord type + DNS_TYPES
│       ├── unifi.ts                 # UniFi API client (server-side only)
│       └── validation.ts            # Per-type value validation
├── Dockerfile
├── .dockerignore
├── .env.local.example
└── next.config.mjs
```

---

## Environment variables

### UniFi (required)

| Variable | Required | Description |
|----------|----------|-----------|
| `UDM_API_URL` | **Yes** | Base URL of the UDM (e.g. `https://192.168.1.1`) |
| `UDM_API_KEY` | **Yes** | API key generated in the UniFi dashboard |
| `UDM_API_SITE_ID` | No | Site UUID — auto-resolved from `/v1/sites` if omitted |

### Nginx Proxy Manager sync (optional)

| Variable | Required | Description |
|----------|----------|-----------|
| `NPM_IP` | Yes\* | IP address of the NPM instance — used as `http://<ip>:81` |
| `NPM_USERNAME` | Yes\* | NPM login email |
| `NPM_PASSWORD` | Yes\* | NPM login password |
| `NPM_ACCESS_LIST_NAME` | No | Access list to filter by (default: `"Local Net or Basic"`) |
| `CRON_INTERVAL_MINUTES` | No | Sync interval in minutes (default: `10`) |

\* Required only if using the NPM sync feature.

> **Never commit secrets.** `.env.local` is gitignored. Use environment variables injected at runtime (Docker, shell export, etc.).

### Generating an API key

1. Log in to your UniFi Network console
2. Go to **Settings → Control Plane → Integrations → API Tokens**
3. Create a new token and copy the key

---

## Getting started

### Local development

```bash
cd app

# Copy the example env file and fill in your values
cp .env.local.example .env.local

npm install
npm run dev
# → http://localhost:3000
```

Or export variables directly without a file (env vars are read at request time, not build time):

```bash
export UDM_API_URL=https://192.168.1.1
export UDM_API_KEY=your-api-key
export UDM_API_SITE_ID=your-site-uuid      # optional
export NPM_IP=192.168.1.x                  # optional — NPM sync
export NPM_USERNAME=admin@example.com      # optional
export NPM_PASSWORD=your-npm-password      # optional
export NPM_ACCESS_LIST_NAME="Local Net"    # optional
export CRON_INTERVAL_MINUTES=5             # optional

npm run dev
```

### Production build

```bash
npm run build
npm run start
```

---

## Docker

### Build and run

```bash
# Build the image (from repo root)
docker build -t udm-dns-manager .

# Run the container
docker run -d \
  --name udm-dns-manager \
  -p 3000:3000 \
  -e UDM_API_URL=https://192.168.1.1 \
  -e UDM_API_KEY=your-api-key \
  -e UDM_API_SITE_ID=your-site-uuid \
  -e NPM_IP=192.168.1.x \
  -e NPM_USERNAME=admin@example.com \
  -e NPM_PASSWORD=your-npm-password \
  -e NPM_ACCESS_LIST_NAME="Local Net or Basic" \
  -e CRON_INTERVAL_MINUTES=10 \
  udm-dns-manager
```

Open [http://localhost:3000](http://localhost:3000).

### docker-compose example

```yaml
services:
  udm-dns-manager:
    image: apresse/udm-dns-manager:latest
    ports:
      - "3000:3000"
    environment:
      UDM_API_URL: https://192.168.1.1
      UDM_API_KEY: your-api-key
      UDM_API_SITE_ID: your-site-uuid        # optional
      NPM_IP: 192.168.1.x                    # optional
      NPM_USERNAME: admin@example.com        # optional
      NPM_PASSWORD: your-npm-password        # optional
      NPM_ACCESS_LIST_NAME: Local Net or Basic  # optional
      CRON_INTERVAL_MINUTES: 10              # optional
    restart: unless-stopped
```

### Dockerfile highlights

| Practice | Detail |
|----------|--------|
| Multi-stage build | `deps → builder → runner` — final image contains only runtime files |
| Non-root user | Runs as `nextjs:nodejs` (UID/GID 1001) |
| Standalone output | `next build` with `output: "standalone"` — no `node_modules` in runner |
| No build-time secrets | Env vars are injected at container start, never baked into the image |
| Health check | Docker polls `GET /` every 30 s with a 5 s timeout |
| Minimal base | `node:22-alpine` — small attack surface, 0 known vulnerabilities |

### Docker Hub

Published images are available at [`apresse/udm-dns-manager`](https://hub.docker.com/r/apresse/udm-dns-manager).

```bash
docker pull apresse/udm-dns-manager:latest
```

Each GitHub release is tagged with the release version (e.g. `apresse/udm-dns-manager:v1.0.0`) and also updates the `latest` tag.

---

## CI/CD

A GitHub Actions workflow (`.github/workflows/release.yml`) triggers on every published GitHub release:

1. Builds the Docker image from the repo root (multi-stage `Dockerfile`)
2. Pushes two tags to Docker Hub:
   - `apresse/udm-dns-manager:<release-tag>` (e.g. `v1.2.0`)
   - `apresse/udm-dns-manager:latest`

**Required repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|-------|
| `DOCKERHUB_USERNAME` | `apresse` |
| `DOCKERHUB_TOKEN` | Docker Hub access token (Account Settings → Security → New Access Token) |

---

## API routes

All routes are Next.js Route Handlers. UniFi and NPM clients are **server-side only** and never exposed to the browser.

### DNS

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/dns` | List all DNS records |
| `POST` | `/api/dns` | Create a new record |
| `GET` | `/api/dns/:id` | Get a single record |
| `PUT` | `/api/dns/:id` | Update a record |
| `DELETE` | `/api/dns/:id` | Delete a record |

### Cron / NPM sync

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/cron` | Return last sync status and timestamp |
| `POST` | `/api/cron` | Trigger an immediate NPM → UDM sync |

Errors are returned as `{ "error": "message" }` with HTTP 500.

---

## Available scripts

Run from the `app/` directory.

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Turbopack) on port 3000 |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
