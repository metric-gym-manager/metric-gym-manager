-- Migration: Remove installment feature tables
-- Created: 2026-03-20
-- Description: Drop all tables related to installment plan functionality

-- Drop tables in correct order (respect foreign key constraints)
DROP TABLE IF EXISTS installment_payments CASCADE;
DROP TABLE IF EXISTS member_installments CASCADE;
DROP TABLE IF EXISTS installment_templates CASCADE;
