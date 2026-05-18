#!/usr/bin/env bash
# preflight-check.sh — validate that the DebateKit monorepo is ready for
# `wrangler deploy --env <env>`.
#
# Exit codes:
#   0  all green
#   1  one or more checks failed (or warnings in --strict)
#   2  usage error
#
# This script is READ-ONLY. It never deploys, migrates, or modifies files.
# It is safe to run in CI, on a laptop, or repeatedly.
#
# Bash 3.2 compatible (macOS default). No associative arrays, no `mapfile`.

# Note: deliberately NOT using `set -e` — we want to report every failure,
# not bail on the first one. Each check is wrapped to capture its own status.
set -u
set -o pipefail

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

readonly EXPECTED_ACCOUNT_ID="67bc7b518b92a0c406ac9b8526ddbb6d"
readonly EXPECTED_ACCOUNT_LABEL="Soheil"
readonly EXPECTED_REPO_SSH="git@github.com:soh3il/debatekit.git"
readonly EXPECTED_REPO_HTTPS="https://github.com/soh3il/debatekit.git"
readonly MIN_BUN_MAJOR=1
readonly MIN_BUN_MINOR=3

# Worker directories relative to repo root.
readonly WORKER_DIRS="apps/api apps/mcp apps/web integrations/slack integrations/telegram integrations/whatsapp"
# Workers whose .dev.vars is OPTIONAL (no required SSR secrets).
readonly OPTIONAL_DEVVAR_DIRS="apps/web"

# Resolve repo root from script location so script works from any CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ---------------------------------------------------------------------------
# Flags / defaults
# ---------------------------------------------------------------------------

ENV_NAME=""
WITH_TYPES=0
WITH_DNS=0
JSON_OUT=0
STRICT=0

# ---------------------------------------------------------------------------
# Colors (TTY-aware)
# ---------------------------------------------------------------------------

if [ -t 1 ] && command -v tput >/dev/null 2>&1 && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
  C_RED="$(tput setaf 1)"
  C_GREEN="$(tput setaf 2)"
  C_YELLOW="$(tput setaf 3)"
  C_BLUE="$(tput setaf 4)"
  C_DIM="$(tput dim 2>/dev/null || echo '')"
  C_BOLD="$(tput bold 2>/dev/null || echo '')"
  C_RESET="$(tput sgr0)"
else
  C_RED=""; C_GREEN=""; C_YELLOW=""; C_BLUE=""; C_DIM=""; C_BOLD=""; C_RESET=""
fi

# ---------------------------------------------------------------------------
# Reporting state
# ---------------------------------------------------------------------------

FAIL_COUNT=0
WARN_COUNT=0
PASS_COUNT=0
# JSON accumulator (a flat array of {status,message,detail,fix} objects, written
# at the end if --json is set). We collect as raw lines (one JSON object per
# line) to stay bash-3.2-safe, then assemble with jq.
JSON_LINES_FILE=""

usage() {
  cat <<EOF
${C_BOLD}preflight-check.sh${C_RESET} — validate DebateKit is ready to deploy.

Usage:
  scripts/preflight-check.sh --env <preview|prod> [options]

Required:
  --env <preview|prod>   Target Cloudflare environment.

Options:
  --with-types           Also run \`bun run check-types\` (slow).
  --with-dns             Also verify DNS for debatekit.com.
  --json                 Emit a structured JSON report instead of text.
  --strict               Treat warnings as failures (affects exit code).
  --help                 Show this message.

Exit codes:
  0  all green
  1  any failure (or warning under --strict)
  2  usage error
EOF
}

# ---------------------------------------------------------------------------
# Reporting helpers
# ---------------------------------------------------------------------------

_json_record() {
  # _json_record <status> <message> [detail] [fix]
  # Writes one JSON object per line to JSON_LINES_FILE.
  local status="$1"
  local message="$2"
  local detail="${3:-}"
  local fix="${4:-}"
  if [ -n "${JSON_LINES_FILE}" ]; then
    # jq -n with --arg makes JSON-safe escaping trivial.
    jq -n \
      --arg status "$status" \
      --arg message "$message" \
      --arg detail "$detail" \
      --arg fix "$fix" \
      '{status:$status, message:$message, detail:$detail, fix:$fix}' \
      >>"$JSON_LINES_FILE"
  fi
}

pass() {
  # pass <message>
  PASS_COUNT=$((PASS_COUNT + 1))
  if [ "$JSON_OUT" -eq 0 ]; then
    printf "%s  %s\n" "${C_GREEN}PASS${C_RESET}" "$1"
  fi
  _json_record "pass" "$1" "" ""
}

warn() {
  # warn <message> [fix-hint]
  WARN_COUNT=$((WARN_COUNT + 1))
  if [ "$JSON_OUT" -eq 0 ]; then
    printf "%s  %s\n" "${C_YELLOW}WARN${C_RESET}" "$1"
    if [ -n "${2:-}" ]; then
      printf "      ${C_DIM}fix:${C_RESET} %s\n" "$2"
    fi
  fi
  _json_record "warn" "$1" "" "${2:-}"
}

fail() {
  # fail <message> [fix-hint]
  FAIL_COUNT=$((FAIL_COUNT + 1))
  if [ "$JSON_OUT" -eq 0 ]; then
    printf "%s  %s\n" "${C_RED}FAIL${C_RESET}" "$1"
    if [ -n "${2:-}" ]; then
      printf "      ${C_DIM}fix:${C_RESET} %s\n" "$2"
    fi
  fi
  _json_record "fail" "$1" "" "${2:-}"
}

info() {
  # info <message> — neutral status line (no count change).
  if [ "$JSON_OUT" -eq 0 ]; then
    printf "%s  %s\n" "${C_BLUE}INFO${C_RESET}" "$1"
  fi
}

# Multi-line detail printer for failures (e.g. the list of PENDING vars).
# Truncates at 10 items to keep output readable; total count is preserved.
print_detail_list() {
  # print_detail_list "label" <items...>
  local label="$1"; shift
  local total=$#
  local shown=0
  local item
  if [ "$JSON_OUT" -eq 0 ]; then
    for item in "$@"; do
      shown=$((shown + 1))
      if [ "$shown" -gt 10 ]; then
        printf "      ${C_DIM}… and %d more${C_RESET}\n" $((total - 10))
        break
      fi
      printf "      - %s\n" "$item"
    done
  fi
  # Always record the full list to JSON when enabled.
  if [ -n "${JSON_LINES_FILE}" ] && [ $total -gt 0 ]; then
    # Append to the most recent JSON record by rewriting its `detail`.
    # Cheap approach: emit a sibling object with the full list.
    local joined
    joined="$(printf '%s\n' "$@")"
    jq -n \
      --arg label "$label" \
      --arg items "$joined" \
      '{status:"detail", label:$label, items:($items | split("\n"))}' \
      >>"$JSON_LINES_FILE"
  fi
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

while [ $# -gt 0 ]; do
  case "$1" in
    --env)
      shift
      [ $# -gt 0 ] || { echo "error: --env requires a value" >&2; usage >&2; exit 2; }
      ENV_NAME="$1"
      ;;
    --env=*)
      ENV_NAME="${1#--env=}"
      ;;
    --with-types) WITH_TYPES=1 ;;
    --with-dns)   WITH_DNS=1 ;;
    --json)       JSON_OUT=1 ;;
    --strict)     STRICT=1 ;;
    --help|-h)    usage; exit 0 ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

case "${ENV_NAME}" in
  preview|prod) ;;
  "")
    echo "error: --env is required (preview|prod)" >&2
    usage >&2
    exit 2
    ;;
  *)
    echo "error: --env must be 'preview' or 'prod', got: ${ENV_NAME}" >&2
    exit 2
    ;;
esac

# Initialise JSON sink once flags are parsed.
if [ "$JSON_OUT" -eq 1 ]; then
  JSON_LINES_FILE="$(mktemp -t preflight-json.XXXXXX)"
  # shellcheck disable=SC2064
  trap "rm -f '${JSON_LINES_FILE}'" EXIT
fi

if [ "$JSON_OUT" -eq 0 ]; then
  printf "\n${C_BOLD}DebateKit preflight${C_RESET} — env=%s%s%s\n\n" \
    "${C_BLUE}" "${ENV_NAME}" "${C_RESET}"
fi

# ---------------------------------------------------------------------------
# 1. Tooling
# ---------------------------------------------------------------------------

check_tool_version_min() {
  # check_tool_version_min "bun" "1.3"
  local name="$1"
  local out major minor
  if ! command -v "$name" >/dev/null 2>&1; then
    fail "$name not installed" "install $name — see https://bun.sh / https://stedolan.github.io/jq/ as appropriate"
    return
  fi
  out="$("$name" --version 2>&1 | head -1 | tr -d 'v ')"
  major="${out%%.*}"
  local rest="${out#*.}"
  minor="${rest%%.*}"
  # Numeric sanity — if parsing failed, just report present.
  case "$major" in ''|*[!0-9]*) pass "$name $out (version-unparsed)"; return;; esac
  case "$minor" in ''|*[!0-9]*) minor=0;; esac
  if [ "$major" -gt $MIN_BUN_MAJOR ] || { [ "$major" -eq $MIN_BUN_MAJOR ] && [ "$minor" -ge $MIN_BUN_MINOR ]; }; then
    pass "$name $out"
  else
    fail "$name $out is below required ${MIN_BUN_MAJOR}.${MIN_BUN_MINOR}" \
         "upgrade with: curl -fsSL https://bun.sh/install | bash"
  fi
}

check_tool_present() {
  # check_tool_present "git" "git --version"
  local name="$1"
  local cmd="$2"
  local out
  if ! command -v "$name" >/dev/null 2>&1; then
    fail "$name not installed" "install $name (Homebrew: brew install $name)"
    return
  fi
  out="$(eval "$cmd" 2>&1 | head -1)"
  pass "$out"
}

check_wrangler_present() {
  # wrangler is per-project (via bunx), so test via bunx.
  local out
  if ! command -v bun >/dev/null 2>&1; then
    fail "wrangler check skipped — bun missing"
    return
  fi
  out="$(cd "$REPO_ROOT" && bunx wrangler --version 2>&1 | tail -1)"
  if [ $? -ne 0 ] || [ -z "$out" ]; then
    fail "wrangler not available via bunx" \
         "from repo root: bun install (wrangler is a dev dependency)"
    return
  fi
  pass "wrangler $out"
}

info "1/10  Tooling"
check_tool_version_min "bun"
check_wrangler_present
check_tool_present "git" "git --version"
check_tool_present "jq" "jq --version"

# ---------------------------------------------------------------------------
# 2. CWD is the debatekit repo
# ---------------------------------------------------------------------------

info "2/10  Repository identity"
check_repo_identity() {
  if ! (cd "$REPO_ROOT" && git rev-parse --is-inside-work-tree >/dev/null 2>&1); then
    fail "not inside a git repository (${REPO_ROOT})" \
         "clone soh3il/debatekit and run this from that checkout"
    return
  fi
  local url=""
  url="$(cd "$REPO_ROOT" && git remote get-url debatekit 2>/dev/null || true)"
  if [ -z "$url" ]; then
    url="$(cd "$REPO_ROOT" && git remote get-url origin 2>/dev/null || true)"
  fi
  if [ -z "$url" ]; then
    fail "no 'debatekit' or 'origin' git remote configured" \
         "git remote add debatekit ${EXPECTED_REPO_SSH}"
    return
  fi
  case "$url" in
    "$EXPECTED_REPO_SSH"|"$EXPECTED_REPO_HTTPS"|"${EXPECTED_REPO_HTTPS%.git}")
      pass "cwd: debatekit repo (${url})"
      ;;
    *)
      fail "git remote points elsewhere: ${url}" \
           "git remote add debatekit ${EXPECTED_REPO_SSH}"
      ;;
  esac
}
check_repo_identity

# ---------------------------------------------------------------------------
# 3. Cloudflare login (correct account)
# ---------------------------------------------------------------------------

info "3/10  Cloudflare authentication"
check_cf_account() {
  if ! command -v bun >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
    warn "skipping Cloudflare whoami — bun or jq missing"
    return
  fi
  local raw account
  raw="$(cd "$REPO_ROOT" && bunx wrangler whoami 2>&1 || true)"
  # `wrangler whoami` doesn't support --json reliably across versions. Parse the
  # ID out of the human table instead: the account ID is the only 32-hex token.
  account="$(printf "%s" "$raw" | grep -Eo '[a-f0-9]{32}' | head -1 || true)"
  if [ -z "$account" ]; then
    fail "not logged in to Cloudflare (no account ID found)" \
         "bunx wrangler login   (use Soheil's Cloudflare account)"
    return
  fi
  if [ "$account" = "$EXPECTED_ACCOUNT_ID" ]; then
    pass "cloudflare account: ${account:0:8}… (${EXPECTED_ACCOUNT_LABEL})"
  else
    fail "cloudflare account mismatch (got ${account:0:8}…, expected ${EXPECTED_ACCOUNT_ID:0:8}… = ${EXPECTED_ACCOUNT_LABEL})" \
         "bunx wrangler logout && bunx wrangler login   (then pick ${EXPECTED_ACCOUNT_LABEL}'s account)"
  fi
}
check_cf_account

# ---------------------------------------------------------------------------
# 4. .dev.vars: present and no <PENDING:...> placeholders
# ---------------------------------------------------------------------------

info "4/10  .dev.vars completeness"

is_optional_devvars_dir() {
  local d="$1" candidate
  for candidate in $OPTIONAL_DEVVAR_DIRS; do
    [ "$d" = "$candidate" ] && return 0
  done
  return 1
}

check_devvars() {
  local dir="$1"
  local path="${REPO_ROOT}/${dir}/.dev.vars"
  if [ ! -f "$path" ]; then
    if is_optional_devvars_dir "$dir"; then
      pass "${dir}/.dev.vars not present (optional, skipped)"
      return
    fi
    fail "${dir}/.dev.vars missing" \
         "cp ${dir}/.dev.vars.example ${dir}/.dev.vars && fill in values"
    return
  fi

  # Build a list of vars that are pending or empty. Bash 3.2 — no arrays of
  # variable-length safely, so accumulate into a newline-separated string.
  local pending=""
  local count=0
  local line key value
  # Read with a while-loop fed by command substitution + redirected file.
  while IFS= read -r line; do
    # Skip comments and blank lines.
    case "$line" in
      ''|\#*) continue ;;
    esac
    # Lines look like KEY=VALUE (= may be in value; only first counts).
    case "$line" in
      *=*) ;;
      *) continue ;;
    esac
    key="${line%%=*}"
    value="${line#*=}"
    # Trim trailing whitespace, leading/trailing quotes.
    value="${value#\"}"; value="${value%\"}"
    value="${value#\'}"; value="${value%\'}"
    # Trim trailing CR (Windows line endings).
    value="${value%$'\r'}"
    case "$value" in
      ''|'<PENDING:'*|'<PENDING '*|'<change-me>'|'<get-from-'*|'<generate-with-'*)
        pending="${pending}${key}
"
        count=$((count + 1))
        ;;
    esac
  done <"$path"

  if [ "$count" -eq 0 ]; then
    pass "${dir}/.dev.vars: all values populated"
    return
  fi

  fail "${dir}/.dev.vars: ${count} PENDING/empty vars" \
       "open ${dir}/.dev.vars and fill the keys listed below"

  # Split newline string back into args for the printer.
  # Use a subshell with IFS=newline to be bash-3.2 safe.
  ( IFS='
'
    set -- $pending
    print_detail_list "${dir}/.dev.vars pending" "$@"
  )
}

for d in $WORKER_DIRS; do
  check_devvars "$d"
done

# ---------------------------------------------------------------------------
# 5. Cloudflare resources exist (D1, R2, KV)
# ---------------------------------------------------------------------------

info "5/10  Cloudflare resources"

# We discover required KV namespace IDs from the wrangler.jsonc files and then
# verify each ID exists in `wrangler kv namespace list`. D1 and R2 are checked
# by name against a fixed list per env (also cross-referenced against config).

# Strip JSONC comments and trailing commas so jq can parse it.
strip_jsonc() {
  # Uses a small Python tokenizer that respects string literals — naive regex
  # stripping breaks on strings like "**/*.wasm" or "https://...".
  # Falls back to `cat` if python3 is unavailable (jq will then warn loudly).
  python3 - "$1" <<'PY' 2>/dev/null || cat "$1"
import sys
with open(sys.argv[1], 'r') as f:
    src = f.read()
out = []
i, n = 0, len(src)
in_str = False
str_quote = ''
while i < n:
    ch = src[i]
    nxt = src[i+1] if i+1 < n else ''
    if in_str:
        out.append(ch)
        if ch == '\\' and i+1 < n:
            out.append(nxt); i += 2; continue
        if ch == str_quote:
            in_str = False
        i += 1; continue
    # Not in a string.
    if ch == '"' or ch == "'":
        in_str = True; str_quote = ch
        out.append(ch); i += 1; continue
    if ch == '/' and nxt == '/':
        # Line comment — skip to newline (keep the newline).
        while i < n and src[i] != '\n':
            i += 1
        continue
    if ch == '/' and nxt == '*':
        # Block comment — skip to closing */.
        i += 2
        while i < n - 1 and not (src[i] == '*' and src[i+1] == '/'):
            i += 1
        i += 2; continue
    out.append(ch); i += 1
text = ''.join(out)
# Strip trailing commas before } or ] (now safe — no comments left).
import re
text = re.sub(r',(\s*[}\]])', r'\1', text)
sys.stdout.write(text)
PY
}

list_cf_resource() {
  # list_cf_resource d1|r2|kv
  # Echoes names (one per line) on success; empty + nonzero rc on failure.
  case "$1" in
    d1)
      (cd "$REPO_ROOT" && bunx wrangler d1 list --json 2>/dev/null) \
        | jq -r '.[].name' 2>/dev/null
      ;;
    r2)
      (cd "$REPO_ROOT" && bunx wrangler r2 bucket list --json 2>/dev/null) \
        | jq -r '.buckets[].name // .[].name' 2>/dev/null
      ;;
    kv)
      (cd "$REPO_ROOT" && bunx wrangler kv namespace list --json 2>/dev/null) \
        | jq -r '.[].id' 2>/dev/null
      ;;
  esac
}

required_d1_names() {
  # Per env. local is for `wrangler dev`, preview is wired in --env preview,
  # prod is wired in --env production. We always require local + the env one.
  echo "debatekit-dashboard-db-local"
  if [ "$ENV_NAME" = "preview" ]; then
    echo "debatekit-dashboard-db-preview"
  else
    echo "debatekit-dashboard-db-prod"
  fi
}

required_r2_names() {
  echo "debatekit-dashboard-r2-uploads-local"
  if [ "$ENV_NAME" = "preview" ]; then
    echo "debatekit-dashboard-r2-uploads-preview-weur"
  else
    echo "debatekit-dashboard-r2-uploads-prod-weur"
  fi
}

# Discover required KV namespace IDs from wrangler.jsonc files (top-level and
# env-scoped). Output: one ID per line, deduped.
discover_required_kv_ids() {
  local f stripped
  for d in $WORKER_DIRS; do
    f="${REPO_ROOT}/${d}/wrangler.jsonc"
    [ -f "$f" ] || continue
    stripped="$(strip_jsonc "$f")"
    # Top-level + env.preview + env.production KV ids.
    printf "%s" "$stripped" | jq -r '
      [
        (.kv_namespaces // [])[]?,
        (.env.preview.kv_namespaces // [])[]?,
        (.env.production.kv_namespaces // [])[]?
      ] | .[] | .id // empty
    ' 2>/dev/null
  done | sort -u | grep -v '^$' || true
}

check_resource_list() {
  # check_resource_list <kind-label> <listing-cmd> <required-names...>
  local label="$1"; shift
  local listing="$1"; shift
  local actual missing=""
  actual="$(list_cf_resource "$listing" 2>/dev/null || true)"
  if [ -z "$actual" ]; then
    warn "${label}: could not list (wrangler API failed or none exist)" \
         "bunx wrangler ${listing} list   (check auth + connectivity)"
    return
  fi
  local name
  for name in "$@"; do
    if ! printf "%s\n" "$actual" | grep -Fxq "$name"; then
      missing="${missing}${name}
"
    fi
  done
  if [ -z "$missing" ]; then
    pass "${label}: all required present ($#)"
  else
    local n
    n="$(printf "%s" "$missing" | grep -c .)"
    fail "${label}: ${n} required resource(s) missing" \
         "create with: bunx wrangler ${listing} create <name>  (see list below)"
    ( IFS='
'
      set -- $missing
      print_detail_list "missing-${listing}" "$@"
    )
  fi
}

# Need jq + bunx for resource checks.
if command -v jq >/dev/null 2>&1 && command -v bun >/dev/null 2>&1; then
  # D1
  d1_required=""
  while IFS= read -r n; do d1_required="${d1_required}${n}
"; done <<EOF
$(required_d1_names)
EOF
  ( IFS='
'
    set -- $d1_required
    check_resource_list "D1 databases" "d1" "$@"
  )

  # R2
  r2_required=""
  while IFS= read -r n; do r2_required="${r2_required}${n}
"; done <<EOF
$(required_r2_names)
EOF
  ( IFS='
'
    set -- $r2_required
    check_resource_list "R2 buckets" "r2" "$@"
  )

  # KV (compare IDs, not names — wrangler returns IDs in `list`)
  kv_required="$(discover_required_kv_ids)"
  if [ -z "$kv_required" ]; then
    warn "KV namespaces: no IDs discovered in any wrangler.jsonc" \
         "fill kv_namespaces[].id in apps/*/wrangler.jsonc"
  else
    ( IFS='
'
      set -- $kv_required
      check_resource_list "KV namespaces" "kv" "$@"
    )
  fi
else
  warn "skipping CF resource checks — bun or jq missing"
fi

# ---------------------------------------------------------------------------
# 6. wrangler.jsonc IDs filled in (no placeholders)
# ---------------------------------------------------------------------------

info "6/10  wrangler.jsonc binding IDs"

# Placeholder patterns we reject.
is_placeholder() {
  local v="$1"
  case "$v" in
    ''|null|'<change-me>'|'<placeholder>'|placeholder|xxxx-xxxx-xxxx-xxxx|TODO|todo)
      return 0 ;;
    '<'*'>') return 0 ;;
    *xxxx-xxxx-xxxx*) return 0 ;;
  esac
  return 1
}

check_wrangler_ids() {
  local dir="$1"
  local f="${REPO_ROOT}/${dir}/wrangler.jsonc"
  if [ ! -f "$f" ]; then
    fail "${dir}/wrangler.jsonc missing"
    return
  fi
  local stripped
  stripped="$(strip_jsonc "$f")"

  # Collect (kind, binding, value) triples for any missing/placeholder ID.
  local issues=""
  local line kind binding value

  # D1
  while IFS=$'\t' read -r binding value; do
    [ -z "$binding" ] && continue
    if is_placeholder "$value"; then
      issues="${issues}d1.${binding} = '${value}'
"
    fi
  done <<EOF
$(printf "%s" "$stripped" | jq -r '
  [
    (.d1_databases // [])[]?,
    (.env.preview.d1_databases // [])[]?,
    (.env.production.d1_databases // [])[]?
  ] | .[] | "\(.binding)\t\(.database_id // "")"
' 2>/dev/null)
EOF

  # KV
  while IFS=$'\t' read -r binding value; do
    [ -z "$binding" ] && continue
    if is_placeholder "$value"; then
      issues="${issues}kv.${binding} = '${value}'
"
    fi
  done <<EOF
$(printf "%s" "$stripped" | jq -r '
  [
    (.kv_namespaces // [])[]?,
    (.env.preview.kv_namespaces // [])[]?,
    (.env.production.kv_namespaces // [])[]?
  ] | .[] | "\(.binding)\t\(.id // "")"
' 2>/dev/null)
EOF

  # R2 (we check bucket_name; preview_bucket_name fallback isn't a placeholder)
  while IFS=$'\t' read -r binding value; do
    [ -z "$binding" ] && continue
    if is_placeholder "$value"; then
      issues="${issues}r2.${binding} = '${value}'
"
    fi
  done <<EOF
$(printf "%s" "$stripped" | jq -r '
  [
    (.r2_buckets // [])[]?,
    (.env.preview.r2_buckets // [])[]?,
    (.env.production.r2_buckets // [])[]?
  ] | .[] | "\(.binding)\t\(.bucket_name // "")"
' 2>/dev/null)
EOF

  if [ -z "$issues" ]; then
    pass "${dir}/wrangler.jsonc: all binding IDs filled"
  else
    local n
    n="$(printf "%s" "$issues" | grep -c .)"
    fail "${dir}/wrangler.jsonc: ${n} binding(s) with placeholder/empty IDs" \
         "edit ${dir}/wrangler.jsonc and paste the IDs from the Cloudflare dashboard"
    ( IFS='
'
      set -- $issues
      print_detail_list "${dir}-placeholders" "$@"
    )
  fi
}

if command -v jq >/dev/null 2>&1; then
  for d in $WORKER_DIRS; do
    check_wrangler_ids "$d"
  done
else
  warn "skipping wrangler.jsonc ID checks — jq missing"
fi

# ---------------------------------------------------------------------------
# 7. Account-ID consistency across all wrangler.jsonc
# ---------------------------------------------------------------------------

info "7/10  account_id consistency"

check_account_ids() {
  local mismatches=""
  for d in $WORKER_DIRS; do
    local f="${REPO_ROOT}/${d}/wrangler.jsonc"
    [ -f "$f" ] || continue
    local stripped ids id
    stripped="$(strip_jsonc "$f")"
    # Collect every account_id value present anywhere in the file.
    ids="$(printf "%s" "$stripped" | jq -r '
      [.. | objects | .account_id? // empty] | .[]
    ' 2>/dev/null)"
    if [ -z "$ids" ]; then
      mismatches="${mismatches}${d}: (no account_id set)
"
      continue
    fi
    while IFS= read -r id; do
      [ -z "$id" ] && continue
      if [ "$id" != "$EXPECTED_ACCOUNT_ID" ]; then
        mismatches="${mismatches}${d}: ${id}
"
      fi
    done <<EOF
$ids
EOF
  done

  if [ -z "$mismatches" ]; then
    pass "account_id == ${EXPECTED_ACCOUNT_ID:0:8}… everywhere"
  else
    local n
    n="$(printf "%s" "$mismatches" | grep -c .)"
    fail "${n} wrangler.jsonc file(s) have wrong/missing account_id" \
         "set account_id to ${EXPECTED_ACCOUNT_ID} in every wrangler.jsonc"
    ( IFS='
'
      set -- $mismatches
      print_detail_list "account-id-mismatches" "$@"
    )
  fi
}

if command -v jq >/dev/null 2>&1; then
  check_account_ids
else
  warn "skipping account_id check — jq missing"
fi

# ---------------------------------------------------------------------------
# 8. TypeScript clean (optional)
# ---------------------------------------------------------------------------

info "8/10  TypeScript typecheck"
if [ "$WITH_TYPES" -eq 1 ]; then
  if ! command -v bun >/dev/null 2>&1; then
    fail "typecheck requested but bun missing"
  else
    if (cd "$REPO_ROOT" && bun run check-types >/tmp/preflight-tsc.log 2>&1); then
      pass "bun run check-types"
    else
      fail "bun run check-types failed (last lines below)" \
           "see /tmp/preflight-tsc.log for the full output"
      if [ "$JSON_OUT" -eq 0 ]; then
        tail -20 /tmp/preflight-tsc.log | sed 's/^/      /'
      fi
    fi
  fi
else
  info "skipped (re-run with --with-types to enforce)"
fi

# ---------------------------------------------------------------------------
# 9. DNS sanity (optional)
# ---------------------------------------------------------------------------

info "9/10  DNS"
if [ "$WITH_DNS" -eq 1 ]; then
  if ! command -v dig >/dev/null 2>&1; then
    fail "dig missing — cannot verify DNS" "brew install bind"
  else
    ns_out="$(dig +short NS debatekit.com @8.8.8.8 2>/dev/null)"
    if printf "%s" "$ns_out" | grep -qi cloudflare; then
      pass "NS records point to Cloudflare"
    else
      fail "debatekit.com NS records don't include Cloudflare" \
           "set nameservers to Cloudflare at your registrar"
    fi
    a_out="$(dig +short A debatekit.com @1.1.1.1 2>/dev/null)"
    if [ -n "$a_out" ]; then
      pass "debatekit.com resolves (A record present)"
    else
      fail "debatekit.com has no A record from 1.1.1.1" \
           "add an A/CNAME record in the Cloudflare DNS dashboard"
    fi
  fi
else
  info "skipped (re-run with --with-dns to enforce)"
fi

# ---------------------------------------------------------------------------
# 10. Domain reachability
# ---------------------------------------------------------------------------

info "10/10  Domain reachability"

check_url_reachable() {
  # check_url_reachable <url>
  local url="$1"
  local code
  if ! command -v curl >/dev/null 2>&1; then
    warn "curl missing — cannot check $url"
    return
  fi
  code="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")"
  case "$code" in
    2*|401|403)
      pass "${url} → HTTP ${code}"
      ;;
    000)
      fail "${url} unreachable (timeout / DNS / TLS)" \
           "check DNS, worker route, and that the worker is deployed"
      ;;
    *)
      warn "${url} → HTTP ${code} (unexpected, but worker is responding)"
      ;;
  esac
}

check_url_reachable "https://debatekit.com/"
if [ "$ENV_NAME" = "preview" ]; then
  check_url_reachable "https://web-preview.debatekit.com/"
fi

# ---------------------------------------------------------------------------
# Summary + exit
# ---------------------------------------------------------------------------

if [ "$JSON_OUT" -eq 1 ]; then
  # Assemble a single JSON object from the accumulated lines.
  jq -s \
    --arg env "$ENV_NAME" \
    --argjson pass "$PASS_COUNT" \
    --argjson warn "$WARN_COUNT" \
    --argjson fail "$FAIL_COUNT" \
    --argjson strict "$STRICT" \
    '{
      env: $env,
      summary: { pass: $pass, warn: $warn, fail: $fail, strict: ($strict == 1) },
      checks: .
    }' \
    <"$JSON_LINES_FILE"
else
  echo ""
  printf "${C_BOLD}Result:${C_RESET} %s%d pass%s, %s%d warn%s, %s%d fail%s\n" \
    "${C_GREEN}" "$PASS_COUNT" "${C_RESET}" \
    "${C_YELLOW}" "$WARN_COUNT" "${C_RESET}" \
    "${C_RED}" "$FAIL_COUNT" "${C_RESET}"
  if [ "$FAIL_COUNT" -gt 0 ]; then
    echo "Re-run after fixing the items above."
  elif [ "$WARN_COUNT" -gt 0 ] && [ "$STRICT" -eq 1 ]; then
    echo "Strict mode: warnings count as failures."
  else
    printf "${C_GREEN}Ready to deploy:${C_RESET} bunx wrangler deploy --env %s\n" "$ENV_NAME"
  fi
fi

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
if [ "$STRICT" -eq 1 ] && [ "$WARN_COUNT" -gt 0 ]; then
  exit 1
fi
exit 0
