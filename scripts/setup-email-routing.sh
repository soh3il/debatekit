#!/usr/bin/env bash
# setup-email-routing.sh — configure Cloudflare Email Routing for debatekit.com.
#
# What it does (idempotent):
#   1. Resolves the zone id for the target domain.
#   2. Enables Email Routing on the zone.
#   3. Adds each destination address (Cloudflare emails a confirm link; user
#      clicks it to verify). Polls until all destinations are verified or a
#      timeout is reached.
#   4. Creates per-address forwarding rules:
#        noreply@debatekit.com           → all destinations
#        support@debatekit.com           → all destinations
#        hello@mail.debatekit.com        → all destinations
#      and a catch-all rule → all destinations.
#      Skips any rule whose matcher already exists.
#
# What it does NOT do:
#   - It does not add MX/TXT/SPF/DKIM/DMARC records. Cloudflare Email Routing
#     inserts the MX + SPF/TXT records itself on enable; SES DKIM CNAMEs are
#     added by the SES dashboard. See docs/EMAIL_SETUP.md.
#   - It does not touch outbound (AWS SES) — that's all dashboard work.
#
# Usage:
#   export CLOUDFLARE_API_TOKEN=...           # Email Routing Edit + Zone Read
#   ./scripts/setup-email-routing.sh \
#       [--zone debatekit.com|<zone_id>] \
#       [--destinations ava@deadpixel.ai,soheil@deadpixel.ai] \
#       [--dry-run]
#
# Bash 3.2 compatible (macOS stock).

set -euo pipefail

# -------- defaults --------
ZONE_ARG="debatekit.com"
DESTINATIONS_CSV="ava@deadpixel.ai,soheil@deadpixel.ai"
DRY_RUN=0
POLL_TIMEOUT_SECS=300   # 5 min max wait for destination verification
POLL_INTERVAL_SECS=10

# Forwarding rules: each entry is "matcher_email|description"
FORWARD_RULES=(
  "noreply@debatekit.com|noreply -> team"
  "support@debatekit.com|support -> team"
  "hello@mail.debatekit.com|hello (marketing subdomain) -> team"
)

# -------- args --------
while [ $# -gt 0 ]; do
  case "$1" in
    --zone)         ZONE_ARG="${2:-}"; shift 2 ;;
    --destinations) DESTINATIONS_CSV="${2:-}"; shift 2 ;;
    --dry-run)      DRY_RUN=1; shift ;;
    -h|--help)      sed -n '2,32p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

# -------- color --------
if [ -t 1 ]; then
  C_R=$'\033[0m'; C_D=$'\033[2m'; C_B=$'\033[1m'
  C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YLW=$'\033[33m'; C_BLU=$'\033[34m'
else C_R=""; C_D=""; C_B=""; C_RED=""; C_GRN=""; C_YLW=""; C_BLU=""; fi
log()  { printf "%s%s%s\n" "$C_B" "$*" "$C_R"; }
info() { printf "%s%s%s\n" "$C_D" "$*" "$C_R"; }
ok()   { printf "%s[ok]%s %s\n"   "$C_GRN" "$C_R" "$*"; }
warn() { printf "%s[warn]%s %s\n" "$C_YLW" "$C_R" "$*" >&2; }
err()  { printf "%s[err]%s %s\n"  "$C_RED" "$C_R" "$*" >&2; }

# -------- preflight --------
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  err "CLOUDFLARE_API_TOKEN is not set."
  err "Create a token with scopes: Zone:Read, Email Routing Addresses:Edit, Email Routing Rules:Edit."
  err "Then: export CLOUDFLARE_API_TOKEN=..."
  exit 1
fi
for bin in curl awk grep sed tr; do
  command -v "$bin" >/dev/null 2>&1 || { err "missing required binary: $bin"; exit 1; }
done

API="https://api.cloudflare.com/client/v4"

# Minimal JSON helpers — no jq dependency. These are pragmatic, not bulletproof,
# but the Cloudflare API responses are well-formed JSON with simple shapes.

# Extract first scalar value for a key, e.g. _json_get '"id"' "$body"
_json_get() {
  local key="$1" body="$2"
  printf '%s' "$body" \
    | tr -d '\n' \
    | grep -oE "\"${key}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" \
    | head -n 1 \
    | sed -E "s/.*:[[:space:]]*\"([^\"]*)\".*/\1/"
}
# Extract first boolean for a key.
_json_get_bool() {
  local key="$1" body="$2"
  printf '%s' "$body" \
    | tr -d '\n' \
    | grep -oE "\"${key}\"[[:space:]]*:[[:space:]]*(true|false)" \
    | head -n 1 \
    | sed -E "s/.*:[[:space:]]*//"
}
# success: true|false at top level.
_json_success() { _json_get_bool "success" "$1"; }
# Extract first message inside the top-level "errors" array (if any).
_json_first_error() {
  printf '%s' "$1" \
    | tr -d '\n' \
    | grep -oE '"errors"[[:space:]]*:[[:space:]]*\[[^]]*\]' \
    | grep -oE '"message"[[:space:]]*:[[:space:]]*"[^"]*"' \
    | head -n 1 \
    | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/'
}

# curl wrapper. Stores HTTP code on stdout's last line; body precedes it.
cf_api() {
  local method="$1" path="$2" data="${3:-}"
  local tmp; tmp="$(mktemp)"
  local code
  if [ -n "$data" ]; then
    code=$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$data" \
      "${API}${path}")
  else
    code=$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      "${API}${path}")
  fi
  local body; body="$(cat "$tmp")"; rm -f "$tmp"
  printf '%s\n%s' "$body" "$code"
}

# Run cf_api and explode if HTTP isn't 2xx or success != true.
cf_api_or_die() {
  local method="$1" path="$2" data="${3:-}" desc="${4:-API call}"
  local out body code success msg
  out="$(cf_api "$method" "$path" "$data")"
  code="${out##*$'\n'}"
  body="${out%$'\n'*}"
  case "$code" in
    2*) ;;
    *)  err "$desc failed (HTTP $code)"
        msg="$(_json_first_error "$body")"
        [ -n "$msg" ] && err "  $msg" || err "  $body"
        exit 1 ;;
  esac
  success="$(_json_success "$body")"
  if [ "$success" != "true" ]; then
    err "$desc returned success=false"
    msg="$(_json_first_error "$body")"
    [ -n "$msg" ] && err "  $msg" || err "  $body"
    exit 1
  fi
  printf '%s' "$body"
}

# -------- resolve zone --------
log "Resolving zone for: $ZONE_ARG"
ZONE_ID=""
ZONE_NAME=""
# If it looks like a 32-char hex id, accept it; else look up by name.
if printf '%s' "$ZONE_ARG" | grep -qE '^[0-9a-f]{32}$'; then
  ZONE_ID="$ZONE_ARG"
  body="$(cf_api_or_die GET "/zones/${ZONE_ID}" "" "zone lookup")"
  ZONE_NAME="$(_json_get "name" "$body")"
else
  # URL-encode "@" not needed for hostnames; safe.
  body="$(cf_api_or_die GET "/zones?name=${ZONE_ARG}" "" "zone lookup")"
  ZONE_ID="$(_json_get "id" "$body")"
  ZONE_NAME="$(_json_get "name" "$body")"
  if [ -z "$ZONE_ID" ]; then
    err "No zone found for '$ZONE_ARG'. Check the API token has Zone:Read for this zone."
    exit 1
  fi
fi
ok "zone: $ZONE_NAME ($ZONE_ID)"

# -------- parse destinations CSV --------
# Split "a@x,b@y" → DESTINATIONS array. Trim whitespace.
DESTINATIONS=()
old_ifs="$IFS"; IFS=','
for d in $DESTINATIONS_CSV; do
  d="$(printf '%s' "$d" | awk '{$1=$1; print}')"
  [ -n "$d" ] && DESTINATIONS+=("$d")
done
IFS="$old_ifs"
[ "${#DESTINATIONS[@]}" -eq 0 ] && { err "--destinations is empty"; exit 1; }

log "Plan"
echo "  zone:         $ZONE_NAME ($ZONE_ID)"
echo "  destinations: ${DESTINATIONS[*]}"
echo "  rules:"
for r in "${FORWARD_RULES[@]}"; do echo "    - ${r%%|*}  (${r#*|})"; done
echo "    - catch-all -> destinations"
[ $DRY_RUN -eq 1 ] && info "  (dry-run: no API writes)"
echo ""

# We need account id for destination address ops.
# Easiest: read it off the zone record we already fetched.
ACCOUNT_ID="$(cf_api_or_die GET "/zones/${ZONE_ID}" "" "zone fetch (for account id)" \
  | tr -d '\n' \
  | grep -oE '"account"[[:space:]]*:[[:space:]]*\{[^}]*\}' \
  | grep -oE '"id"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -n 1 \
  | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/')"
if [ -z "$ACCOUNT_ID" ]; then
  err "Could not derive account id from zone. Token may lack Account:Read."
  exit 1
fi
info "account id: $ACCOUNT_ID"

# -------- 1. enable email routing --------
log "Enabling Email Routing on zone..."
if [ $DRY_RUN -eq 1 ]; then
  info "  [dry-run] POST /zones/$ZONE_ID/email/routing/enable"
else
  # If already enabled, CF returns success=true and current state.
  # If not entitled / DNS conflict, success=false with a specific message.
  out="$(cf_api POST "/zones/${ZONE_ID}/email/routing/enable" "{}")"
  code="${out##*$'\n'}"
  body="${out%$'\n'*}"
  case "$code" in
    2*)
      if [ "$(_json_success "$body")" = "true" ]; then
        ok "Email Routing enabled (or already enabled)."
      else
        msg="$(_json_first_error "$body")"
        # If MX records already exist for an external provider, CF will refuse.
        # Treat "already enabled" style messages as ok.
        if printf '%s' "$msg" | grep -qiE "already.*enabled|enabled.*already"; then
          ok "Email Routing was already enabled."
        else
          err "Failed to enable Email Routing: $msg"
          exit 1
        fi
      fi
      ;;
    *)
      err "Enable call returned HTTP $code"
      msg="$(_json_first_error "$body")"
      [ -n "$msg" ] && err "  $msg"
      exit 1
      ;;
  esac
fi

# -------- 2. destination addresses --------
log "Ensuring destination addresses exist + verified..."

# Fetch existing destinations once.
existing_dests_body=""
if [ $DRY_RUN -eq 0 ]; then
  existing_dests_body="$(cf_api_or_die GET "/accounts/${ACCOUNT_ID}/email/routing/addresses?per_page=50" "" "list destinations")"
fi

# Helper: does this email already exist as a destination? echoes "yes"/"no".
dest_exists() {
  local email="$1"
  printf '%s' "$existing_dests_body" \
    | tr -d '\n' \
    | grep -qE "\"email\"[[:space:]]*:[[:space:]]*\"${email//./\\.}\"" \
    && echo yes || echo no
}
# Helper: is this destination verified? Looks for "verified":"<non-null timestamp>"
# next to the matching email. Heuristic but works against CF's payload shape.
dest_verified() {
  local email="$1"
  # Extract a window of ~400 chars around the matching email entry.
  printf '%s' "$existing_dests_body" \
    | tr -d '\n' \
    | grep -oE "\{[^{}]*\"email\"[[:space:]]*:[[:space:]]*\"${email//./\\.}\"[^{}]*\}" \
    | head -n 1 \
    | grep -qE "\"verified\"[[:space:]]*:[[:space:]]*\"[0-9]" \
    && echo yes || echo no
}

# Add any missing destinations.
for email in "${DESTINATIONS[@]}"; do
  if [ $DRY_RUN -eq 1 ]; then
    info "  [dry-run] would POST destination: $email"
    continue
  fi
  if [ "$(dest_exists "$email")" = "yes" ]; then
    info "  exists: $email"
  else
    payload="$(printf '{"email":"%s"}' "$email")"
    out="$(cf_api POST "/accounts/${ACCOUNT_ID}/email/routing/addresses" "$payload")"
    code="${out##*$'\n'}"; body="${out%$'\n'*}"
    case "$code" in
      2*)
        if [ "$(_json_success "$body")" = "true" ]; then
          ok "added destination: $email (Cloudflare emailed a confirm link)"
        else
          msg="$(_json_first_error "$body")"
          # Race: if it now exists, that's fine.
          if printf '%s' "$msg" | grep -qi "already"; then
            info "  exists (race): $email"
          else
            err "  failed to add $email: $msg"
            exit 1
          fi
        fi
        ;;
      *)
        msg="$(_json_first_error "$body")"
        err "  add $email failed (HTTP $code): ${msg:-$body}"; exit 1 ;;
    esac
  fi
done

# Refresh and poll for verification.
if [ $DRY_RUN -eq 0 ]; then
  log "Waiting for destinations to be verified (each recipient must click the link Cloudflare emailed)..."
  log "Timeout: ${POLL_TIMEOUT_SECS}s. You can Ctrl-C and re-run later; this script is idempotent."
  start_ts="$(date +%s)"
  while :; do
    existing_dests_body="$(cf_api_or_die GET "/accounts/${ACCOUNT_ID}/email/routing/addresses?per_page=50" "" "list destinations")"
    all_ok=1
    for email in "${DESTINATIONS[@]}"; do
      if [ "$(dest_verified "$email")" = "yes" ]; then
        :
      else
        all_ok=0
        printf "  %s[pending]%s %s\n" "$C_YLW" "$C_R" "$email"
      fi
    done
    if [ $all_ok -eq 1 ]; then
      for email in "${DESTINATIONS[@]}"; do ok "verified: $email"; done
      break
    fi
    now_ts="$(date +%s)"
    if [ $(( now_ts - start_ts )) -ge $POLL_TIMEOUT_SECS ]; then
      err "Timed out waiting for destination verification."
      err "Open each confirmation email, click the link, then re-run this script."
      exit 1
    fi
    sleep "$POLL_INTERVAL_SECS"
  done
fi

# -------- 3. routing rules --------
log "Creating routing rules..."

# Fetch existing rules once for idempotency.
existing_rules_body=""
if [ $DRY_RUN -eq 0 ]; then
  existing_rules_body="$(cf_api_or_die GET "/zones/${ZONE_ID}/email/routing/rules?per_page=50" "" "list rules")"
fi

# Heuristic: is there already a rule whose matcher targets this email?
rule_for_address_exists() {
  local email="$1"
  printf '%s' "$existing_rules_body" \
    | tr -d '\n' \
    | grep -qE "\"type\"[[:space:]]*:[[:space:]]*\"literal\"[^}]*\"value\"[[:space:]]*:[[:space:]]*\"${email//./\\.}\"" \
    && echo yes || echo no
}
# Is there already a catch_all rule?
catchall_exists() {
  printf '%s' "$existing_rules_body" \
    | tr -d '\n' \
    | grep -qE "\"type\"[[:space:]]*:[[:space:]]*\"all\"" \
    && echo yes || echo no
}

# Build the "actions" JSON array once: forward to each destination.
build_forward_actions() {
  local out="["
  local first=1
  for email in "${DESTINATIONS[@]}"; do
    [ $first -eq 1 ] || out="${out},"
    first=0
    out="${out}{\"type\":\"forward\",\"value\":[\"${email}\"]}"
  done
  out="${out}]"
  printf '%s' "$out"
}
ACTIONS_JSON="$(build_forward_actions)"

# Per-address rules.
for entry in "${FORWARD_RULES[@]}"; do
  matcher_email="${entry%%|*}"
  desc="${entry#*|}"
  if [ $DRY_RUN -eq 1 ]; then
    info "  [dry-run] would create rule '$desc' for $matcher_email -> ${DESTINATIONS[*]}"
    continue
  fi
  if [ "$(rule_for_address_exists "$matcher_email")" = "yes" ]; then
    info "  exists: rule for $matcher_email"
    continue
  fi
  payload=$(cat <<JSON
{
  "name": "${desc}",
  "enabled": true,
  "matchers": [
    { "type": "literal", "field": "to", "value": "${matcher_email}" }
  ],
  "actions": ${ACTIONS_JSON},
  "priority": 10
}
JSON
)
  cf_api_or_die POST "/zones/${ZONE_ID}/email/routing/rules" "$payload" "create rule for $matcher_email" >/dev/null
  ok "created rule: $matcher_email -> ${DESTINATIONS[*]}"
done

# Catch-all rule (uses a different endpoint shape in CF's API — same path, but
# matcher type "all" with no actions list other than forward).
if [ $DRY_RUN -eq 1 ]; then
  info "  [dry-run] would create catch-all rule -> ${DESTINATIONS[*]}"
else
  if [ "$(catchall_exists)" = "yes" ]; then
    info "  exists: catch-all rule"
  else
    payload=$(cat <<JSON
{
  "name": "catch-all -> team",
  "enabled": true,
  "matchers": [ { "type": "all" } ],
  "actions": ${ACTIONS_JSON}
}
JSON
)
    # CF has a dedicated catch-all endpoint (PUT) — using it is cleaner.
    out="$(cf_api PUT "/zones/${ZONE_ID}/email/routing/rules/catch_all" "$payload")"
    code="${out##*$'\n'}"; body="${out%$'\n'*}"
    case "$code" in
      2*)
        if [ "$(_json_success "$body")" = "true" ]; then
          ok "created catch-all -> ${DESTINATIONS[*]}"
        else
          msg="$(_json_first_error "$body")"
          err "catch-all create failed: $msg"; exit 1
        fi ;;
      *)
        msg="$(_json_first_error "$body")"
        err "catch-all create failed (HTTP $code): ${msg:-$body}"; exit 1 ;;
    esac
  fi
fi

echo ""
ok "Done."
echo ""
log "Next steps"
cat <<EOF
  1. Send a test email to noreply@${ZONE_NAME} from a personal inbox.
     It should land in each destination: ${DESTINATIONS[*]}
  2. For the 'hello@mail.${ZONE_NAME}' rule to work, the 'mail' subdomain
     needs its own Email Routing setup (separate zone or subdomain routing).
     See docs/EMAIL_SETUP.md.
  3. Configure outbound (AWS SES) per docs/EMAIL_SETUP.md section 2.
EOF
