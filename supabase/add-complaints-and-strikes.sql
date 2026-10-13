-- Migration: Add complaints_notes and complaint_strikes to commercial_accounts
-- Allows tracking up to 5 SLA strikes with dates (valid until 2026-12-31) and notes
ALTER TABLE public.commercial_accounts
  ADD COLUMN IF NOT EXISTS complaints_notes text,
  ADD COLUMN IF NOT EXISTS complaint_strikes jsonb;
