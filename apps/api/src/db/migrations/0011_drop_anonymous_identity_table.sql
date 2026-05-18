-- Migration: Drop anonymous_identity table
-- Phase 3 of anonymous auth migration: custom anonymous_identity table
-- is no longer needed since Better Auth's anonymous plugin manages
-- anonymous users directly in the user table with isAnonymous flag.

DROP TABLE IF EXISTS `anonymous_identity`;
