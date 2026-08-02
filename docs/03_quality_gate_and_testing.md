# Quality Gate, Debugging Rules, and Testing Checklist

This file is the guardrail for the outreach system. Use it before merging, refactoring, or shipping anything.

## Non-Negotiable Rules
- Do not send follow-ups after a real reply.
- Do not lose scheduled emails.
- Do not double-send the same step.
- Do not create messy duplicate tables or duplicate state.
- Do not mix timezones incorrectly.
- Do not depend on UI state for core logic.
- Do not make the system harder to debug than necessary.

## Must-Verify Behaviors
### Sequence Logic
- Email 1 is sent once.
- Follow-up #1 only sends after its delay/time.
- Follow-up #2 only sends after Follow-up #1.
- Follow-up #3 only sends after Follow-up #2.
- Sequence stops when appropriate.

### Reply Logic
- Real reply detected.
- Auto-reply ignored or treated separately.
- Spam ignored.
- Unsubscribe or not interested handled safely.
- Remaining steps cancelled after a real reply.

### Scheduling Logic
- Scheduled send times are correct.
- Timezone conversion is correct.
- No duplicate send on retry.
- No skipped send due to bad state.
- Background worker resumes correctly after restart.

### Gmail Integration
- OAuth works.
- Send email works.
- Reply thread matching works.
- Message/thread IDs are stored.
- Gmail rate-limit handling is safe.

### Database Integrity
- Every sequence step belongs to a sequence.
- Every sequence belongs to a prospect.
- Every email event has a traceable origin.
- Cancelled steps stay cancelled.
- Sent steps stay sent.
- No orphan records.

## Testing Checklist
### Unit Tests
- timezone conversion
- schedule calculation
- sequence status transitions
- reply classification mapping
- send/stop decision rules

### Integration Tests
- create prospect
- save sequence
- queue emails
- send one step
- detect reply
- stop remaining steps

### End-to-End Tests
- add prospect manually
- write 4-step sequence
- choose timezone manually
- start sequence
- verify sends happen on schedule
- reply arrives
- verify future follow-ups stop

## Debugging Rules
When something breaks:
1. Inspect database state first.
2. Inspect scheduler logs second.
3. Inspect Gmail thread mapping third.
4. Inspect UI last.

Do not guess. Trace the event chain.

## Quality Bar
The system is ready only when:
- flows are predictable
- statuses are accurate
- the user always knows what is happening
- the code is easy to extend later with AI or analytics
- the app feels like a serious tool, not a prototype

## Final Reminder
The goal is not to build the most complex system.
The goal is to build the **cleanest reliable system** that helps the user send sequences automatically, stop on replies, and stay organized without confusion.
