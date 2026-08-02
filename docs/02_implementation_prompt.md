# Implementation Prompt for Antigravity AI

You are building a **personal outreach automation system** from scratch.

## Important Instruction
Use open-source repositories only as **references**, never as something to blindly copy. The codebase must be **clean, original, and easy to maintain**.

## Primary Objective
Create a system where the user can:
1. Add a prospect manually.
2. Choose the timezone manually.
3. Write Email 1 + Follow-up #1 + Follow-up #2 + Follow-up #3 once.
4. Set send time or delay for each step.
5. Start the sequence.
6. Let the system automatically send emails at the right time.
7. Detect replies from Gmail.
8. Stop all future follow-ups when a real reply is received.

## Tech Direction
Build a clean full-stack app with:
- Frontend dashboard
- Supabase/PostgreSQL database
- Gmail API integration
- Background scheduler / worker
- Optional Gemini reply classification layer

## Functional Requirements
### Prospect Form
Fields:
- name
- company
- email
- timezone (manual selection)
- notes

### Sequence Builder
Fields for each step:
- subject
- body
- delay or scheduled time
- enabled/disabled

Need support for at least:
- Email 1
- Follow-up #1
- Follow-up #2
- Follow-up #3

### Sequence Execution
- Save sequence to database.
- Convert local schedule to stored schedule.
- Send automatically when due.
- Write every action to an email event log.

### Reply Detection
- Read Gmail threads.
- Match replies to the correct prospect.
- Detect if reply is real.
- Cancel all remaining follow-ups after a real reply.
- Update UI status immediately.

### Dashboard
Show:
- prospects list
- active sequences
- today’s due emails
- sent emails
- replied leads
- stopped sequences
- hot leads

## Data Model Guidance
Suggested tables:
- prospects
- sequences
- sequence_steps
- email_events
- reply_events
- settings

## UI Guidance
Keep the UI simple:
- left side navigation
- main workspace
- clear status chips
- easy add prospect flow
- sequence editor with step cards
- timeline view for scheduled sends

## Coding Standards
- use readable names
- avoid over-engineering
- keep functions small
- separate UI logic from business logic
- separate scheduling from reply detection
- separate database access from UI
- add comments only where helpful
- do not create confusing abstractions

## Build Order
1. Database schema
2. Prospect creation UI
3. Sequence builder UI
4. Scheduler
5. Gmail send integration
6. Gmail reply detection
7. Stop-on-reply logic
8. Dashboard status updates
9. Final cleanup and testing

## Done Means
The app is successful when:
- a user can build a sequence once
- the system sends it automatically
- follow-ups stop when a reply is received
- no manual daily checking is required
- the code remains easy to understand and extend
