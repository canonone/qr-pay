# QR Pay — Backend API

## Overview

QR Pay is a privacy-preserving merchant payment infrastructure built on Nomba's virtual account and transfer APIs. Merchants generate a QR code per payment session; customers scan and pay via bank transfer. The reconciliation engine automatically handles exact payments, underpayments (top-up flow), and overpayments (auto-refund).

## Tech Stack

- NestJS (Node.js)
- TypeORM + PostgreSQL
- Redis (via BullMQ, for future queue processing)
- Nomba Virtual Account API + Transfer API
- Docker Compose (local dev)
- Railway (production)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| POST | /orders | Create a payment order and provision a virtual account |
| GET | /orders/:id | Get order details with auto-expiry check |
| GET | /orders/:id/summary | Get full payment lifecycle timeline |
| POST | /webhooks/nomba | Nomba webhook receiver (signature verified) |

## Local Development Setup

1. Clone the repo
2. Copy `apps/api/.env.example` to `apps/api/.env` and fill in values
3. From repo root: `docker compose up -d`
4. `cd apps/api && npm install`
5. Run migrations: `npx typeorm-ts-node-commonjs migration:run -d src/data-source.ts`
6. Start dev server: `npm run start:dev`
7. API runs on `http://localhost:3001` (or `PORT` from `.env`)

## Environment Variables

| Variable | Description |
|----------|--------------|
| `DB_HOST` | PostgreSQL host |
| `DB_PORT` | PostgreSQL port |
| `DB_USERNAME` | PostgreSQL username |
| `DB_PASSWORD` | PostgreSQL password |
| `DB_NAME` | PostgreSQL database name |
| `REDIS_URL` | Redis connection URL (for future BullMQ queue processing) |
| `NOMBA_BASE_URL` | Base URL for the Nomba API (e.g. sandbox vs production) |
| `NOMBA_CLIENT_ID` | Nomba API client ID used to obtain access tokens |
| `NOMBA_CLIENT_SECRET` | Nomba API client secret used to obtain access tokens |
| `NOMBA_PARENT_ACCOUNT_ID` | Nomba parent account ID sent as the `accountId` header on API calls |
| `NOMBA_SUB_ACCOUNT_ID` | Nomba sub-account ID under which virtual accounts are provisioned |
| `NOMBA_WEBHOOK_SECRET` | Shared secret used to verify the `nomba-signature` header on incoming webhooks |
| `API_KEY` | Reserved for future API authentication |
| `PORT` | Port the API server listens on |

## Reconciliation Logic

- **Exact payment** → order marked `completed`
- **Underpayment** → order marked `partial`, deficit logged
- **Overpayment** → order marked `completed`, excess automatically refunded to sender's bank account via Nomba Transfer API

## Security

- Webhook signature verified via HMAC-SHA256 using the `nomba-signature` header and `NOMBA_WEBHOOK_SECRET`
- Idempotency enforced via `nombaTransactionId` uniqueness constraint on the `transactions` table
- Credentials loaded via environment variables only, never committed to source

## Architecture Note

Auth is intentionally excluded from v1 scope. Order access is controlled via unguessable UUIDs. Production readiness would require merchant accounts and scoped API keys — documented as a clear next step.
