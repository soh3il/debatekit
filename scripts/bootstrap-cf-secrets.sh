#!/usr/bin/env bash
# bootstrap-cf-secrets.sh — upload each worker's .dev.vars to Cloudflare as
# real secrets via `wrangler secret put`, one --env at a time.
# Skips blank lines, comments, and `<PENDING:*>` / empty values.
# Usage: ./scripts/bootstrap-cf-secrets.sh [--app NAME] [--env preview|prod|both] [--dry-run] [--yes]
# Works with bash 3.2 (macOS stock).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_ACCOUNT_ID="c21c4d074e34a8b1b9d335a41c2f69e3"

# Parallel arrays: APP_KEYS[i] → APP_DIRS[i].
APP_KEYS=(api  web      mcp      slack                  telegram                  whatsapp)
APP_DIRS=(apps/api apps/web apps/mcp integrations/slack integrations/telegram integrations/whatsapp)

# Resolve "app key" → dir.
app_dir() {
  local key="$1" i
  for i in "${!APP_KEYS[@]}"; do
    if [ "${APP_KEYS[$i]}" = "$key" ]; then echo "${APP_DIRS[$i]}"; return 0; fi
  done
  return 1
}

# Resolve preview|prod → wrangler env name.
wrangler_env() {
  case "$1" in preview) echo "preview" ;; prod) echo "production" ;; *) return 1 ;; esac
}

# --- args ---
APP_FILTER=""; ENV_CHOICE="both"; DRY_RUN=0; ASSUME_YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --app)     APP_FILTER="${2:-}"; shift 2 ;;
    --env)     ENV_CHOICE="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    --yes|-y)  ASSUME_YES=1; shift ;;
    -h|--help) sed -n '2,6p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

case "$ENV_CHOICE" in preview|prod|both) ;; *) echo "ERR: --env preview|prod|both" >&2; exit 2 ;; esac
if [ -n "$APP_FILTER" ] && ! app_dir "$APP_FILTER" >/dev/null; then
  echo "ERR: --app must be one of: ${APP_KEYS[*]}" >&2; exit 2
fi

if [ "$ENV_CHOICE" = "both" ]; then ENV_TARGETS=(preview prod); else ENV_TARGETS=("$ENV_CHOICE"); fi
if [ -n "$APP_FILTER" ]; then APP_TARGETS=("$APP_FILTER"); else APP_TARGETS=("${APP_KEYS[@]}"); fi

# --- color ---
if [ -t 1 ]; then
  C_R=$'\033[0m'; C_D=$'\033[2m'; C_B=$'\033[1m'
  C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YLW=$'\033[33m'; C_BLU=$'\033[34m'
else C_R=""; C_D=""; C_B=""; C_RED=""; C_GRN=""; C_YLW=""; C_BLU=""; fi
warn() { printf "%s[warn]%s %s\n" "$C_YLW" "$C_R" "$*" >&2; }
err()  { printf "%s[err]%s %s\n"  "$C_RED" "$C_R" "$*" >&2; }
ok()   { printf "%s[ok]%s %s\n"   "$C_GRN" "$C_R" "$*"; }

# --- preflight: wrangler binary + auth + account ---
if command -v wrangler >/dev/null 2>&1; then WRANGLER=(wrangler)
elif command -v bunx >/dev/null 2>&1;     then WRANGLER=(bunx wrangler)
elif command -v npx  >/dev/null 2>&1;     then WRANGLER=(npx --yes wrangler)
else err "wrangler not found and no bunx/npx available"; exit 1; fi

printf "%sChecking wrangler auth...%s\n" "$C_B" "$C_R"
WHOAMI="$("${WRANGLER[@]}" whoami 2>&1 || true)"
if echo "$WHOAMI" | grep -qiE "not.*authenticated|run.*wrangler login|you are not"; then
  err "wrangler is not logged in. Run 'wrangler login' or set CLOUDFLARE_API_TOKEN."; exit 1
fi
if echo "$WHOAMI" | grep -q "$EXPECTED_ACCOUNT_ID"; then
  ok "wrangler account matches expected ($EXPECTED_ACCOUNT_ID)"
else
  warn "Expected account $EXPECTED_ACCOUNT_ID not seen in 'wrangler whoami'."
  warn "Set CLOUDFLARE_ACCOUNT_ID or pick the right account."
  if [ $ASSUME_YES -eq 0 ]; then
    read -r -p "Continue anyway? [y/N] " ans; [[ "$ans" =~ ^[Yy]$ ]] || { err "Aborted."; exit 1; }
  fi
fi

# --- parse .dev.vars → key=value lines, skipping placeholders ---
parse_dev_vars() {
  local f="$1"; [ -f "$f" ] || return 0
  awk '
    { sub(/\r$/, ""); l=$0; sub(/^[[:space:]]+/, "", l)
      if (l == "" || l ~ /^#/) next
      eq = index(l, "="); if (eq == 0) next
      k = substr(l, 1, eq - 1); v = substr(l, eq + 1)
      sub(/[[:space:]]+$/, "", k); sub(/^[[:space:]]+/, "", v)
      if (length(v) >= 2) {
        a = substr(v, 1, 1); b = substr(v, length(v), 1)
        if ((a == "\"" && b == "\"") || (a == "'\''" && b == "'\''")) v = substr(v, 2, length(v) - 2)
      }
      if (v == "" || v ~ /^<PENDING:/) next
      print k "=" v
    }' "$f"
}
count_skipped() {
  local f="$1"; [ -f "$f" ] || { echo 0; return; }
  awk '{ sub(/\r$/, ""); l=$0; sub(/^[[:space:]]+/, "", l)
    if (l == "" || l ~ /^#/) next
    eq = index(l, "="); if (eq == 0) next
    v = substr(l, eq + 1); sub(/^[[:space:]]+/, "", v)
    if (v == "" || v ~ /^<PENDING:/) print
  }' "$f" | awk 'END { print NR }'
}

# --- plan ---
# Stash per-(app,env) counts in simple variables: PLAN_<app>_<env> etc.
# (We sanitise keys to make valid var names.)
set_count() { eval "$1=\"$2\""; }
get_count() { eval "printf '%s' \"\${$1:-0}\""; }

TOTAL=0
for app in "${APP_TARGETS[@]}"; do
  dir="$(app_dir "$app")"
  f="${REPO_ROOT}/${dir}/.dev.vars"
  if [ ! -f "$f" ]; then set_count "MISSING_${app}" 1; continue; fi
  n=$(parse_dev_vars "$f" | awk 'END { print NR }')
  s=$(count_skipped "$f")
  for e in "${ENV_TARGETS[@]}"; do
    set_count "PLAN_${app}_${e}" "$n"
    set_count "SKIP_${app}_${e}" "$s"
    TOTAL=$((TOTAL + n))
  done
done

echo ""
printf "%sPlan%s %s(dry-run: %d)%s\n" "$C_B" "$C_R" "$C_D" "$DRY_RUN" "$C_R"
printf "  %-10s %-10s %8s %8s\n" "APP" "ENV" "UPLOAD" "SKIP"
for app in "${APP_TARGETS[@]}"; do
  if [ "$(get_count "MISSING_${app}")" = "1" ]; then
    printf "  %-10s %-10s %8s %8s  %s(no .dev.vars; skipping)%s\n" "$app" "-" "-" "-" "$C_D" "$C_R"
    continue
  fi
  for e in "${ENV_TARGETS[@]}"; do
    printf "  %-10s %-10s %8s %8s\n" "$app" "$e" \
      "$(get_count "PLAN_${app}_${e}")" "$(get_count "SKIP_${app}_${e}")"
  done
done
echo ""; printf "Total uploads planned: %s%d%s\n\n" "$C_B" "$TOTAL" "$C_R"

if [ "$TOTAL" -eq 0 ]; then
  warn "Nothing to upload. Fill .dev.vars (remove <PENDING:*> placeholders)."; exit 0
fi
if [ $DRY_RUN -eq 0 ] && [ $ASSUME_YES -eq 0 ]; then
  read -r -p "Upload these secrets now? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { err "Aborted."; exit 1; }
fi

# --- execute ---
FAILURES=()
for app in "${APP_TARGETS[@]}"; do
  [ "$(get_count "MISSING_${app}")" = "1" ] && continue
  dir="${REPO_ROOT}/$(app_dir "$app")"; f="${dir}/.dev.vars"
  for e in "${ENV_TARGETS[@]}"; do
    wenv="$(wrangler_env "$e")"
    echo ""; printf "%s== %s → %s (wrangler --env=%s) ==%s\n" "$C_BLU" "$app" "$e" "$wenv" "$C_R"
    while IFS= read -r pair; do
      [ -z "$pair" ] && continue
      key="${pair%%=*}"; value="${pair#*=}"
      if [ $DRY_RUN -eq 1 ]; then
        printf "  %s[dry-run]%s would put %s%s%s (%d chars)\n" "$C_D" "$C_R" "$C_B" "$key" "$C_R" "${#value}"
        set_count "DONE_${app}_${e}" "$(( $(get_count "DONE_${app}_${e}") + 1 ))"; continue
      fi
      if (cd "$dir" && printf '%s' "$value" | "${WRANGLER[@]}" secret put "$key" --env "$wenv" >/dev/null 2>&1); then
        ok "  put ${key}"
        set_count "DONE_${app}_${e}" "$(( $(get_count "DONE_${app}_${e}") + 1 ))"
      else
        err "  FAILED to put ${key} (re-running with output)"
        (cd "$dir" && printf '%s' "$value" | "${WRANGLER[@]}" secret put "$key" --env "$wenv" || true)
        set_count "FAIL_${app}_${e}" "$(( $(get_count "FAIL_${app}_${e}") + 1 ))"
        FAILURES+=("${app}/${e}/${key}")
      fi
    done < <(parse_dev_vars "$f")
  done
done

# --- summary ---
echo ""; printf "%sSummary%s\n" "$C_B" "$C_R"
printf "  %-10s %-10s %8s %8s %8s\n" "APP" "ENV" "UPLOAD" "SKIP" "FAIL"
for app in "${APP_TARGETS[@]}"; do
  [ "$(get_count "MISSING_${app}")" = "1" ] && continue
  for e in "${ENV_TARGETS[@]}"; do
    printf "  %-10s %-10s %8s %8s %8s\n" "$app" "$e" \
      "$(get_count "DONE_${app}_${e}")" "$(get_count "SKIP_${app}_${e}")" "$(get_count "FAIL_${app}_${e}")"
  done
done

if [ "${#FAILURES[@]}" -gt 0 ]; then
  echo ""; err "${#FAILURES[@]} failure(s):"
  for x in "${FAILURES[@]}"; do err "  - $x"; done
  exit 1
fi
echo ""
if [ $DRY_RUN -eq 1 ]; then ok "Dry run complete. Re-run without --dry-run to apply."
else ok "All secrets uploaded."; fi
