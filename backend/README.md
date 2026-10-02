# Offline Field Issue Tracker Backend

Express REST API with SQLite persistence, Zod request validation, idempotent offline synchronization, and an auditable report workflow.

## Requirements

- Node.js 18.18 or newer
- npm 9 or newer

## Setup

```powershell
cd "C:\Users\Admin\Documents\Weder Internship\backend"
npm install
Copy-Item .env.example .env
npm run db:init
npm run db:seed
npm start
```

The API listens on `http://localhost:3000` by default. The health endpoint is `GET /health`.

Run the automated integration tests:

```powershell
npm test
```

The Jest/Supertest suite uses a disposable SQLite database and covers FSM
transitions, idempotent retries, audit-history persistence, and validation
failures without touching the development database.

For development with automatic restarts:

```powershell
npm run dev
```

To recreate the database and seed it from scratch:

```powershell
npm run db:reset
```

`DATABASE_FILE` may be an absolute path or a path relative to the `backend` directory. The database directory is created automatically.

## Project structure

```text
backend/
├── prisma/
│   └── seed.js                 # Realistic sample reports in every status
├── scripts/
│   ├── init-db.js              # Creates schema and indexes
│   └── reset-db.js             # Deletes database, initializes, and seeds
├── src/
│   ├── app.js                  # Express app and middleware
│   ├── server.js               # Process entry point
│   ├── config/env.js           # Environment configuration
│   ├── database/
│   │   ├── connection.js       # better-sqlite3 connection
│   │   ├── migrations.js       # Schema DDL
│   │   └── repositories.js     # Prepared SQL data access
│   ├── controllers/
│   │   ├── reportController.js
│   │   └── syncController.js
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   ├── notFound.js
│   │   └── validate.js
│   ├── routes/
│   │   ├── reportRoutes.js
│   │   └── syncRoutes.js
│   ├── services/
│   │   ├── reportService.js
│   │   └── syncService.js
│   ├── utils/
│   │   ├── errors.js
│   │   └── ids.js
│   └── validators/
│       └── reportSchemas.js
└── package.json
```

## API examples

Create/synchronize a report. The endpoint accepts this single-report payload; a bounded
`{ "items": [...] }` batch wrapper is also supported:

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "Idempotency-Key" = "sync-command-001"
}
$body = @{
  items = @(
    @{
      id = "0f2b5b62-3b44-4c74-9b0e-3cc6b2fdb1cb"
      category = "water_pump"
      description = "Pump is leaking at the north access point"
      location = @{
        latitude = 51.501
        longitude = -0.141
        accuracy = 12
        source = "gps"
      }
      priority = "high"
      status = "submitted"
      reported_at = "2026-10-02T10:42:00Z"
    }
  )
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/reports/sync -Headers $headers -Body $body
```

Useful endpoints:

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness and database status |
| POST | `/api/reports/sync` | Batch or individual idempotent synchronization |
| GET | `/api/reports` | Filtered, paginated report list |
| GET | `/api/reports/:id` | Single report |
| PATCH | `/api/reports/:id/status` | Validated workflow transition |
| GET | `/api/reports/:id/history` | Chronological audit timeline |

## Workflow

Allowed transitions are:

```text
draft -> submitted
submitted -> assigned | rejected
assigned -> in_progress | rejected
in_progress -> resolved
```

Every accepted transition writes the report update and `report_history` row in one transaction. Synchronization requires `Idempotency-Key`; replaying a key returns the original outcome and never creates a duplicate report.

## Error contract

Errors use this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "fieldErrors": {},
    "requestId": "..."
  }
}
```

Validation errors are `422`, stale or invalid workflow transitions are `400`, missing idempotency headers are `400`, and unexpected server failures are `500`.
