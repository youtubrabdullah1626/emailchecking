-- ============================================================================
-- Migration: Add config_history and flag_history tables
-- Description: Creates immutable change tracking tables for Platform Configs and Feature Flags
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.config_history (
    id TEXT PRIMARY KEY,
    config_id TEXT NOT NULL REFERENCES public.platform_configs(id) ON DELETE CASCADE,
    old_value JSONB NOT NULL,
    new_value JSONB NOT NULL,
    reason TEXT,
    is_rollback BOOLEAN NOT NULL DEFAULT false,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS config_history_config_id_changed_at_idx ON public.config_history(config_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS public.flag_history (
    id TEXT PRIMARY KEY,
    flag_id TEXT NOT NULL REFERENCES public.feature_flags(id) ON DELETE CASCADE,
    old_value JSONB NOT NULL,
    new_value JSONB NOT NULL,
    reason TEXT,
    is_rollback BOOLEAN NOT NULL DEFAULT false,
    changed_by TEXT NOT NULL,
    changed_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS flag_history_flag_id_changed_at_idx ON public.flag_history(flag_id, changed_at DESC);
