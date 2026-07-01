# QR Pay

QR Pay is a solo hackathon entry for the **DevCareer x Nomba Hackathon 2026**.

## Structure

This is a monorepo containing:

- `apps/api` — NestJS backend (TypeORM/PostgreSQL, BullMQ/Redis, Nomba API integration)
- `apps/web` — Next.js frontend (not yet scaffolded)

## Prerequisites

- Node.js 20+
- Docker (for local Postgres + Redis)

## Getting started

1. Copy the environment files and fill in the values:

   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   ```

2. Start Postgres and Redis:

   ```bash
   docker compose up -d
   ```

3. Install API dependencies:

   ```bash
   cd apps/api
   npm install
   ```

4. Start the API in dev mode:

   ```bash
   npm run start:dev
   ```
