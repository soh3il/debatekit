#!/usr/bin/env bash
# provision-cf-resources.sh — provision Cloudflare resources declared in each
# worker's wrangler.jsonc (D1 dbs, R2 buckets, KV namespaces, Queues, Workers
# AI, Durable Objects), then write the resulting IDs back into the JSONC files
# so `wrangler dev`/`deploy` runs without further binding edits.
#
# Usage:
#   ./scripts/provision-cf-resources.sh [--app NAME] [--resource TYPE] [--dry-run] [--yes]
#
#   --app       api|web|mcp|slack|telegram|whatsapp  (default: all)
#   --resource  d1|r2|kv|queues|turnstile|all        (default: all)
#   --dry-run   print the wrangler commands instead of running them
#   --yes       skip "continue anyway?" prompt when account check is soft-fail
#
# Works with bash 3.2 (macOS stock). Requires: wrangler (or bunx/npx), jq, python3.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPECTED_ACCOUNT_ID="67bc7b518b92a0c406ac9b8526ddbb6d"
TURNSTILE_CALLBACK_DOMAIN="debatekit.ai"

# Parallel arrays: APP_KEYS[i] -> APP_DIRS[i].
APP_KEYS=(api  web      mcp      slack                  telegram                  whatsapp)
APP_DIRS=(apps/api apps/web apps/mcp integrations/slack integrations/telegram integrations/whatsapp)

# Resolve "app key" -> dir (relative to REPO_ROOT).
app_dir() {
  local key="$1" i
  for i in $(seq 0 $((${#APP_KEYS[@]} - 1))); do
    if [ "${APP_KEYS[$i]}" = "$key" ]; then echo "${APP_DIRS[$i]}"; return 0; fi
  done
  return 1
}

# --- args ---
APP_FILTER=""; RESOURCE_FILTER="all"; DRY_RUN=0; ASSUME_YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --app)      APP_FILTER="${2:-}"; shift 2 ;;
    --resource) RESOURCE_FILTER="${2:-}"; shift 2 ;;
    --dry-run)  DRY_RUN=1; shift ;;
    --yes|-y)   ASSUME_YES=1; shift ;;
    -h|--help)  sed -n '2,15p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

case "$RESOURCE_FILTER" in
  d1|r2|kv|queues|turnstile|all) ;;
  *) echo "ERR: --resource must be one of: d1|r2|kv|queues|turnstile|all" >&2; exit 2 ;;
esac
if [ -n "$APP_FILTER" ] && ! app_dir "$APP_FILTER" >/dev/null; then
  echo "ERR: --app must be one of: ${APP_KEYS[*]}" >&2; exit 2
fi
if [ -n "$APP_FILTER" ]; then APP_TARGETS=("$APP_FILTER"); else APP_TARGETS=("${APP_KEYS[@]}"); fi

# --- color / log helpers ---
if [ -t 1 ]; then
  C_R=$'\033[0m'; C_D=$'\033[2m'; C_B=$'\033[1m'
  C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YLW=$'\033[33m'; C_BLU=$'\033[34m'; C_CYN=$'\033[36m'
else C_R=""; C_D=""; C_B=""; C_RED=""; C_GRN=""; C_YLW=""; C_BLU=""; C_CYN=""; fi
info() { printf "%s[..]%s %s\n" "$C_BLU" "$C_R" "$*"; }
warn() { printf "%s[warn]%s %s\n" "$C_YLW" "$C_R" "$*" >&2; }
err()  { printf "%s[err]%s %s\n"  "$C_RED" "$C_R" "$*" >&2; }
ok()   { printf "%s[ok]%s %s\n"   "$C_GRN" "$C_R" "$*"; }
hdr()  { printf "\n%s== %s ==%s\n" "$C_B" "$*" "$C_R"; }

# --- preflight: tools ---
if command -v wrangler >/dev/null 2>&1; then WRANGLER=(wrangler)
elif command -v bunx >/dev/null 2>&1;    then WRANGLER=(bunx wrangler)
elif command -v npx  >/dev/null 2>&1;    then WRANGLER=(npx --yes wrangler)
else err "wrangler not found and no bunx/npx available"; exit 1; fi

command -v jq      >/dev/null 2>&1 || { err "jq is required (brew install jq)"; exit 1; }
command -v python3 >/dev/null 2>&1 || { err "python3 is required for JSONC parsing"; exit 1; }

# --- preflight: wrangler auth + account ---
info "Checking wrangler auth..."
WHOAMI="$("${WRANGLER[@]}" whoami 2>&1 || true)"
if echo "$WHOAMI" | grep -qiE "not.*authenticated|run.*wrangler login|you are not"; then
  err "wrangler is not logged in. Run 'wrangler login' or set CLOUDFLARE_API_TOKEN."; exit 1
fi
if echo "$WHOAMI" | grep -q "$EXPECTED_ACCOUNT_ID"; then
  ok "wrangler account matches expected ($EXPECTED_ACCOUNT_ID)"
else
  err "Expected Cloudflare account $EXPECTED_ACCOUNT_ID not found in 'wrangler whoami'."
  err "This script targets Soheil's account only. Aborting."
  if [ $ASSUME_YES -eq 1 ]; then
    warn "--yes was set; continuing against current account."
  else
    exit 1
  fi
fi

# --- summary buffers (parallel-ish via newline-joined strings, bash 3.2-safe) ---
CREATED_LOG=""
SKIPPED_EXISTS_LOG=""
SKIPPED_DRYRUN_LOG=""
FAILED_LOG=""
REMINDER_LOG=""

log_created()   { CREATED_LOG="${CREATED_LOG}${1}"$'\n'; }
log_exists()    { SKIPPED_EXISTS_LOG="${SKIPPED_EXISTS_LOG}${1}"$'\n'; }
log_dryrun()    { SKIPPED_DRYRUN_LOG="${SKIPPED_DRYRUN_LOG}${1}"$'\n'; }
log_failed()    { FAILED_LOG="${FAILED_LOG}${1}"$'\n'; }
log_reminder()  { REMINDER_LOG="${REMINDER_LOG}${1}"$'\n'; }

# --- JSONC helpers (python3 strips // and /* */ comments to make jq happy) ---
# Arg 1: path to a JSONC file. Writes plain JSON to stdout. Preserves strings
# containing "//". Implemented via argv (not stdin) because the python3 -
# heredoc would otherwise consume the same stdin we want to redirect a file to.
jsonc_to_json() {
  python3 - "$1" <<'PY'
import re, sys
with open(sys.argv[1], "r") as f:
    src = f.read()
# Single-pass scanner: respect string context so "/* ... */" or "//" INSIDE
# strings (e.g. globs like "**/*.wasm" or URLs) are not stripped.
out = []
i = 0; n = len(src); in_str = False; esc = False
while i < n:
    c = src[i]
    if in_str:
        out.append(c)
        if esc:
            esc = False
        elif c == "\\":
            esc = True
        elif c == '"':
            in_str = False
        i += 1
        continue
    if c == '"':
        in_str = True
        out.append(c); i += 1; continue
    # // line comment
    if c == "/" and i + 1 < n and src[i+1] == "/":
        while i < n and src[i] != "\n":
            i += 1
        continue
    # /* block comment */
    if c == "/" and i + 1 < n and src[i+1] == "*":
        i += 2
        while i + 1 < n and not (src[i] == "*" and src[i+1] == "/"):
            i += 1
        i += 2  # skip closing */
        continue
    out.append(c); i += 1
# Remove trailing commas exposed by comment removal.
cleaned = re.sub(r",(\s*[}\]])", r"\1", "".join(out))
sys.stdout.write(cleaned)
PY
}

# Parse a wrangler.jsonc file at $1 into JSON and emit jq-extracted resources
# scoped to env $2 (one of: top, preview, production). Output formats below.
#
# Each emitted line is: <type>\t<name>\t<extra>
#   d1       <database_name>   <empty>
#   r2       <bucket_name>     <location_hint or "">
#   kv       <binding>         <preview_id or "">      (we use binding+file as the key since titles aren't explicit; the *id* is what we backfill)
#   queue    <queue_name>      <empty>
#   ai       AI                <empty>
#   do       <class_name>      <empty>
#
# NOTE: KV namespace titles in wrangler.jsonc aren't surfaced (only binding +
# id). For creation we generate a title from app + binding + env.
emit_resources() {
  local file="$1" env_scope="$2"
  local json
  json="$(jsonc_to_json "$file")"
  # base-path selector
  local base
  case "$env_scope" in
    top) base='.' ;;
    preview) base='.env.preview' ;;
    production) base='.env.production' ;;
    *) return 1 ;;
  esac
  # D1
  echo "$json" | jq -r --arg base "$base" '
    ($base | split(".") | map(select(length>0))) as $p |
    (getpath($p)) // {} | .d1_databases // [] | .[] |
    "d1\t" + (.database_name // "") + "\t"
  '
  # R2
  echo "$json" | jq -r --arg base "$base" '
    ($base | split(".") | map(select(length>0))) as $p |
    (getpath($p)) // {} | .r2_buckets // [] | .[] |
    "r2\t" + (.bucket_name // "") + "\t" + (.location_hint // "")
  '
  # KV — emit binding name; we have no title in the file, derive one later.
  echo "$json" | jq -r --arg base "$base" '
    ($base | split(".") | map(select(length>0))) as $p |
    (getpath($p)) // {} | .kv_namespaces // [] | .[] |
    "kv\t" + (.binding // "") + "\t" + (.id // "")
  '
  # Queues (producers + consumers + dlqs). Dedup downstream.
  echo "$json" | jq -r --arg base "$base" '
    ($base | split(".") | map(select(length>0))) as $p |
    (getpath($p)) // {} | (.queues // {}) as $q |
    ((($q.producers // []) | map(.queue)) +
     (($q.consumers // []) | map(.queue)) +
     (($q.consumers // []) | map(.dead_letter_queue // empty))) | unique[] |
    "queue\t" + . + "\t"
  '
  # AI
  echo "$json" | jq -r --arg base "$base" '
    ($base | split(".") | map(select(length>0))) as $p |
    (getpath($p)) // {} | (.ai // null) |
    if . == null then empty else "ai\tAI\t" end
  '
  # Durable Objects (info only)
  echo "$json" | jq -r --arg base "$base" '
    ($base | split(".") | map(select(length>0))) as $p |
    (getpath($p)) // {} | (.durable_objects // {}) | (.bindings // []) | .[] |
    "do\t" + (.class_name // "") + "\t"
  '
}

# Look up the existing migrations block in the JSONC; print "yes" if present
# at the right scope, "no" if missing but DOs are declared, "n/a" if no DOs.
check_migrations_block() {
  local file="$1" env_scope="$2"
  local json; json="$(jsonc_to_json "$file")"
  local base
  case "$env_scope" in
    top) base='.' ;;
    preview) base='.env.preview' ;;
    production) base='.env.production' ;;
  esac
  local has_do has_mig
  has_do="$(echo "$json" | jq -r --arg base "$base" '
    ($base | split(".") | map(select(length>0))) as $p |
    (getpath($p)) // {} | (.durable_objects // {}) | (.bindings // []) | length > 0
  ')"
  has_mig="$(echo "$json" | jq -r --arg base "$base" '
    ($base | split(".") | map(select(length>0))) as $p |
    (getpath($p)) // {} | (.migrations // []) | length > 0
  ')"
  if [ "$has_do" != "true" ]; then echo "n/a"; return; fi
  if [ "$has_mig" = "true" ]; then echo "yes"; else echo "no"; fi
}

# --- existence caches (one wrangler call per type, then grep) ---
D1_LIST_JSON=""; R2_LIST_TEXT=""; KV_LIST_JSON=""; QUEUE_LIST_TEXT=""
load_existence_caches() {
  info "Listing existing resources on the account..."
  D1_LIST_JSON="$("${WRANGLER[@]}" d1 list --json 2>/dev/null || echo '[]')"
  R2_LIST_TEXT="$("${WRANGLER[@]}" r2 bucket list 2>/dev/null || true)"
  KV_LIST_JSON="$("${WRANGLER[@]}" kv namespace list 2>/dev/null || echo '[]')"
  QUEUE_LIST_TEXT="$("${WRANGLER[@]}" queues list 2>/dev/null || true)"
}

d1_existing_id() {
  # echo id if a d1 with name $1 exists, empty otherwise
  echo "$D1_LIST_JSON" | jq -r --arg n "$1" '.[] | select(.name == $n) | .uuid' | head -n1
}
r2_exists() {
  # 0 if bucket name appears in `wrangler r2 bucket list` output
  echo "$R2_LIST_TEXT" | grep -qE "(^|[[:space:]])$1([[:space:]]|$)"
}
kv_existing_id() {
  echo "$KV_LIST_JSON" | jq -r --arg t "$1" '.[] | select(.title == $t) | .id' | head -n1
}
queue_exists() {
  echo "$QUEUE_LIST_TEXT" | grep -qE "(^|[[:space:]])$1([[:space:]]|$)"
}

# --- writeback helpers (regex-based, JSONC-comment-safe) ---
# Replace a value-field's value inside the JSON object whose name-field matches.
# Args: file, name_key, name_val, value_key, new_value
# E.g. replace database_id inside the object with database_name=="foo".
writeback_field() {
  local file="$1" name_key="$2" name_val="$3" value_key="$4" new_value="$5"
  if [ $DRY_RUN -eq 1 ]; then
    info "  (dry-run) would set $value_key=\"$new_value\" where $name_key=\"$name_val\" in $file"
    return 0
  fi
  python3 - "$file" "$name_key" "$name_val" "$value_key" "$new_value" <<'PY'
import re, sys, json
path, nk, nv, vk, newval = sys.argv[1:6]
with open(path, "r") as f:
    src = f.read()

# Find each object boundary that contains name_key:"name_val" and within the
# SAME object (between matching { and }) replace value_key:"...".
# We scan with a simple brace counter, JSONC-comment-aware.
out = []
i = 0; n = len(src)
in_str = False; esc = False; in_line_c = False; in_block_c = False
obj_starts = []
# First pass: collect object spans (start_idx -> end_idx inclusive of braces).
spans = []
stack = []
while i < n:
    c = src[i]
    if in_line_c:
        if c == "\n": in_line_c = False
        i += 1; continue
    if in_block_c:
        if c == "*" and i+1 < n and src[i+1] == "/":
            in_block_c = False; i += 2; continue
        i += 1; continue
    if in_str:
        if esc: esc = False
        elif c == "\\": esc = True
        elif c == '"': in_str = False
        i += 1; continue
    if c == '"':
        in_str = True; i += 1; continue
    if c == "/" and i+1 < n and src[i+1] == "/":
        in_line_c = True; i += 2; continue
    if c == "/" and i+1 < n and src[i+1] == "*":
        in_block_c = True; i += 2; continue
    if c == "{":
        stack.append(i); i += 1; continue
    if c == "}":
        if stack:
            s = stack.pop()
            spans.append((s, i))  # inclusive of both braces
        i += 1; continue
    i += 1

# Sort spans innermost first (smaller spans first).
spans.sort(key=lambda x: (x[1] - x[0]))
name_pat = re.compile(r'"' + re.escape(nk) + r'"\s*:\s*"' + re.escape(nv) + r'"')
val_pat  = re.compile(r'("' + re.escape(vk) + r'"\s*:\s*")([^"]*)(")')

modified = False
for (s, e) in spans:
    chunk = src[s:e+1]
    if not name_pat.search(chunk):
        continue
    new_chunk, count = val_pat.subn(lambda m: m.group(1) + newval + m.group(3), chunk, count=1)
    if count == 1 and new_chunk != chunk:
        src = src[:s] + new_chunk + src[e+1:]
        modified = True
        break  # innermost object matched, done

if not modified:
    sys.stderr.write(f"writeback: no match for {nk}={nv!r} / {vk} in {path}\n")
    sys.exit(2)

# Validate the result still parses as JSONC -> JSON.
def strip_jsonc(text):
    out = []; i = 0; n = len(text); in_str = False; esc = False
    while i < n:
        c = text[i]
        if in_str:
            out.append(c)
            if esc: esc = False
            elif c == "\\": esc = True
            elif c == '"': in_str = False
            i += 1; continue
        if c == '"':
            in_str = True; out.append(c); i += 1; continue
        if c == "/" and i+1 < n and text[i+1] == "/":
            while i < n and text[i] != "\n": i += 1
            continue
        if c == "/" and i+1 < n and text[i+1] == "*":
            i += 2
            while i + 1 < n and not (text[i] == "*" and text[i+1] == "/"):
                i += 1
            i += 2
            continue
        out.append(c); i += 1
    return re.sub(r",(\s*[}\]])", r"\1", "".join(out))

try:
    json.loads(strip_jsonc(src))
except Exception as ex:
    sys.stderr.write(f"writeback: post-edit JSONC failed to parse: {ex}\n")
    sys.exit(3)

# Atomic write.
import os, tempfile
d = os.path.dirname(path)
fd, tmp = tempfile.mkstemp(prefix=".wjsonc.", dir=d)
try:
    with os.fdopen(fd, "w") as f:
        f.write(src)
    os.replace(tmp, path)
except Exception:
    try: os.unlink(tmp)
    except Exception: pass
    raise
PY
}

# Backfill BOTH `database_id` AND `preview_database_id` for a d1 entry that
# matched on database_name.
writeback_d1_id() {
  local file="$1" db_name="$2" new_id="$3"
  writeback_field "$file" "database_name" "$db_name" "database_id"         "$new_id"
  writeback_field "$file" "database_name" "$db_name" "preview_database_id" "$new_id" || true
}

# Backfill BOTH `id` AND `preview_id` for a kv entry that matched on binding.
# Note: this matches by binding inside the same kv_namespaces[] object. If a
# config has multiple KVs with the same binding across envs (different objects),
# each is updated independently because we scan innermost-first per call site.
writeback_kv_id() {
  local file="$1" binding="$2" new_id="$3"
  writeback_field "$file" "binding" "$binding" "id"         "$new_id"
  writeback_field "$file" "binding" "$binding" "preview_id" "$new_id" || true
}

# --- per-resource handlers ---

# D1: $1=file $2=database_name
handle_d1() {
  local file="$1" name="$2"
  [ -z "$name" ] && return 0
  local existing; existing="$(d1_existing_id "$name")"
  if [ -n "$existing" ]; then
    log_exists "d1     $name  (id=$existing)"
    info "  d1 exists: $name -> $existing"
    writeback_d1_id "$file" "$name" "$existing" || warn "  writeback skipped for $name"
    return 0
  fi
  local cmd="${WRANGLER[*]} d1 create $name"
  if [ $DRY_RUN -eq 1 ]; then
    log_dryrun "d1     $name  (cmd: $cmd)"
    info "  (dry-run) $cmd"
    return 0
  fi
  info "  creating d1: $name"
  local out new_id
  if ! out="$("${WRANGLER[@]}" d1 create "$name" 2>&1)"; then
    err "  d1 create failed for $name:\n$out"
    log_failed "d1     $name"
    return 1
  fi
  # Parse "database_id = \"...\"" or "database_id: ..."
  new_id="$(echo "$out" | grep -Eo '"[0-9a-fA-F-]{36}"' | head -n1 | tr -d '"')"
  if [ -z "$new_id" ]; then
    new_id="$(echo "$out" | grep -Eo '[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}' | head -n1)"
  fi
  if [ -z "$new_id" ]; then
    err "  could not parse database_id from d1 create output:\n$out"
    log_failed "d1     $name (id parse failed)"
    return 1
  fi
  ok "  d1 created: $name -> $new_id"
  log_created "d1     $name  (id=$new_id)"
  writeback_d1_id "$file" "$name" "$new_id"
}

# R2: $1=file $2=bucket_name $3=location_hint(optional)
handle_r2() {
  local file="$1" name="$2" loc="${3:-}"
  [ -z "$name" ] && return 0
  if r2_exists "$name"; then
    log_exists "r2     $name"
    info "  r2 exists: $name"
    return 0
  fi
  local cmd="${WRANGLER[*]} r2 bucket create $name"
  [ -n "$loc" ] && cmd="$cmd --location $loc"
  if [ $DRY_RUN -eq 1 ]; then
    log_dryrun "r2     $name  (cmd: $cmd)"
    info "  (dry-run) $cmd"
    return 0
  fi
  info "  creating r2 bucket: $name${loc:+ (location=$loc)}"
  if [ -n "$loc" ]; then
    "${WRANGLER[@]}" r2 bucket create "$name" --location "$loc"
  else
    "${WRANGLER[@]}" r2 bucket create "$name"
  fi
  ok "  r2 created: $name"
  log_created "r2     $name"
  # R2 bucket name == config bucket_name, nothing to write back.
  # Refresh cache so subsequent same-bucket lookups skip.
  R2_LIST_TEXT="${R2_LIST_TEXT}
$name"
}

# KV: $1=file $2=binding $3=existing_id_in_file $4=app_key $5=env_scope
# Derives a KV title from app+binding+env so duplicate creations are detected.
handle_kv() {
  local file="$1" binding="$2" cur_id="$3" app_key="$4" env_scope="$5"
  [ -z "$binding" ] && return 0
  local env_suffix
  case "$env_scope" in
    top)        env_suffix="local" ;;
    preview)    env_suffix="preview" ;;
    production) env_suffix="prod" ;;
  esac
  # Title convention: debatekit-<app>-<binding-lowercase>-<env>
  local b_lc title
  b_lc="$(echo "$binding" | tr '[:upper:]' '[:lower:]')"
  title="debatekit-${app_key}-${b_lc}-${env_suffix}"
  local existing; existing="$(kv_existing_id "$title")"
  if [ -n "$existing" ]; then
    log_exists "kv     $title  (id=$existing)"
    info "  kv exists: $title -> $existing"
    if [ "$cur_id" != "$existing" ]; then
      writeback_kv_id "$file" "$binding" "$existing" || warn "  kv writeback skipped for $binding"
    fi
    return 0
  fi
  local cmd="${WRANGLER[*]} kv namespace create $title"
  if [ $DRY_RUN -eq 1 ]; then
    log_dryrun "kv     $title  (cmd: $cmd)"
    info "  (dry-run) $cmd"
    return 0
  fi
  info "  creating kv namespace: $title"
  local out new_id
  if ! out="$("${WRANGLER[@]}" kv namespace create "$title" 2>&1)"; then
    err "  kv namespace create failed for $title:\n$out"
    log_failed "kv     $title"
    return 1
  fi
  new_id="$(echo "$out" | grep -Eo '"id"[[:space:]]*[:=][[:space:]]*"[0-9a-f]{32}"' | grep -Eo '[0-9a-f]{32}' | head -n1)"
  if [ -z "$new_id" ]; then
    new_id="$(echo "$out" | grep -Eo '[0-9a-f]{32}' | head -n1)"
  fi
  if [ -z "$new_id" ]; then
    err "  could not parse id from kv namespace create output:\n$out"
    log_failed "kv     $title (id parse failed)"
    return 1
  fi
  ok "  kv created: $title -> $new_id"
  log_created "kv     $title  (id=$new_id)"
  writeback_kv_id "$file" "$binding" "$new_id"
}

# Queue: $1=queue_name
handle_queue() {
  local qname="$1"
  [ -z "$qname" ] && return 0
  if queue_exists "$qname"; then
    log_exists "queue  $qname"
    info "  queue exists: $qname"
    return 0
  fi
  local cmd="${WRANGLER[*]} queues create $qname"
  if [ $DRY_RUN -eq 1 ]; then
    log_dryrun "queue  $qname  (cmd: $cmd)"
    info "  (dry-run) $cmd"
    return 0
  fi
  info "  creating queue: $qname"
  if ! "${WRANGLER[@]}" queues create "$qname" >/dev/null 2>&1; then
    err "  queue create failed for $qname"
    log_failed "queue  $qname"
    return 1
  fi
  ok "  queue created: $qname"
  log_created "queue  $qname"
  QUEUE_LIST_TEXT="${QUEUE_LIST_TEXT}
$qname"
}

# Turnstile: dashboard-only; print instructions per app+env.
handle_turnstile_notice() {
  local app_key="$1" env_scope="$2"
  local url="https://dash.cloudflare.com/${EXPECTED_ACCOUNT_ID}/turnstile"
  log_reminder "turnstile [${app_key}/${env_scope}]: create site at ${url}  (allowed domain: ${TURNSTILE_CALLBACK_DOMAIN})"
}

# --- per-app driver ---
process_file_env() {
  local file="$1" env_scope="$2" app_key="$3"
  hdr "$app_key / $env_scope    ($(printf "%s" "$file" | sed "s|$REPO_ROOT/||"))"

  # Dedup queues across producers/consumers/dlqs by tracking what we processed.
  local seen_queues=""

  # Iterate emitted resources.
  while IFS=$'\t' read -r rtype rname rextra; do
    [ -z "$rtype" ] && continue
    case "$rtype" in
      d1)
        if [ "$RESOURCE_FILTER" = "all" ] || [ "$RESOURCE_FILTER" = "d1" ]; then
          handle_d1 "$file" "$rname"
        fi ;;
      r2)
        if [ "$RESOURCE_FILTER" = "all" ] || [ "$RESOURCE_FILTER" = "r2" ]; then
          handle_r2 "$file" "$rname" "$rextra"
        fi ;;
      kv)
        if [ "$RESOURCE_FILTER" = "all" ] || [ "$RESOURCE_FILTER" = "kv" ]; then
          handle_kv "$file" "$rname" "$rextra" "$app_key" "$env_scope"
        fi ;;
      queue)
        if [ "$RESOURCE_FILTER" = "all" ] || [ "$RESOURCE_FILTER" = "queues" ]; then
          case "$seen_queues" in
            *"|$rname|"*) : ;;  # already handled this env
            *) handle_queue "$rname"; seen_queues="${seen_queues}|$rname|" ;;
          esac
        fi ;;
      ai)
        info "  ai binding present (no provisioning needed) — $rname"
        log_reminder "ai     [$app_key/$env_scope]: AI binding requires no provisioning, just the binding entry."
        ;;
      do)
        local mig_state; mig_state="$(check_migrations_block "$file" "$env_scope")"
        case "$mig_state" in
          yes) info "  durable object: $rname  (migrations block present)" ;;
          no)  warn "  durable object: $rname declared but no migrations block in $env_scope scope"
               log_reminder "do     [$app_key/$env_scope]: class \"$rname\" needs a migrations: [{tag:\"v1\", new_sqlite_classes:[\"$rname\"]}] entry." ;;
          n/a) : ;;
        esac
        ;;
    esac
  done < <(emit_resources "$file" "$env_scope")

  # Turnstile: trigger notice once per (app, env) when filter requests it.
  # debatekit-api carries TURNSTILE_SITE_KEY in vars; emit reminder only when
  # explicitly requested via --resource turnstile, OR when iterating "all".
  if [ "$RESOURCE_FILTER" = "all" ] || [ "$RESOURCE_FILTER" = "turnstile" ]; then
    local json; json="$(jsonc_to_json "$file")"
    local base
    case "$env_scope" in
      top) base='.' ;;
      preview) base='.env.preview' ;;
      production) base='.env.production' ;;
    esac
    local has_ts; has_ts="$(echo "$json" | jq -r --arg base "$base" '
      ($base | split(".") | map(select(length>0))) as $p |
      (getpath($p)) // {} | (.vars // {}) | has("TURNSTILE_SITE_KEY")
    ')"
    if [ "$has_ts" = "true" ]; then
      handle_turnstile_notice "$app_key" "$env_scope"
    fi
  fi
}

process_app() {
  local app_key="$1"
  local dir; dir="$(app_dir "$app_key")"
  local file="$REPO_ROOT/$dir/wrangler.jsonc"
  if [ ! -f "$file" ]; then
    warn "no wrangler.jsonc for $app_key at $file — skipping"
    return 0
  fi
  for env_scope in top preview production; do
    # Skip scope if not declared in the file (e.g. some integrations have no env.production routes section but still have env.production block).
    local json; json="$(jsonc_to_json "$file")"
    local has=true
    if [ "$env_scope" != "top" ]; then
      has="$(echo "$json" | jq -r --arg e "$env_scope" '.env | has($e)')"
    fi
    if [ "$has" = "true" ]; then
      process_file_env "$file" "$env_scope" "$app_key"
    fi
  done
}

# --- main ---
load_existence_caches
for app_key in "${APP_TARGETS[@]}"; do
  process_app "$app_key"
done

# --- summary ---
hdr "Summary"
printf "%sCreated:%s\n" "$C_B" "$C_R"
if [ -n "$CREATED_LOG" ]; then printf "%s" "$CREATED_LOG" | sed 's/^/  /'; else echo "  (none)"; fi
printf "\n%sSkipped (already exists):%s\n" "$C_B" "$C_R"
if [ -n "$SKIPPED_EXISTS_LOG" ]; then printf "%s" "$SKIPPED_EXISTS_LOG" | sed 's/^/  /'; else echo "  (none)"; fi
printf "\n%sSkipped (dry-run, would create):%s\n" "$C_B" "$C_R"
if [ -n "$SKIPPED_DRYRUN_LOG" ]; then printf "%s" "$SKIPPED_DRYRUN_LOG" | sed 's/^/  /'; else echo "  (none)"; fi
printf "\n%sReminders:%s\n" "$C_B" "$C_R"
if [ -n "$REMINDER_LOG" ]; then printf "%s" "$REMINDER_LOG" | sed 's/^/  /'; else echo "  (none)"; fi

if [ -n "$FAILED_LOG" ]; then
  printf "\n%sFailures:%s\n" "$C_RED" "$C_R"
  printf "%s" "$FAILED_LOG" | sed 's/^/  /'
  exit 1
fi

printf "\n%sDone.%s\n" "$C_GRN" "$C_R"
