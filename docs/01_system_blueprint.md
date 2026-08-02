# Outreach Automation System Blueprint

## Goal
Build a personal, clean, production-quality outreach system for manual lead entry, manual timezone selection, scheduled email sequences, Gmail sending, reply detection, and automatic sequence stopping on real replies.

This is a **personal system**, not a clone of Apollo or Instantly. Existing open-source repositories may be used **only as reference examples** for architecture patterns, email sequence logic, scheduling, or reply handling. Do **not** copy their structure blindly. Prefer a clean, original implementation.

## Core Product Idea
The user manually:
1. Finds leads.
2. Adds a prospect.
3. Chooses timezone manually.
4. Writes Email 1 + Follow-up #1 + Follow-up #2 + Follow-up #3.
5. Sets send times.
6. Clicks **Start Sequence**.

The system then automatically:
1. Stores the sequence.
2. Sends each email at the scheduled time.
3. Checks Gmail for replies.
4. Uses Gemini only to classify replies if needed.
5. Stops all future follow-ups when a real reply arrives.
6. Keeps a full audit trail in the database.

## What This System Must NOT Become
- Not a full CRM clone.
- Not a lead-finding platform.
- Not a marketing automation monster.
- Not a messy combination of multiple repos.
- Not a tool that sends follow-ups after a real reply.
- Not a system where the user has to re-enter the same data every day.

## User Experience Principles
- Simple first.
- Zero confusion.
- One prospect, one sequence, one clear status.
- Manual control where it matters.
- Automation where repetition is painful.
- Clean dashboard, not clutter.
- Easy to debug.

## Required Functional Modules
### 1) Prospect Management
Each prospect should store:
- full name
- company name
- email address
- timezone chosen manually by the user
- optional notes
- status
- created timestamp

### 2) Sequence Builder
Each prospect can have one outreach sequence with:
- Email 1
- Follow-up #1
- Follow-up #2
- Follow-up #3

Each step should store:
- subject
- body
- delay or scheduled time
- send status
- sent timestamp
- Gmail message/thread identifiers

### 3) Scheduler
A background scheduler must:
- detect pending emails
- send emails at the correct time
- mark them as sent
- skip cancelled steps
- respect the manually chosen timezone

### 4) Gmail Integration
Must support:
- sending through Gmail
- reading inbox replies
- associating replies to the correct prospect/thread
- detecting when a real reply arrives

### 5) Reply Handling
When a reply is received:
- classify it as real reply / auto reply / spam / unsubscribe / not interested / interested / needs human review
- stop all future scheduled follow-ups if the reply is real
- keep the email history intact
- notify the user in the dashboard

### 6) Dashboard
Must show:
- active sequences
- due today
- replied leads
- hot leads
- cancelled sequences
- sent history
- upcoming follow-ups

## Database Requirements
Use a real database. Prefer Supabase/PostgreSQL for the final system.

Suggested core tables:
- prospects
- sequences
- sequence_steps
- email_events
- reply_classifications
- user_settings

## Quality Requirements
- Clean naming.
- No duplicated logic.
- No random state scattered around.
- No broken sequence logic.
- No hidden magic.
- Clear database relationships.
- Easy to extend later.

## Reference Policy
If a repository is used as reference:
- extract only the useful idea
- rewrite it in your own structure
- improve naming
- simplify logic where possible
- keep the final codebase original and clean

## Final Outcome
A small but powerful outreach engine that feels professional, works reliably, and is easy to expand later with AI, analytics, or lead scoring.
