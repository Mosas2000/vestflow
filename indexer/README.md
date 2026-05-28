# VestFlow Event Indexer

Off-chain historical event indexer for the VestFlow Soroban contract.

---

## Architecture

```
Stellar RPC (getEvents)
        │
        ▼
  indexer/src/poller.ts   ← long-lived Node.js process
        │  polls every POLL_INTERVAL_MS, follows cursor pagination
        │  decodes ScVal topics/values to JSON
        │  writes idempotently via INSERT OR IGNORE
        ▼
  vestflow-events.db      ← SQLite (WAL mode)
  schema: schedule_events + checkpoint
        │
        ▼
  indexer/src/server.ts   ← lightweight HTTP query API (:3001)
        │
        ▼
  app/api/events/route.ts ← Next.js proxy route
```

### Why Stellar RPC polling (not Horizon)?

VestFlow uses Soroban smart contracts. Soroban contract events are
accessible via the Stellar RPC `getEvents` endpoint, not the classic
Horizon `/effects` or `/transactions` APIs. Horizon does not surface
custom Soroban contract events.

### Why SQLite?

- Zero infrastructure: works locally without Docker or a cloud DB.
- WAL mode allows concurrent reads (query server) + writes (poller).
- Trivial to swap for Postgres/PlanetScale when scaling up.

---

## Event types

| `event_type`       | Topics parsed              | Notes                          |
|--------------------|----------------------------|--------------------------------|
| `schedule_created` | `[tag, id, grantor, bene]` | Emitted on `create_schedule`   |
| `claimed`          | `[tag, id, bene, amount]`  | Emitted on `claim`; amount in stroops |
| `revoked`          | `[tag, id, grantor]`       | Emitted on `revoke`            |
| `unknown`          | raw JSON stored            | Future-proofs new event types  |

---

## Setup

```bash
cd indexer
cp .env.example .env
# Edit .env — set CONTRACT_ID, RPC_URL, etc.
npm install
```

### Local development

```bash
# Option A: run poller + query server together
npm run dev:all

# Option B: run separately in two terminals
npm run dev          # poller
npm run dev:server   # query HTTP server
```

The Next.js app proxies `/api/events` → `http://localhost:3001/events`.

### Production

Build and run the compiled output:

```bash
npm run build
npm start          # poller (keep alive with PM2 / systemd / fly.io)
npm run start:server  # query server
```

Set `INDEXER_URL` in your Next.js deployment environment to point at
the running query server so `/api/events` resolves correctly.

---

## Query API

Base URL: `http://localhost:3001` (local) or your deployed service URL.

### `GET /health`

```json
{ "ok": true, "checkpoint": 5678901 }
```

### `GET /events`

All parameters optional:

| Param        | Type   | Description                                |
|--------------|--------|--------------------------------------------|
| `address`    | string | Match grantor **or** beneficiary           |
| `grantor`    | string | Exact grantor address match                |
| `beneficiary`| string | Exact beneficiary address match            |
| `event_type` | string | `schedule_created` \| `claimed` \| `revoked` |
| `schedule_id`| number | Filter by schedule ID                      |
| `from_ledger`| number | Lower ledger bound (inclusive)             |
| `to_ledger`  | number | Upper ledger bound (inclusive)             |
| `limit`      | number | Max results (default 50, max 200)          |
| `offset`     | number | Pagination offset (default 0)              |

**Example:**
```
GET /events?address=GABC...&event_type=claimed&limit=20
```

**Response:**
```json
{
  "events": [
    {
      "id": "5678901-0-0",
      "event_type": "claimed",
      "ledger": 5678901,
      "ledger_closed_at": "2025-06-01T12:00:00Z",
      "schedule_id": 7,
      "grantor": null,
      "beneficiary": "GABC...",
      "amount": "5000000",
      "raw_topics": "[\"claimed\",7,\"GABC...\",\"5000000\"]",
      "raw_value": "null",
      "created_at": 1748779200
    }
  ],
  "checkpoint": 5678901
}
```

---

## Idempotency & replay safety

- Each Stellar event has a globally unique `id` (`ledger-txIndex-eventIndex`).
- Inserts use `INSERT OR IGNORE` — re-processing a batch is a no-op.
- The checkpoint is updated after each page, not after the full run.
- On crash, at most one page (≤ 200 events) is re-processed; duplicate
  inserts are discarded automatically.
- To replay from a specific ledger: delete `vestflow-events.db` (or
  `UPDATE checkpoint SET last_ledger = <ledger>`) and set `START_LEDGER`.

---

## Scalability tradeoffs

| Concern             | Current approach         | Scale-up path                  |
|---------------------|--------------------------|--------------------------------|
| Storage             | SQLite on local disk     | Postgres / PlanetScale / Neon  |
| Poller redundancy   | Single process           | Leader election (e.g. Redlock) |
| Query latency       | SQLite sequential reads  | Indexed PG with connection pooling |
| Deployment          | PM2 / fly.io process     | Dedicated microservice / Cloud Run |
| Cron instead of loop| Polling loop in process  | Vercel cron + serverless worker |

---

## Vercel cron integration (optional)

If you prefer a fully serverless approach (no long-lived process):

1. Move the poll logic into `app/api/cron/index-events/route.ts`.
2. Add to `vercel.json`:
   ```json
   { "crons": [{ "path": "/api/cron/index-events", "schedule": "* * * * *" }] }
   ```
3. Use a hosted DB (Neon, Upstash, Supabase) instead of SQLite.

The standalone-process approach in this indexer is easier for local
development and avoids serverless cold-start latency on each poll.