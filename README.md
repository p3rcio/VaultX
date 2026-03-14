# VaultX

Privacy-first, zero-knowledge, end-to-end encrypted file storage & sharing.

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Docker](https://www.docker.com/) & Docker Compose
- npm >= 9

### 1. Clone & install

```bash
git clone <your-repo-url> vaultx
cd vaultx
cp .env.example .env
npm install
```

### 2. Start infrastructure (Postgres + MinIO)

```bash
npm run infra:up
```

This starts:
- **Postgres** on `localhost:5432` (user: `vaultx`, pass: `vaultx_secret`, db: `vaultx`)
- **MinIO** on `localhost:9000` (console: `localhost:9001`, user: `minioadmin`, pass: `minioadmin`)

### 3. Start development servers

```bash
npm run dev
```

This runs both servers concurrently:
- **API** → `http://localhost:4000`
- **Web** → `http://localhost:3000`

The API auto-runs database migrations and creates the MinIO bucket on first start.

### 4. Open the app

Visit `http://localhost:3000` in your browser. Register a new account to get started.

## Environment Variables

See `.env.example` for all available variables. Key ones:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://vaultx:vaultx_secret@localhost:5432/vaultx` | Postgres connection |
| `MINIO_ENDPOINT` | `localhost` | MinIO host |
| `MINIO_PORT` | `9000` | MinIO API port |
| `JWT_SECRET` | `dev-jwt-secret-change-me` | JWT signing secret |
| `API_PORT` | `4000` | API server port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | API URL (browser) |
| `NEXT_PUBLIC_MINIO_URL` | `http://localhost:9000` | MinIO URL (browser) |

## How Uploads Work

1. **Client** generates a random AES-GCM-256 file key
2. **Client** wraps file key with UMK (AES-KW) — server never sees the raw key
3. **Client** splits file into 5 MB chunks
4. Each chunk: random 12-byte IV + AES-GCM encryption → ciphertext uploaded directly to MinIO via presigned URL
5. Progress tracked in IndexedDB for **resume** — if network drops > 10s, upload pauses and resumes automatically
6. On completion, server marks the file as `complete`

## How Resumable Uploads Work

- Each upload is fingerprinted by `filename + size + lastModified`
- Chunk completion tracked in **IndexedDB**
- On page reload or re-selection of the same file, the client:
  1. Detects the existing upload record
  2. Requests presigned URLs for remaining chunks only
  3. Continues from where it left off

## Running Tests

```bash
npm test
```

Runs Jest tests in `apps/api` covering:
- Password validation (length, special chars)
- Share schema validation (expiry bounds, UUID format)
- Token hashing (SHA-256 consistency)
- Lockout duration calculation
- Share expiry logic

## Project Structure

```
├── apps/api/        Express API (auth, files, shares, tags, audit)
├── apps/web/        Next.js frontend (React + Tailwind)
├── packages/shared/ Shared types & validation (zod schemas)
├── infra/           Docker Compose (Postgres + MinIO)
└── docs/            Architecture & evaluation docs
```

## Troubleshooting

### "Connection refused" on API start
Ensure Docker containers are running: `npm run infra:up` then check `docker ps`.

### MinIO CORS errors
The API configures CORS on the MinIO bucket at startup. If issues persist, check that `CORS_ORIGIN` in `.env` matches your web app URL (default: `http://localhost:3000`).

### "File key not found in session"
This happens if you refresh the page mid-upload. The file key is stored in `sessionStorage` per browser tab. Re-select the same file to resume — the upload will continue from the last completed chunk, but you'll need to start the encryption from a fresh session (the wrapped key is on the server).

### Port conflicts
Change `API_PORT` in `.env` if 4000 is taken. Change the Next.js port in `apps/web/package.json` dev script.
