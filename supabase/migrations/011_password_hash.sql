-- ============================================================
-- Migration 011: add password_hash column
-- Run after 010_app_access.sql if you created the table without it.
-- Safe to run even if the column already exists.
-- ============================================================

ALTER TABLE app_access ADD COLUMN IF NOT EXISTS password_hash TEXT;
