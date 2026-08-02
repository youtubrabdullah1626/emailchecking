# Project State Memory

## 1. Project Overview
**Purpose:** An automated, state-driven email outreach system that schedules and sends sequences via Gmail, automatically detecting and classifying replies using AI to halt sequences.
**Current Architecture:** Serverless architecture built on Next.js 14, using Vercel for hosting and cron jobs. Database operations are handled by Prisma ORM connecting to a Supabase PostgreSQL instance.
**Technology Stack:** Next.js 14 (App Router), React 18, TypeScript, Supabase (PostgreSQL), Prisma ORM, Gmail API, Gemini AI.
**Design Principles:** Deterministic state transitions, immutable audit logs, atomic scheduling operations, and strict data integrity.
**Deterministic Rules:** Pure functions handle state transitions (e.g., Sequence & Step statuses). No orphan records (cascade deletes enforced). Enums are the single source of truth. Timezones use exact IANA identifiers.
**AI Boundaries:** AI (Gemini) is strictly scoped to reading and classifying received Gmail replies. It does not mutate core state autonomously or dispatch emails without explicit sequence configurations.
**Current Deployment Model:** Vercel (Next.js app + serverless API endpoints + Vercel Cron), Supabase (PostgreSQL database).

## 2. Completed Phases
* **Phase 1: Foundation & Schema** (100%): Implemented the core 5 tables with strict enums. Set up cascade deletes and precise timezone handling. Important files: `prisma/schema.prisma`.
* **Phase 5+: Gmail Integration** (100%): Integrated Gmail API via OAuth 2.0. Handles message sending, thread tracking, and ID storage for reply detection. Important files: `src/lib/gmail/sender.ts`, `src/lib/gmail/oauth.ts`.
* **Phase 7: AI Reply Detection** (100%): Gemini integration classifies Gmail replies into categories (REAL_REPLY, AUTO_REPLY, etc.) and halts active sequences appropriately. Important files: `src/lib/intelligence/`, `src/lib/reply/`.
* **Phase 8: State Machine** (100%): Implemented deterministic transition validation for Sequence and Step statuses, rejecting illegal state changes before DB writes. Important files: `src/lib/state-machine.ts`.
* **Phase 11: Retry Tracking** (100%): Added manual retry functionality for FAILED steps, tracking retry counts and timestamps.
* **Phase 12: Enterprise Operations** (100%): Implemented `system_errors`, `email_accounts` (reputation protection), and `audit_logs`.

## 3. Current Architecture
* **Database:** Supabase PostgreSQL managed strictly via Prisma ORM.
* **Scheduler:** Triggered by Vercel Cron (`*/15 * * * *`), uses atomic DB updates to claim `PENDING` steps into `PROCESSING` state before dispatch.
* **Gmail:** Handles OAuth 2.0 flow, dispatching emails, and retrieving threads.
* **Reply Detection:** Periodically scans Gmail threads linked to sent steps and uses Gemini AI to determine if a reply requires sequence termination.
* **Dashboard:** Next.js UI providing admin controls, prospect management, and sequence tracking.
* **APIs:** Serverless endpoints protected by a `SCHEDULER_SECRET` bearer token for operational tasks.
* **AI Advisory Layer:** Analyzes incoming replies to output a `ReplyType`, confidence score, and recommended action.
* **Security:** Server-side secrets, Bearer token auth for system endpoints, structured error handling.
* **State Machine:** Pure logic layer enforcing terminal states and valid transition paths.

## 4. Database Summary
* **Tables:** `prospects`, `sequences`, `sequence_steps`, `email_events` (immutable audit log), `reply_classifications`, `system_errors`, `email_accounts`, `audit_logs`.
* **Enums:** `ProspectStatus`, `SequenceStatus`, `StepStatus`, `EmailEventType`, `ReplyType`, `ReviewStatus`, `SystemErrorSeverity`, `AuditActionType`.
* **Relationships:** `Prospect` (1:1) `Sequence` (1:N) `SequenceStep` (1:N) `EmailEvent`. `Prospect` (1:N) `ReplyClassification`.
* **Important Indexes/Constraints:** Unique `email` on Prospects, unique `prospect_id` on Sequence (enforcing 1:1), unique `[sequence_id, step_number]` on SequenceStep, cascade deletes across the hierarchy.

## 5. Folder Map
* `prisma/` → Database schema, migrations, and seed logic.
* `src/app/` → Next.js App Router (pages, layouts, and API routes).
* `src/components/` → React UI components.
* `src/lib/auth/` → Authentication utilities (e.g., Scheduler secret validation).
* `src/lib/db/` → Prisma client initialization and database helpers.
* `src/lib/gmail/` → Gmail API interactions (OAuth, sender, message fetcher).
* `src/lib/intelligence/` → Gemini AI integration for analyzing replies.
* `src/lib/reply/` → Logic for polling Gmail and classifying threads.
* `src/lib/reputation/` → Email sending limits and account health tracking.
* `src/lib/scheduler/` → Core scheduler engine (claims, eligibility, run loops).
* `src/lib/validations/` → Schema and payload validations for API routes.

## 6. Major Components
* **Scheduler Engine:** Safely claims due sequence steps via atomic database operations to prevent duplicate sends.
* **Gmail Sender:** Dispatches claimed steps through the Gmail API and records `gmail_thread_id` for reply tracking.
* **Reply Scanner:** Scans known Gmail threads for new messages and triggers the AI Advisory Layer.
* **State Machine:** Enforces strict transition rules (e.g., a `SENT` step cannot become `PENDING`) independently of DB constraints.
* **Reputation Engine:** Protects email deliverability by enforcing hourly/daily limits (`email_accounts` table).

## 7. Existing APIs
* `POST /api/scheduler/run` — Claims due steps and processes them.
* `POST /api/scheduler/drain` — Dev endpoint to reset stuck `PROCESSING` steps.
* `POST /api/gmail/send` — Sends specifically claimed steps.
* `POST /api/gmail/send-now` — Immediate execution of a step.
* `POST /api/replies/scan` — Scans Gmail threads for new replies.
* `POST /api/sequences/[id]/retry` — Resets a `FAILED` step to `PENDING` for retry.
* `GET /api/health` — Public liveness probe.

## 8. Current Features
* **Completed:** Full data schema, sequence scheduling and dispatch, atomic scheduler, Gmail OAuth/sending, AI reply classification, reputation tracking, immutable audit logging, state machine enforcement.
* **Partially Complete:** Dashboard and admin interfaces (infrastructure present, may need refinement).
* **Not Started:** Multi-tenant user authentication, A/B step testing, automated sequence copy generation.

## 9. Current Known Limitations
* **Single Sender Constraint:** Currently relies on environment variables (`GMAIL_SENDER_EMAIL`, `GMAIL_REFRESH_TOKEN`) for a single sender account, limiting multi-tenant scale.
* **Scheduler Resolution:** Bound by Vercel Cron's 15-minute resolution limit.
* **Missing User Auth:** Lacks a robust user login system (e.g., Supabase Auth), relying on secrets for admin tasks.

## 10. Production Readiness
* **Completed:** Database, background scheduling, email dispatch, AI integration, strict state controls, deployment configuration (`DEPLOYMENT.md`).
* **Missing:** Comprehensive UI polish and multi-tenant authentication.
* **Deployment Blockers:** None for internal/single-tenant usage. Fully ready for Vercel deployment.

## 11. Development Rules
* **Deterministic Business Logic:** Rely on `state-machine.ts` for status changes.
* **Atomic Transactions:** Use Prisma's atomic features when claiming steps for the scheduler.
* **No Duplicated Logic:** Enums are the sole source of truth for statuses.
* **Strict Typing:** TypeScript throughout; avoid `any`.
* **Server-Side Secrets Only:** No API keys exposed to the Next.js client.
* **Runtime Validation:** Validate API payloads and state transitions before DB operations.
* **Immutable Logs:** `email_events` and `audit_logs` are insert-only.
* **Timezones:** Use exact IANA timezone strings (e.g., `America/New_York`), never abbreviations.

## 12. Coding Standards
* Next.js 14 App Router patterns.
* Prisma ORM for all database access.
* Pure functions for business logic to facilitate testing.
* Centralized error handling and logging (`src/lib/scheduler/logger.ts`, `errors.ts`).

## 13. Next Recommended Phase
* **Multi-Tenant Auth:** Transition the application to support multiple users via Supabase Auth, migrating `GMAIL_REFRESH_TOKEN` from `.env` to a secure, per-user database field.
* **Dashboard Polish:** Surface `system_errors` and `email_accounts` (reputation) data visually on the frontend admin dashboard.
* **Analytics:** Build API routes and UI to display sequence performance (open rates, reply rates) derived from the `email_events` and `reply_classifications` tables.
