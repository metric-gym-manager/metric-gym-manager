#!/usr/bin/env bash
# Billing DB acceptance runner (plan §4 phases DB/QG + §6.2).
#
# Usage:
#   SUPABASE_DB_URL='postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres' \
#     ./scripts/billing-acceptance/run.sh
#
# Optionally also export NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to
# run the jest integration suites (true 60-way concurrency race, dunning via the
# use case, webhook always-200 contract) in step 3.
#
# Steps:
#   1. Apply base migrations 20260704000001..3 (skipped if already applied)
#   1b. Apply the tier-strategy migrations 20260706000002..20260708000006
#       (skipped when gyms.trial_ends_at already exists; requires a DB at
#       either the base state or the 20260708000002 state)
#   2. psql acceptance probes: trigger fail-closed behavior, EXECUTE lockdown,
#      counter trigger, Lite cap at 100, suspend/trial-expiry branches,
#      unique indexes
#   3. (env-gated) jest integration suites incl. the parallel concurrency race
#
# Run against a project you own; probes create and clean up their own test data.

set -euo pipefail
cd "$(dirname "$0")/../.."

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL (Supabase dashboard > Connect > Direct connection)}"

PSQL=(psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -X -q)

echo "== Step 1: migrations =="
APPLIED=$("${PSQL[@]}" -tAc \
  "SELECT count(*) FROM information_schema.columns WHERE table_name='gyms' AND column_name='subscription_tier'")
if [ "$APPLIED" = "1" ]; then
  echo "   already applied (gyms.subscription_tier exists) — skipping"
else
  for f in \
    supabase/migrations/20260704000001_create_saas_subscriptions.sql \
    supabase/migrations/20260704000002_saas_subscriptions_rls.sql \
    supabase/migrations/20260704000003_member_count_trigger_and_guarded_insert.sql \
    supabase/migrations/20260706000002_rename_tiers_starter_growth.sql \
    supabase/migrations/20260707000001_add_enterprise_tier_growth_cap.sql \
    supabase/migrations/20260708000001_active_member_quota.sql \
    supabase/migrations/20260708000002_growth_cap_150.sql; do
    echo "   applying $f"
    "${PSQL[@]}" -f "$f"
  done
  echo "   base migrations applied"
fi

echo "== Step 1b: tier-strategy migrations (lite/pro/enterprise, trial, suspend) =="
TIER_V2=$("${PSQL[@]}" -tAc \
  "SELECT count(*) FROM information_schema.columns WHERE table_name='gyms' AND column_name='trial_ends_at'")
if [ "$TIER_V2" = "1" ]; then
  echo "   already applied (gyms.trial_ends_at exists) — skipping"
else
  for f in \
    supabase/migrations/20260708000003_rename_tiers_lite_pro_enterprise.sql \
    supabase/migrations/20260708000004_tier_strategy_lite_pro_enterprise.sql \
    supabase/migrations/20260708000005_dunning_suspend_no_free.sql \
    supabase/migrations/20260708000006_trial_expiry_cron.sql; do
    echo "   applying $f"
    "${PSQL[@]}" -f "$f"
  done
  echo "   tier-strategy migrations applied"
fi

echo "== Step 1c: token-billing migration (charge ledger, billing clock, credit rule) =="
TOKEN_V1=$("${PSQL[@]}" -tAc \
  "SELECT count(*) FROM information_schema.columns WHERE table_name='gyms' AND column_name='next_charge_at'")
if [ "$TOKEN_V1" = "1" ]; then
  echo "   already applied (gyms.next_charge_at exists) — skipping"
else
  echo "   applying supabase/migrations/20260709000001_token_billing.sql"
  "${PSQL[@]}" -f supabase/migrations/20260709000001_token_billing.sql
  echo "   token-billing migration applied"
fi

echo "== Step 2: DB acceptance probes (trigger behavior, suspend/trial branches, limits) =="
"${PSQL[@]}" -f scripts/billing-acceptance/acceptance.sql

echo "== Step 3: jest integration suites (concurrency race, dunning, webhook) =="
if [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  INTEGRATION_TESTS=1 npx jest --config jest.integration.config.js --runInBand
else
  echo "   SKIPPED — export NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run"
  echo "   (this step contains the true 60-way parallel quota race)"
fi

echo "== Billing acceptance complete =="
