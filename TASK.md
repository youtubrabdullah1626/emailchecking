# 10x Smart & Safe Inbox Rotation Engine: Master Plan & Execution Rules

## Master Directives
1. **Zero Breaking Changes:** Every database and code change must be 100% backwards-compatible with existing single-inbox campaigns and multi-tenant isolation.
2. **Strict Phase Gate:** Never advance to the next phase until the current phase is fully completed and verified.
3. **Data Integrity First:** Sequence state, prospect relationships, and Gmail thread continuity must be strictly preserved under all edge cases.

---

## 6-Phase Execution Roadmap

### Phase 1: Zero-Breaking Schema Evolution
- [x] Add `assigned_sender_email String?` to `model Sequence` in `prisma/schema.prisma`.
- [x] Add compound index `@@index([user_id, assigned_sender_email])` for high-throughput dispatch queries.
- [x] Execute `npx prisma generate` and `npx prisma db push` without touching existing production tables.

### Phase 2: Automated Ramp-Up Warmup Protection
- [x] Update `src/lib/reputation/guard.ts` to calculate dynamic inbox age from `created_at`.
- [x] Implement tiered daily capacity:
  - Days 1–3: Max 10 emails/day
  - Days 4–7: Max 25 emails/day
  - Day 8+: Full capacity (default 50/day or custom limit)
  - `warmup_status: "COMPLETED"` bypass for pre-warmed domains.
- [x] Verify rate-limiting math against timezone midnight resets.

### Phase 3: Sticky Sender & Intelligent Multi-Inbox Dispatcher
- [x] Upgrade sender resolution in `src/lib/gmail/sender.ts`:
  - **Step 1 (First Touch):** Query all `CONNECTED` inboxes for `user_id`. Select the healthiest inbox with lowest `sent_today`. Stamp `assigned_sender_email` on the `Sequence`.
  - **Follow-ups (Step 2+):** Strictly enforce `assigned_sender_email` to preserve Gmail thread IDs and 1-on-1 human conversation context.
  - **Single-Inbox Fallback:** Seamlessly operates for single-inbox users with zero overhead.

### Phase 4: Disconnection & Deletion Guardrails
- [x] Handle auth failures (`invalid_grant` / disconnected state) by transitioning step to `DELAYED` with reason `NEEDS_RECONNECT` and firing system alerts.
- [x] Add/verify explicit deletion confirmation modal in the UI to prevent accidental inbox removals.

### Phase 5: Automated Test Suite & Multi-Tenant Verification
- [x] Create `src/__tests__/sticky-rotation.test.ts` covering:
  - Single-inbox user operation.
  - Multi-inbox Step 1 load balancing across 2+ inboxes.
  - Step 2+ sticky sender consistency.
  - Automated Ramp-Up tier enforcement.
- [x] Run full project test suite (`npm test` - 25/25 suites passing, 541 tests green).

### Phase 6: TypeScript Typecheck, Commit & Production Deploy
- [x] Run `npx tsc --noEmit` to guarantee 100% type safety (0 errors).
- [x] Commit all changes with clean atomic git messages.
- [x] Push to `origin` and `emailchecking:main` for automated Railway deployment.
