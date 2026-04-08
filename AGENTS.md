# AGENTS.md — udm-dns-updater

## Purpose

Web UI for managing DNS records on a Ubiquiti UniFi Dream Machine (UDM) via the UniFi Network Integration API. The app lists, creates, updates, and deletes DNS policy records through a Next.js frontend that proxies requests to the UDM REST API.

A scheduled sync job also pulls proxy host entries from **Nginx Proxy Manager (NPM)** and automatically creates matching DNS records on the UDM for hosts under a specific access list.

---

## Project Structure

```
udm-dns-updater/
├── AGENTS.md                   ← this file
├── Dockerfile                  ← multi-stage Docker build (context = repo root)
├── README.md
├── .github/
│   └── workflows/
│       └── release.yml         ← builds + pushes Docker image to Hub on release
├── api_refs/
│   └── Unifi.postman_collection.json  ← UniFi API reference (Postman)
└── app/                        ← Next.js 16 application (all source lives here)
    ├── package.json
    ├── tailwind.config.ts
    ├── tsconfig.json
    └── src/
        ├── app/
        │   ├── globals.css      ← CSS variables (design tokens) + Tailwind base
        │   ├── layout.tsx
        │   ├── page.tsx         ← renders <DnsTable />
        │   └── api/
        │       ├── dns/
        │       │   ├── route.ts         GET (list) + POST (create)
        │       │   └── [id]/route.ts    GET + PUT (update) + DELETE
        │       └── cron/
        │           └── route.ts     GET (status) + POST (trigger sync)
        ├── components/
        │   ├── DnsTable.tsx         ← main page: table, bulk-delete, enable toggle, "Run Job" button
        │   ├── CreateRecordModal.tsx ← modal for creating a new record
        │   └── RecordDetailModal.tsx ← modal for viewing/editing/deleting a record
        └── lib/
            ├── cron.ts       ← in-process cron scheduler + NPM→UDM sync logic
            ├── npm.ts        ← Nginx Proxy Manager API client (auth, proxy hosts, access lists)
            ├── types.ts      ← DnsRecord interface + DNS_TYPES constant
            ├── unifi.ts      ← all UniFi API calls (fetch wrappers, server-side only)
            └── validation.ts ← validateValue / valuePlaceholder / valueLabel helpers
```

---

## Architecture

### Data flow

```
Browser (React) → /api/dns routes (Next.js Route Handlers) → unifi.ts → UDM REST API
                   /api/cron route  → cron.ts → npm.ts → NPM REST API
                                              → unifi.ts → UDM REST API
```

- `unifi.ts` and `npm.ts` are **server-side only** (called from Route Handlers / cron, never imported by client components).
- Components call `/api/dns` and `/api/dns/:id` via `fetch` from the browser.
- `export const dynamic = "force-dynamic"` is set on all route files to prevent caching.

### NPM → UDM sync flow

1. `cron.ts` runs on a timer (`CRON_INTERVAL_MINUTES`, default 10) or via `POST /api/cron`.
2. `npm.ts` authenticates to NPM (`POST /api/tokens` with JWT caching), fetches access lists, and fetches proxy hosts.
3. Proxy hosts are filtered to those whose access list name matches `NPM_ACCESS_LIST_NAME` (default `"Local Net or Basic"`) and are enabled.
4. Each domain from matching NPM hosts is compared against existing UDM DNS records.
5. Missing domains get a new DNS record: **A_RECORD** pointing to `NPM_IP`.

### UniFi API endpoints used

Base URL from `UDM_API_URL` env var (e.g. `https://192.168.10.1` or a hostname).

| Operation     | Method | Path                                                                 |
|---------------|--------|----------------------------------------------------------------------|
| List sites    | GET    | `/proxy/network/integration/v1/sites`                                |
| List records  | GET    | `/proxy/network/integration/v1/sites/{siteId}/dns/policies`          |
| Get record    | GET    | `/proxy/network/integration/v1/sites/{siteId}/dns/policies/{id}`     |
| Create record | POST   | `/proxy/network/integration/v1/sites/{siteId}/dns/policies`          |
| Update record | PUT    | `/proxy/network/integration/v1/sites/{siteId}/dns/policies/{id}`     |
| Delete record | DELETE | `/proxy/network/integration/v1/sites/{siteId}/dns/policies/{id}`     |

Authentication is via the `X-API-KEY` header.

---

## Environment Variables

Must be set at runtime for the app to function:

| Variable                | Required | Description                                                              |
|-------------------------|----------|--------------------------------------------------------------------------|
| `UDM_API_URL`           | Yes      | Base URL of the UDM (e.g. `https://router.home.example.com`)             |
| `UDM_API_KEY`           | Yes      | API key generated in the UniFi dashboard                                 |
| `UDM_API_SITE_ID`       | No       | Site UUID. If omitted, auto-discovered by calling the `/sites` endpoint. |
| `NPM_IP`                | Yes*     | IP address of the Nginx Proxy Manager instance (used as http://<ip>:81) |
| `NPM_USERNAME`          | Yes*     | NPM login email                                                          |
| `NPM_PASSWORD`          | Yes*     | NPM login password                                                       |
| `NPM_ACCESS_LIST_NAME`  | No       | Access list to filter by (default: `"Local Net or Basic"`)               |
| `CRON_INTERVAL_MINUTES` | No       | Sync interval in minutes (default: `10`)                                 |

\* Required only if using the NPM sync feature.

---

## Tech Stack

- **Next.js 16** (App Router) with **React 19**
- **TypeScript 5**
- **Tailwind CSS 3** with a custom design-token theme (dark-only, UniFi-branded)
- No external component library; all UI is hand-built

---

## Design System

All colors are defined as CSS variables in `globals.css` and referenced as Tailwind tokens:

| Token              | CSS Variable          | Usage                        |
|--------------------|-----------------------|------------------------------|
| `background`       | `--background`        | Page background (`#1a1a2e`)  |
| `surface`          | `--surface`           | Card / modal background      |
| `surface-raised`   | `--surface-raised`    | Input backgrounds            |
| `surface-hover`    | `--surface-hover`     | Hover states                 |
| `border`           | `--border`            | All borders                  |
| `text-secondary`   | `--text-secondary`    | Label text                   |
| `text-tertiary`    | `--text-tertiary`     | Placeholder / muted text     |
| `unifi-blue`       | `--unifi-blue`        | Primary action color         |
| `danger`           | `--danger`            | Destructive actions          |
| `success`          | `--success`           | Success / enabled states     |

Reusable input class pattern (defined inline in modal components):
```ts
const inputClass = "mt-1.5 w-full h-10 px-3 bg-surface-raised border border-border rounded-lg text-sm text-foreground placeholder:text-text-tertiary focus:outline-none focus:border-unifi-blue focus:ring-1 focus:ring-unifi-blue/30 transition-colors";
```

---

## Key Domain Types

```ts
// lib/types.ts
interface DnsRecord {
  _id?: string; id?: string; key?: string;  // at least one is present per record
  enabled: boolean;
  domain: string;
  type: string;                   // one of DNS_TYPES
  ipv4Address?: string;           // A_RECORD
  ipv6Address?: string;           // AAAA_RECORD
  value?: string;                 // CNAME / MX / TXT / SRV / FORWARD_DOMAIN
  ttlSeconds?: number;
  // ...priority, weight, port for SRV
}

const DNS_TYPES = [
  "A_RECORD", "AAAA_RECORD", "CNAME_RECORD",
  "MX_RECORD", "TXT_RECORD", "SRV_RECORD", "FORWARD_DOMAIN"
]
```

**Record ID resolution**: use `record._id || record.id || record.key` — the API may return any of the three.

**Value field mapping** when sending to the API:
- `A_RECORD` → `ipv4Address`
- `AAAA_RECORD` → `ipv6Address`
- Everything else → `value`

---

## Dev Commands

All commands run from `app/`:

```bash
npm run dev    # start dev server on http://localhost:3000
npm run build  # production build
npm run lint   # ESLint
```

Set env vars before running:
```bash
export UDM_API_URL=https://<udm-host>
export UDM_API_KEY=<api-key>
export UDM_API_SITE_ID=<site-uuid>        # optional
export NPM_IP=<npm-ip-address>
export NPM_USERNAME=<email>
export NPM_PASSWORD=<password>
export CRON_INTERVAL_MINUTES=5            # optional
npm run dev
```

Docker build (from repo root):
```bash
docker build -t udm-dns-updater .
```

Published Docker image: `apresse/udm-dns-manager` on Docker Hub.

CI/CD: `.github/workflows/release.yml` triggers on GitHub release publish → builds and pushes `apresse/udm-dns-manager:<tag>` and `apresse/udm-dns-manager:latest`. Requires `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` repository secrets.

---

## Important Conventions

1. **No state management library** — component-local `useState` only.
2. **No server components** for data fetching — pages use client components that call the API routes via `fetch`.
3. **Modals close on backdrop click** and stop event propagation on the inner panel.
4. `fetchRecords()` is always called after any mutation (create / update / delete / toggle) to refresh the table.
5. **Validation** lives entirely in `lib/validation.ts`. Never duplicate regex logic in components.
6. The `unifi.ts` module throws on non-OK HTTP responses; Route Handlers catch and return `{ error: message }` with a 500 status.
7. All API IDs must be passed through `encodeURIComponent()` before use in URL paths (already done in `unifi.ts`).
8. **No test suite** currently exists.
9. `npm.ts` caches the JWT token in-process and refreshes it automatically when it's about to expire.
10. The sync job only **creates** records — it never updates or deletes existing UDM DNS records. Matching is done by domain name (case-insensitive).
