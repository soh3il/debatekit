#!/usr/bin/env bash
# branch-env.sh — on-demand creation/destruction of per-branch CF resources
# for DebateKit feature branches.
#
# Usage:
#   ./scripts/branch-env.sh create   <branch>           # provision D1+KV per app
#   ./scripts/branch-env.sh deploy   <branch> [<app>]   # deploy 1 or all 6 workers to branch env
#   ./scripts/branch-env.sh destroy  <branch>           # delete all per-branch resources
#   ./scripts/branch-env.sh list                        # show all branch-suffixed resources
#   ./scripts/branch-env.sh cleanup [--older-than=14d]  # purge stale branch resources
#
# Resource naming convention (branch slug = lowercase, [^a-z0-9]→-, max 32 chars):
#   D1:    debatekit-dashboard-db-br-<slug>        (api+mcp share)
#   KV:    debatekit-<app>-kv-br-<slug>            (one per worker)
#   Workers: debatekit-<app>-br-<slug>             (one per worker, on workers.dev)
#   (R2 + Queues skipped — Soheil's CF on Free plan, needs Paid + R2 enable)
#
# Designed to be called either:
#   - manually from local dev when starting a feature branch
#   - from CF Workers Builds' build.command on branch push (auto-provisions on first deploy)
#
# All commands run against Soheil's CF account 67bc7b518b92a0c406ac9b8526ddbb6d.
# Requires wrangler logged in (`wrangler login`).

set -euo pipefail

readonly ACCOUNT_ID="67bc7b518b92a0c406ac9b8526ddbb6d"
readonly REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly APPS=(api mcp web slack telegram whatsapp)

# map app name to its dir (relative to repo root)
app_dir() {
  case "$1" in
    api|mcp|web) echo "apps/$1" ;;
    slack|telegram|whatsapp) echo "integrations/$1" ;;
    *) return 1 ;;
  esac
}

# slugify branch name → lowercase, non-alnum → -, max 32 chars, trim hyphens
slugify() {
  printf '%s' "$1" | tr 'A-Z' 'a-z' | sed 's/[^a-z0-9]/-/g' | sed 's/-\{2,\}/-/g' | sed 's/^-\|-$//g' | cut -c1-32
}

WRANGLER() {
  CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID" \
  unset_var CLOUDFLARE_API_TOKEN \
  bunx wrangler "$@"
}
unset_var() { unset "$1" 2>/dev/null; "$@"; }
WRANGLER() { CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID" bunx wrangler "$@"; }

# require wrangler authed against Soheil's account
require_auth() {
  local who
  who="$(bunx wrangler whoami 2>&1 || true)"
  if ! grep -q "$ACCOUNT_ID" <<< "$who"; then
    echo "ERROR: wrangler is not authed against Soheil's account $ACCOUNT_ID"
    echo "Run: bunx wrangler login"
    exit 2
  fi
}

cmd_create() {
  local branch="$1"
  local slug
  slug="$(slugify "$branch")"
  [ -n "$slug" ] || { echo "ERROR: branch slug empty"; exit 1; }
  echo "=== create per-branch resources for slug=$slug (branch=$branch) ==="
  require_auth

  # one D1 db shared between api + mcp
  local db_name="debatekit-dashboard-db-br-$slug"
  local existing_d1
  existing_d1="$(WRANGLER d1 list --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(next((r['uuid'] for r in d if r.get('name')=='$db_name'), ''))")"
  if [ -n "$existing_d1" ]; then
    echo "  d1: $db_name (exists, id=$existing_d1)"
  else
    echo "  d1: creating $db_name..."
    WRANGLER d1 create "$db_name"
  fi

  # one KV per worker (api/mcp/web/slack/telegram/whatsapp)
  for app in "${APPS[@]}"; do
    local kv_title="debatekit-${app}-kv-br-${slug}"
    local existing_kv
    existing_kv="$(WRANGLER kv namespace list 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(next((n['id'] for n in d if n.get('title')=='$kv_title'), ''))")"
    if [ -n "$existing_kv" ]; then
      echo "  kv: $kv_title (exists, id=$existing_kv)"
    else
      echo "  kv: creating $kv_title..."
      WRANGLER kv namespace create "$kv_title"
    fi
  done

  # run D1 migrations on the new branch db via a throwaway wrangler config
  echo "  migrating $db_name..."
  local db_id
  db_id="$(WRANGLER d1 list --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(next((r['uuid'] for r in d if r.get('name')=='$db_name'), ''))")"
  if [ -z "$db_id" ]; then
    echo "  WARN: couldn't read d1 id; skipping migrate. Run manually:"
    echo "    cd apps/api && bunx wrangler d1 migrations apply $db_name --remote"
  else
    local tmp_config
    tmp_config="$(mktemp).jsonc"
    cat > "$tmp_config" <<EOF
{
  "name": "debatekit-api",
  "main": "worker.ts",
  "account_id": "$ACCOUNT_ID",
  "compatibility_date": "2026-01-20",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "$db_name",
      "database_id": "$db_id",
      "migrations_dir": "$REPO_ROOT/apps/api/src/db/migrations"
    }
  ]
}
EOF
    (cd "$REPO_ROOT/apps/api" && WRANGLER d1 migrations apply "$db_name" --config "$tmp_config" --remote </dev/null)
    rm -f "$tmp_config"
  fi

  echo "✓ branch env ready: $slug"
}

cmd_deploy() {
  local branch="$1"
  local only="${2:-}"
  local slug
  slug="$(slugify "$branch")"
  require_auth

  echo "=== deploy per-branch workers for slug=$slug ==="
  local db_id
  db_id="$(WRANGLER d1 list --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(next((r['uuid'] for r in d if r.get('name')=='debatekit-dashboard-db-br-$slug'), ''))")"
  [ -n "$db_id" ] || { echo "ERROR: D1 db debatekit-dashboard-db-br-$slug not found. Run create first."; exit 1; }

  for app in "${APPS[@]}"; do
    [ -n "$only" ] && [ "$only" != "$app" ] && continue
    local dir kv_title kv_id
    dir="$(app_dir "$app")"
    kv_title="debatekit-${app}-kv-br-${slug}"
    kv_id="$(WRANGLER kv namespace list 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(next((n['id'] for n in d if n.get('title')=='$kv_title'), ''))")"
    [ -n "$kv_id" ] || { echo "  $app: kv namespace missing — skipping. Run create first."; continue; }

    echo "  $app: generating branch-specific wrangler.jsonc.tmp..."
    python3 "$REPO_ROOT/scripts/lib/generate-branch-wrangler.py" \
      --base "$REPO_ROOT/$dir/wrangler.jsonc" \
      --slug "$slug" \
      --db-id "$db_id" \
      --kv-id "$kv_id" \
      --out "$REPO_ROOT/$dir/wrangler.branch.jsonc"

    echo "  $app: deploying..."
    if [ "$app" = "web" ]; then
      # TanStack Start needs the patcher
      (cd "$REPO_ROOT/apps/web" && \
        NODE_OPTIONS='--max-old-space-size=4096' bunx vite build --mode preview && \
        bun run scripts/patch-wrangler-env.ts preview && \
        # override generated wrangler with branch-specific values
        cp "$REPO_ROOT/$dir/wrangler.branch.jsonc" dist/server/wrangler.json.tmp && \
        python3 "$REPO_ROOT/scripts/lib/merge-branch-wrangler.py" dist/server/wrangler.json dist/server/wrangler.json.tmp && \
        rm -f dist/server/wrangler.json.tmp && \
        CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID" bunx wrangler deploy --config dist/server/wrangler.json --keep-vars)
    else
      (cd "$REPO_ROOT/$dir" && \
        CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID" bunx wrangler deploy --config wrangler.branch.jsonc --keep-vars)
    fi

    rm -f "$REPO_ROOT/$dir/wrangler.branch.jsonc"
  done

  echo "✓ branch deploys complete: $slug"
  echo "  URLs: https://debatekit-<app>-br-${slug}.soheil-67b.workers.dev"
}

cmd_destroy() {
  local branch="$1"
  local slug
  slug="$(slugify "$branch")"
  require_auth

  echo "=== destroy per-branch resources for slug=$slug ==="
  echo "(this deletes workers, KV namespaces, and the D1 db — irreversible)"

  # delete workers
  for app in "${APPS[@]}"; do
    local wname="debatekit-${app}-br-${slug}"
    if WRANGLER deployments list --name "$wname" >/dev/null 2>&1; then
      echo "  worker: deleting $wname"
      WRANGLER delete --name "$wname" </dev/null || true
    else
      echo "  worker: $wname (not found, skip)"
    fi
  done

  # delete KV namespaces
  for app in "${APPS[@]}"; do
    local kv_title="debatekit-${app}-kv-br-${slug}"
    local kv_id
    kv_id="$(WRANGLER kv namespace list 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(next((n['id'] for n in d if n.get('title')=='$kv_title'), ''))")"
    if [ -n "$kv_id" ]; then
      echo "  kv: deleting $kv_title ($kv_id)"
      WRANGLER kv namespace delete --namespace-id "$kv_id" </dev/null || true
    fi
  done

  # delete D1
  local db_name="debatekit-dashboard-db-br-${slug}"
  echo "  d1: deleting $db_name"
  WRANGLER d1 delete "$db_name" --skip-confirmation 2>/dev/null || \
    yes y | WRANGLER d1 delete "$db_name" || true

  echo "✓ branch env destroyed: $slug"
}

cmd_list() {
  require_auth
  echo "=== branch-suffixed CF resources on Soheil's account ==="
  echo
  echo "-- D1 dbs --"
  WRANGLER d1 list 2>/dev/null | grep "br-" || echo "  (none)"
  echo
  echo "-- KV namespaces --"
  WRANGLER kv namespace list 2>/dev/null | grep "br-" || echo "  (none)"
  echo
  echo "-- Workers --"
  # listing all workers requires the API; wrangler doesn't have a list-all command
  echo "  (wrangler has no list-workers cmd; use https://dash.cloudflare.com/$ACCOUNT_ID/workers-and-pages)"
}

cmd_cleanup() {
  local older_than="${1:-14d}"
  echo "=== cleanup branch resources older than $older_than ==="
  echo "  (not implemented yet — list manually with 'list' then 'destroy <branch>')"
  echo "  TODO: parse 'updated_at' from wrangler API and bulk-destroy"
}

usage() {
  sed -n '/^# / { s/^# \?//; p; }; /^[^#]/ q' "$0"
}

main() {
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    create)  cmd_create "$@" ;;
    deploy)  cmd_deploy "$@" ;;
    destroy) cmd_destroy "$@" ;;
    list)    cmd_list ;;
    cleanup) cmd_cleanup "$@" ;;
    -h|--help|"") usage ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
