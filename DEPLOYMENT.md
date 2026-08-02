# Deployment Guide — Outreach Automation System

## Quick Reference

| Component | Value |
|---|---|
| Framework | Next.js 14 |
| Database | Supabase (PostgreSQL via Prisma) |
| Email | Gmail API via OAuth 2.0 |
| AI | Gemini (optional) |
| Cron | Vercel Cron (`*/15 * * * *`) |
| Auth | Secret header (`SCHEDULER_SECRET`) |

---

## Pre-Deployment Checklist

### 1. Environment Variables

Copy `.env.example` to `.env.local` (local) or configure in Vercel Dashboard (production).

**Required variables:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase pooled connection string (port 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | Supabase direct connection string (port 5432, for migrations) |
| `GMAIL_CLIENT_ID` | Google Cloud OAuth 2.0 Client ID |
| `GMAIL_CLIENT_SECRET` | Google Cloud OAuth 2.0 Client Secret |
| `GMAIL_REFRESH_TOKEN` | Long-lived refresh token (from OAuth flow) |
| `GMAIL_SENDER_EMAIL` | The Gmail address that sends emails |
| `SCHEDULER_SECRET` | Random secret for API authentication (see below) |

**Optional variables:**

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Enables AI-powered reply classification (Phase 7) |
| `CRON_SECRET` | Set automatically by Vercel — do NOT set manually |

**Generating `SCHEDULER_SECRET`:**
```bash
openssl rand -hex 32
```

### 2. Database Migration

Run the Phase 11 migration to add retry tracking fields:

**Option A — Supabase SQL Editor (recommended):**
Copy the contents of `prisma/migrations/20260728_add_retry_fields/migration.sql` into the Supabase SQL Editor and run it.

**Option B — Prisma CLI (requires `DIRECT_URL`):**
```bash
npx prisma migrate deploy
```

### 3. Gmail OAuth Setup

Run the OAuth authorization flow once on your local machine:
```bash
npm run oauth:generate
```
Follow the printed URL, authorize in your browser, and copy the refresh token into `GMAIL_REFRESH_TOKEN`.

---

## Vercel Deployment

### First Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel deploy --prod
```

### Environment Variables

Set all required variables in the Vercel Dashboard:
`Project → Settings → Environment Variables`

Or via CLI:
```bash
vercel env add SCHEDULER_SECRET production
vercel env add GMAIL_CLIENT_ID production
vercel env add GMAIL_CLIENT_SECRET production
vercel env add GMAIL_REFRESH_TOKEN production
vercel env add GMAIL_SENDER_EMAIL production
vercel env add DATABASE_URL production
vercel env add DIRECT_URL production
```

### Vercel Cron

The `vercel.json` file configures an automatic cron job:
```json
{ "crons": [{ "path": "/api/cron/scheduler", "schedule": "*/15 * * * *" }] }
```

Vercel automatically authenticates cron calls with `CRON_SECRET`.
Verify the cron is active in:
`Vercel Dashboard → Project → Cron Jobs`

---

## External Cron (Non-Vercel)

For Railway, Render, VPS, or cron-job.org:

**cron-job.org setup:**
- URL: `https://your-domain.com/api/cron/scheduler`
- Method: `GET` or `POST`
- Header: `Authorization: Bearer <SCHEDULER_SECRET>`
- Interval: Every 15 minutes

**GitHub Actions:**
```yaml
name: Scheduler
on:
  schedule:
    - cron: '*/15 * * * *'
jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST https://your-domain.com/api/cron/scheduler \
            -H "Authorization: Bearer ${{ secrets.SCHEDULER_SECRET }}"
```

---

## Protected API Endpoints

All operational endpoints require `Authorization: Bearer <SCHEDULER_SECRET>`:

| Endpoint | Method | Action |
|---|---|---|
| `/api/scheduler/run` | POST | Claim due steps |
| `/api/scheduler/drain` | POST | Reset PROCESSING steps (dev only) |
| `/api/gmail/send` | POST | Send claimed steps |
| `/api/gmail/send-now` | POST | Immediate send |
| `/api/replies/scan` | POST | Scan Gmail for replies |
| `/api/sequences/[id]/retry` | POST | Retry FAILED steps |

**Unprotected endpoints (safe to expose):**

| Endpoint | Description |
|---|---|
| `GET /api/health` | Liveness probe — no data |

**Example authenticated call:**
```bash
curl -X POST https://your-domain.com/api/scheduler/run \
  -H "Authorization: Bearer your-scheduler-secret"
```

---

## First-Run Checklist

After deploying, verify the system:

1. **Health check:**
   ```bash
   curl https://your-domain.com/api/health
   # Expected: { "status": "ok", "version": "0.1.0" }
   ```

2. **Auth test (expect 401):**
   ```bash
   curl -X POST https://your-domain.com/api/scheduler/run
   # Expected: { "error": "UNAUTHORIZED" }
   ```

3. **Auth test with secret (expect 200):**
   ```bash
   curl -X POST https://your-domain.com/api/scheduler/run \
     -H "Authorization: Bearer your-secret"
   # Expected: { "status": "SUCCESS", "candidatesFound": 0 }
   ```

4. **Dashboard:** Navigate to `/dashboard` — confirm scheduler health shows "IDLE".

5. **Cron:** Wait up to 15 minutes and check Vercel Cron logs for a successful invocation.

---

## Disaster Recovery

### Stuck PROCESSING Steps

If steps are stuck in PROCESSING (confirmed: email was NOT delivered):
```bash
# Dev only — resets all PROCESSING steps to PENDING
curl -X POST http://localhost:3000/api/scheduler/drain \
  -H "Authorization: Bearer your-secret"
```

In production, use the Supabase SQL editor:
```sql
-- ONLY run if you are certain the email was NOT delivered
UPDATE sequence_steps
SET status = 'PENDING'
WHERE status = 'PROCESSING'
AND id = 'YOUR_STEP_ID_HERE';
```

### Retry FAILED Steps

```bash
curl -X POST https://your-domain.com/api/sequences/SEQUENCE_ID/retry \
  -H "Authorization: Bearer your-secret" \
  -H "Content-Type: application/json" \
  -d '{"stepIds": ["step-id-1", "step-id-2"]}'
```

### Gmail OAuth Expired

If `invalid_grant` errors appear:
1. Run `npm run oauth:generate` locally
2. Update `GMAIL_REFRESH_TOKEN` in Vercel environment variables
3. Redeploy: `vercel deploy --prod`
