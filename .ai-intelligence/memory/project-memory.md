# Project Memory

This document stores the high-level project state to maintain context across tasks without wasting tokens.

## Current System State
- **Project:** Outreach Automation System
- **Current Phase:** Phase 12 (Enterprise Observability & Intelligence)
- **Stack:** Next.js, React, Tailwind, Prisma, PostgreSQL (Supabase), Gmail API, Gemini AI.

## Key Architecture Decisions
- **Database:** Uses a 5-table schema (`prospects`, `sequences`, `sequence_steps`, `email_events`, `reply_classifications`).
- **Scheduler:** Robust polling architecture mimicking a state machine.
- **Error Handling:** Centralized API client and Graceful UI Error states.

## Active Guidelines
- Only load necessary context.
- Keep tests passing (currently 100+ tests).
- Maintain 100% type safety (0 TS errors).
