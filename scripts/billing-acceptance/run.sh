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
#   1. Apply migrations 20260704000001..3 (skipped if already applied)
#   2. psql acceptance probes: trigger fail-closed behavior, EXECUTE lockdown,
#      counter trigger, sequential limit at 50, dunning branches, unique indexes
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
    supabase/migrations/20260704000003_member_count_trigger_and_guarded_insert.sql; do
    echo "   applying $f"
    "${PSQL[@]}" -f "$f"
  done
  echo "   migrations applied"
fi

echo "== Step 2: DB acceptance probes (trigger behavior, dunning branches, limits) =="
"${PSQL[@]}" -f scripts/billing-acceptance/acceptance.sql

echo "== Step 3: jest integration suites (concurrency race, dunning, webhook) =="
if [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  INTEGRATION_TESTS=1 npx jest --config jest.integration.config.js --runInBand
else
  echo "   SKIPPED — export NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run"
  echo "   (this step contains the true 60-way parallel quota race)"
fi

echo "== Billing acceptance complete =="
