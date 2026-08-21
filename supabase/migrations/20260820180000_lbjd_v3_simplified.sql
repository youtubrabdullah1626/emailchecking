-- Add columns to sequence_steps
ALTER TABLE "sequence_steps" ADD COLUMN IF NOT EXISTS "eligible_after_utc" TIMESTAMP(3);
ALTER TABLE "sequence_steps" ADD COLUMN IF NOT EXISTS "soft_sla_deadline" TIMESTAMP(3);
ALTER TABLE "sequence_steps" ADD COLUMN IF NOT EXISTS "claimed_at" TIMESTAMP(3);
ALTER TABLE "sequence_steps" ADD COLUMN IF NOT EXISTS "priority_class" TEXT DEFAULT 'NORMAL';

-- Add columns to email_accounts
ALTER TABLE "email_accounts" ADD COLUMN IF NOT EXISTS "reserved_count" INTEGER NOT NULL DEFAULT 0;

-- Add columns to campaigns
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "last_dispatched_at" TIMESTAMP(3);

-- Add values to StepStatus enum
ALTER TYPE "StepStatus" ADD VALUE IF NOT EXISTS 'RETRYABLE_FAILURE';
ALTER TYPE "StepStatus" ADD VALUE IF NOT EXISTS 'UNCERTAIN';

-- Create send_attempts table
CREATE TABLE IF NOT EXISTS "send_attempts" (
    "id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "sender_email" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "gmail_message_id" TEXT,
    "gmail_thread_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "reconcile_attempts" INTEGER NOT NULL DEFAULT 0,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "send_attempts_pkey" PRIMARY KEY ("id")
);

-- Add explicit ALTER TABLE just in case
ALTER TABLE "send_attempts" ADD COLUMN IF NOT EXISTS "reconcile_attempts" INTEGER NOT NULL DEFAULT 0;

-- Add indexes
CREATE UNIQUE INDEX IF NOT EXISTS "send_attempts_step_id_attempt_number_key" ON "send_attempts"("step_id", "attempt_number");
CREATE INDEX IF NOT EXISTS "send_attempts_attempted_at_status_idx" ON "send_attempts"("attempted_at", "status");
CREATE INDEX IF NOT EXISTS "send_attempts_step_id_idx" ON "send_attempts"("step_id");

CREATE INDEX IF NOT EXISTS "sequence_steps_eligible_after_utc_status_idx" ON "sequence_steps"("eligible_after_utc", "status");
CREATE INDEX IF NOT EXISTS "sequence_steps_claimed_at_status_idx" ON "sequence_steps"("claimed_at", "status");
CREATE INDEX IF NOT EXISTS "sequence_steps_retry_at_status_idx" ON "sequence_steps"("retry_at", "status");

-- Add foreign key
ALTER TABLE "send_attempts" DROP CONSTRAINT IF EXISTS "send_attempts_step_id_fkey";
ALTER TABLE "send_attempts" ADD CONSTRAINT "send_attempts_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "sequence_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- G. Migration safety: ensure retry_count and retry_at exist
ALTER TABLE "sequence_steps" ADD COLUMN IF NOT EXISTS "retry_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sequence_steps" ADD COLUMN IF NOT EXISTS "retry_at" TIMESTAMP(3);
ALTER TABLE "sequence_steps" ADD COLUMN IF NOT EXISTS "last_retry_at" TIMESTAMP(3);

-- Create scheduler_locks table for advisory lock alternative
CREATE TABLE IF NOT EXISTS "scheduler_locks" (
  "lock_name" TEXT PRIMARY KEY,
  "locked_at" TIMESTAMPTZ,
  "locked_until" TIMESTAMPTZ,
  "run_id" TEXT
);
