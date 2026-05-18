#!/usr/bin/env bash
# setup-cf-git-integration.sh — wire Cloudflare Workers Builds git-integration
# for every DebateKit worker so each push to soh3il/debatekit auto-deploys.
#
# IMPORTANT: Cloudflare does NOT (yet) expose a public, documented REST API to
# attach a GitHub repo to a Worker. The dashboard is the only fully-supported
# path. This script does three things:
#
#   1. Generates a clear plan: for each (app × env) what to set in the dashboard
#      (root dir, branch, build command, deploy command, build env vars).
#   2. Prints click-by-click dashboard URLs so setup is one open-tab away.
#   3. Optionally calls the (currently undocumented) Workers Builds endpoint
#      under /accounts/{id}/workers/services/{name}/builds/trigger_config when
#      `--api` is passed. This is best-effort: if Cloudflare returns 404/4xx
#      we log it and continue, leaving the dashboard step as fallback.
#
# Usage:
#   ./scripts/setup-cf-git-integration.sh                  # print plan, no calls
#   ./scripts/setup-cf-git-integration.sh --dry-run        # same as above (alias)
#   ./scripts/setup-cf-git-integration.sh --app web --env preview
#   ./scripts/setup-cf-git-integration.sh --api            # attempt API path
#   ./scripts/setup-cf-git-integration.sh --api --yes      # no prompt
#
# Flags:
#   --app <key>           api|web|mcp|slack|telegram|whatsapp (default: all 6)
#   --env <preview|prod|both>   default: both
#   --api                 attempt API calls (default: plan-only)
#   --dry-run             explicit dry-run; mutually exclusive with --api
#   --yes|-y              skip confirmation prompts
#   -h|--help
#
# Requirements when using --api:
#   - CLOUDFLARE_API_TOKEN   token with "Workers Scripts: Edit" and the
#                            "Workers Builds: Edit" scopes. Create at
#                            https://dash.cloudflare.com/profile/api-tokens
#   - CLOUDFLARE_ACCOUNT_ID  defaults to the value baked into wrangler.jsonc
#                            (c21c4d074e34a8b1b9d335a41c2f69e3).
#
# Idempotency: if a build config already exists, the API call is logged as
# "exists" and skipped. The plan output is always idempotent — re-running it
# just re-prints the same instructions.
#
# Works with bash 3.2 (macOS stock).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ACCOUNT_ID_DEFAULT="c21c4d074e34a8b1b9d335a41c2f69e3"
GITHUB_REPO="soh3il/debatekit"
GITHUB_PROD_BRANCH="main"

# Parallel arrays: APP_KEYS[i] → APP_DIRS[i] → BASE_WORKER_NAMES[i].
# Worker names follow the pattern `<base>-{preview,prod}` (from wrangler.jsonc).
APP_KEYS=(api               web               mcp               slack                  telegram                  whatsapp)
APP_DIRS=(apps/api          apps/web          apps/mcp          integrations/slack     integrations/telegram     integrations/whatsapp)
WORKER_BASES=(debatekit-api debatekit-web     debatekit-mcp     debatekit-slack-bot    debatekit-telegram-bot    debatekit-whatsapp-bot)

# ---- arg parsing ----
APP_FILTER=""; ENV_CHOICE="both"; USE_API=0; DRY_RUN=0; ASSUME_YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --app)     APP_FILTER="${2:-}"; shift 2 ;;
    --env)     ENV_CHOICE="${2:-}"; shift 2 ;;
    --api)     USE_API=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --yes|-y)  ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [ $USE_API -eq 1 ] && [ $DRY_RUN -eq 1 ]; then
  echo "ERR: --api and --dry-run are mutually exclusive" >&2; exit 2
fi
case "$ENV_CHOICE" in preview|prod|both) ;; *) echo "ERR: --env preview|prod|both" >&2; exit 2 ;; esac

# Resolve "app key" → index.
app_index() {
  local key="$1" i
  for i in "${!APP_KEYS[@]}"; do
    if [ "${APP_KEYS[$i]}" = "$key" ]; then echo "$i"; return 0; fi
  done
  return 1
}
if [ -n "$APP_FILTER" ] && ! app_index "$APP_FILTER" >/dev/null; then
  echo "ERR: --app must be one of: ${APP_KEYS[*]}" >&2; exit 2
fi

if [ "$ENV_CHOICE" = "both" ]; then ENV_TARGETS=(preview prod); else ENV_TARGETS=("$ENV_CHOICE"); fi
if [ -n "$APP_FILTER" ]; then APP_TARGETS=("$APP_FILTER"); else APP_TARGETS=("${APP_KEYS[@]}"); fi

# ---- color ----
if [ -t 1 ]; then
  C_R=$'\033[0m'; C_D=$'\033[2m'; C_B=$'\033[1m'
  C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YLW=$'\033[33m'; C_BLU=$'\033[34m'; C_CYN=$'\033[36m'
else C_R=""; C_D=""; C_B=""; C_RED=""; C_GRN=""; C_YLW=""; C_BLU=""; C_CYN=""; fi
warn() { printf "%s[warn]%s %s\n" "$C_YLW" "$C_R" "$*" >&2; }
err()  { printf "%s[err]%s %s\n"  "$C_RED" "$C_R" "$*" >&2; }
ok()   { printf "%s[ok]%s %s\n"   "$C_GRN" "$C_R" "$*"; }
info() { printf "%s[info]%s %s\n" "$C_BLU" "$C_R" "$*"; }

# Map preview|prod → wrangler env name (used inside build command).
wrangler_env() { case "$1" in preview) echo "preview" ;; prod) echo "production" ;; esac; }

# Worker name for (app, env). Mirrors wrangler.jsonc `env.<name>.name`.
worker_name() {
  local app="$1" env="$2" idx; idx="$(app_index "$app")"; local base="${WORKER_BASES[$idx]}"
  case "$env" in preview) echo "${base}-preview" ;; prod) echo "${base}-prod" ;; esac
}

# Build command — runs from the worker's root directory. Workers Builds will
# `cd` into root before executing. We `cd ../..` back to monorepo root so
# `bun install` resolves the workspace, then `cd` back to the worker dir to
# call wrangler with the right wrangler.jsonc. `--keep-vars` preserves the
# runtime secrets uploaded out-of-band via bootstrap-cf-secrets.sh.
build_command_for() {
  local env="$1"; local wenv; wenv="$(wrangler_env "$env")"
  # Note: $(basename ...) at runtime resolves to the worker dir name. We
  # construct the literal string here using the app dir.
  echo "cd ../.. && bun install --frozen-lockfile && cd \$ROOT_DIR && bunx wrangler deploy --env=${wenv} --keep-vars"
}

# Branch matcher Workers Builds uses for non-prod branches:
#   include = "*"  exclude = ["main"]   → every non-main branch deploys preview.
branch_glob_for_env() {
  case "$1" in
    prod)    echo "main" ;;
    preview) echo "* (excluding main)" ;;
  esac
}

# ---- plan output ----
echo ""
printf "%sDebateKit · Workers Builds git-integration setup%s\n" "$C_B" "$C_R"
printf "  repo:        %s\n" "$GITHUB_REPO"
printf "  account:     %s\n" "${CLOUDFLARE_ACCOUNT_ID:-$ACCOUNT_ID_DEFAULT}"
printf "  mode:        %s\n" "$([ $USE_API -eq 1 ] && echo 'API (best-effort, undocumented endpoint)' || echo 'PLAN-ONLY (dashboard checklist)')"
printf "  apps:        %s\n" "${APP_TARGETS[*]}"
printf "  envs:        %s\n" "${ENV_TARGETS[*]}"
echo ""

# Per-worker dashboard URLs + build settings.
ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-$ACCOUNT_ID_DEFAULT}"
print_plan_row() {
  local app="$1" env="$2"
  local idx; idx="$(app_index "$app")"
  local dir="${APP_DIRS[$idx]}"
  local wname; wname="$(worker_name "$app" "$env")"
  local wenv; wenv="$(wrangler_env "$env")"
  local branch; branch="$(branch_glob_for_env "$env")"
  local build_cmd
  build_cmd="cd ../.. && bun install --frozen-lockfile && cd ${dir} && bunx wrangler deploy --env=${wenv} --keep-vars"
  local dash_url="https://dash.cloudflare.com/${ACCOUNT_ID}/workers/services/view/${wname}/production/settings"

  printf "%s── %s · %s ──%s\n" "$C_CYN" "$app" "$env" "$C_R"
  printf "  worker name      %s\n"  "$wname"
  printf "  root directory   %s\n"  "$dir"
  printf "  branch           %s\n"  "$branch"
  printf "  build command    %s%s%s\n" "$C_D" "$build_cmd" "$C_R"
  printf "  build env vars   CI=true\n"
  printf "  dashboard URL    %s\n"  "$dash_url"
  echo ""
}

echo "${C_B}Plan${C_R}"
echo ""
for app in "${APP_TARGETS[@]}"; do
  for env in "${ENV_TARGETS[@]}"; do
    print_plan_row "$app" "$env"
  done
done

# ---- dashboard fallback (default path) ----
if [ $USE_API -eq 0 ]; then
  cat <<EOF
${C_B}Next steps (dashboard path)${C_R}

  Workers Builds does NOT have a documented public API for attaching a repo.
  For each worker above:

    1. Open the dashboard URL.
    2. Settings → Build → Connect (GitHub).
       Authorise the Cloudflare GitHub App for ${GITHUB_REPO} on first run.
    3. Set:
         - Repository:       ${GITHUB_REPO}
         - Production branch: ${GITHUB_PROD_BRANCH}
         - Root directory:    (from plan above)
         - Build command:     (from plan above)
         - Deploy command:    leave blank — the build command already runs deploy
         - Non-prod deploy:   leave blank — same reason
         - Build env vars:    CI=true
    4. Save. First build will trigger on the next push.

  Once all 6 workers are wired, disable .github/workflows/deploy-preview.yml
  and deploy-prod.yml (or keep them and disable Workers Builds — pick one,
  not both, to avoid double deploys). See docs/CF_GIT_INTEGRATION.md §4.

  Re-run with --api to attempt the undocumented API path (best-effort).
EOF
  exit 0
fi

# ---- API path (best-effort) ----
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  err "CLOUDFLARE_API_TOKEN is not set. Required for --api."
  err "Create one at https://dash.cloudflare.com/profile/api-tokens"
  err "Scopes: Workers Scripts:Edit, Workers Builds:Edit (if available)."
  exit 1
fi

if [ $ASSUME_YES -eq 0 ]; then
  printf "%sAbout to call Cloudflare's (undocumented) Workers Builds API for %d worker(s).%s\n" \
    "$C_YLW" "$(( ${#APP_TARGETS[@]} * ${#ENV_TARGETS[@]} ))" "$C_R"
  read -r -p "Continue? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { err "Aborted."; exit 1; }
fi

# Construct trigger_config payload. Field names are best-guess based on the
# dashboard's network panel and may drift; treat any non-2xx as "set this one
# in the dashboard instead". Field reference:
#   build_command       runs in root_dir
#   deploy_command      "" because build_command already deploys
#   root_dir            relative to repo root
#   build_caching       true (default)
#   branch_includes     glob for branches that trigger this config
#   branch_excludes     glob for branches to ignore
#   build_variables     { CI: "true" }
# The endpoint we hit:
#   POST /accounts/{aid}/workers/services/{name}/builds/trigger_config
api_attach_one() {
  local app="$1" env="$2"
  local idx; idx="$(app_index "$app")"
  local dir="${APP_DIRS[$idx]}"
  local wname; wname="$(worker_name "$app" "$env")"
  local wenv; wenv="$(wrangler_env "$env")"
  local build_cmd="cd ../.. && bun install --frozen-lockfile && cd ${dir} && bunx wrangler deploy --env=${wenv} --keep-vars"

  local includes excludes
  case "$env" in
    prod)    includes='["main"]';            excludes='[]' ;;
    preview) includes='["*"]';               excludes='["main"]' ;;
  esac

  # Use a heredoc for the JSON body so it's readable in the script.
  local body
  body=$(cat <<JSON
{
  "repo_connection": { "provider": "github", "repo_name": "${GITHUB_REPO}" },
  "build_command": "${build_cmd}",
  "deploy_command": "",
  "root_dir": "${dir}",
  "build_caching": true,
  "branch_includes": ${includes},
  "branch_excludes": ${excludes},
  "build_variables": { "CI": "true" }
}
JSON
)

  local url="https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/services/${wname}/builds/trigger_config"

  printf "%s→ %s (%s)%s\n" "$C_BLU" "$wname" "$env" "$C_R"

  local resp http_code
  resp=$(curl -sS -o /tmp/cf-builds-resp.$$ -w "%{http_code}" \
    -X POST "$url" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "$body" || true)
  http_code="$resp"

  case "$http_code" in
    2*)
      ok "${wname} configured"
      ;;
    409)
      info "${wname} already has build config — skipped"
      ;;
    404)
      warn "${wname}: endpoint returned 404. This API is undocumented and may have moved."
      warn "Fall back to the dashboard URL printed in the plan above."
      ;;
    401|403)
      err "${wname}: ${http_code} — token missing scope or wrong account."
      err "Body: $(cat /tmp/cf-builds-resp.$$ 2>/dev/null | head -c 400)"
      ;;
    *)
      err "${wname}: HTTP ${http_code}"
      err "Body: $(cat /tmp/cf-builds-resp.$$ 2>/dev/null | head -c 400)"
      ;;
  esac
  rm -f /tmp/cf-builds-resp.$$
}

FAILURES=()
SUCCESSES=()
SKIPPED=()
for app in "${APP_TARGETS[@]}"; do
  for env in "${ENV_TARGETS[@]}"; do
    if api_attach_one "$app" "$env"; then
      SUCCESSES+=("$(worker_name "$app" "$env")")
    else
      FAILURES+=("$(worker_name "$app" "$env")")
    fi
  done
done

# ---- summary ----
echo ""
printf "%sSummary%s\n" "$C_B" "$C_R"
printf "  %-40s %s\n" "WORKER" "STATUS"
for app in "${APP_TARGETS[@]}"; do
  for env in "${ENV_TARGETS[@]}"; do
    wname="$(worker_name "$app" "$env")"
    printf "  %-40s %s\n" "$wname" "(check log above)"
  done
done
echo ""
ok "Done. Verify in the dashboard: https://dash.cloudflare.com/${ACCOUNT_ID}/workers-and-pages"
