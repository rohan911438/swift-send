SwiftSend backend prototype

Quickstart (prototype):

1. Install deps

```bash
cd backend
npm install
```

2. Run

```bash
npm run dev
```

This prototype exposes:
- `POST /transfers` — create transfer (idempotent via `idempotency_key`)
- `GET /transfers/:id` — fetch transfer
- `POST /escrow/:transferId/release` — release escrow (demo)
- `POST /escrow/:transferId/refund` — refund escrow (demo)

Notes:
- This is a local prototype with in-memory stores for demo and testing the frontend integration. Replace with Postgres, real ledger and KMS in production.
- Sensitive user fields are encrypted in-memory before storage using AES-256-GCM. In production, set `DATA_ENCRYPTION_KEY` and replace the in-memory session store with a persistent, key-managed repository.

Project structure (prototype)
- `src/app.ts` - builds Fastify app and registers routes/plugins
- `src/index.ts` - process entrypoint (starts app)
- `src/routes/` - HTTP route modules per domain (`health`, `transfers`, `escrow`)
- `src/services/` - domain services (ledger, escrow, transfer orchestration)
- `migrations/` - SQL migrations for reference (replace with real migration tooling)

Next steps to move toward production
- Replace in-memory services with Postgres-backed repositories (use `migrations/001_init.sql`)
- Add worker queue (BullMQ/Kafka) for settlement and reconciliation
- Integrate Stellar SDK inside settlement worker and switch from simulated settlement to real submission and monitoring
- Add KMS/HSM for private key management and secure signing
- Add observability (OpenTelemetry, metrics, tracing) and structured logging

