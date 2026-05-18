# Email setup — debatekit.com

Two independent paths:

- **Inbound** — Cloudflare Email Routing. Forwards mail to team inboxes. Free.
- **Outbound** — AWS SES. The app sends transactional mail (auth verification, password reset, etc.) using `AWS_SES_*` env vars in `apps/api/.dev.vars`.

Set them up in either order; they don't depend on each other.

---

## 1. Inbound (Cloudflare Email Routing)

### Why Cloudflare
- Free for forwarding (no mailbox hosting, no per-message cost).
- DNS records (MX + SPF TXT) are managed automatically by Cloudflare on enable.
- Already in the same dashboard as the zone — no extra vendor.

### Mailboxes
| Address | Role |
|---|---|
| `noreply@debatekit.com` | App transactional sender (outbound via SES); also forwards inbound replies to team. |
| `support@debatekit.com` | Shared support inbox; team replies manually. |
| `hello@mail.debatekit.com` | Low-volume marketing/newsletter address. Subdomain isolates marketing reputation from transactional. |
| `*@debatekit.com` (catch-all) | Everything else forwards to the team. |

All inbound forwards to: `ava@deadpixel.ai`, `soheil@deadpixel.ai`.

### Option A — set up via dashboard (recommended for first run)

1. Open <https://dash.cloudflare.com/67bc7b518b92a0c406ac9b8526ddbb6d/debatekit.com/email/routing>.
2. Click **Enable Email Routing**. Cloudflare adds the MX and SPF records to the zone automatically.
3. Under **Destination addresses**, add `ava@deadpixel.ai` and `soheil@deadpixel.ai`. Cloudflare emails each address a confirm link — both recipients must click it.
4. Under **Routing rules**, create:
   - `noreply@debatekit.com` → forward to both destinations
   - `support@debatekit.com` → forward to both destinations
   - `hello@mail.debatekit.com` → forward to both destinations (requires the `mail` subdomain to also have Email Routing enabled; see note below)
   - Catch-all rule → forward to both destinations
5. Send a test from a personal account to confirm.

> Subdomain note: `hello@mail.debatekit.com` lives on a different DNS name from the apex. Cloudflare Email Routing only handles inbound for zones it manages. Two options: (a) add `mail.debatekit.com` as its own zone and enable routing there, or (b) drop the marketing subdomain and send/receive marketing from the apex. (a) is preferred for reputation isolation.

### Option B — set up via script (idempotent, re-runnable)

```bash
# Create an API token at https://dash.cloudflare.com/profile/api-tokens with:
#   - Zone:Read
#   - Account:Read
#   - Email Routing Addresses:Edit
#   - Email Routing Rules:Edit
export CLOUDFLARE_API_TOKEN=...

# Dry-run first to inspect the plan
./scripts/setup-email-routing.sh --dry-run

# Apply
./scripts/setup-email-routing.sh

# Customize zone or destinations
./scripts/setup-email-routing.sh \
  --zone debatekit.com \
  --destinations ava@deadpixel.ai,soheil@deadpixel.ai
```

The script: resolves the zone, enables Email Routing, adds destinations (Cloudflare emails confirm links), polls until verified (5-minute timeout), then creates per-address rules + a catch-all. Re-running is safe — it checks for existing destinations and rules before creating.

---

## 2. Outbound (AWS SES)

### Why SES
- The app already expects `AWS_SES_ACCESS_KEY_ID` / `AWS_SES_SECRET_ACCESS_KEY` (`apps/api/.dev.vars`).
- Cheap ($0.10 per 1k emails), high deliverability, no per-domain monthly fee.
- Production-grade quotas after sandbox approval.

### Region
Use **`us-east-1`** unless EU data residency is a hard requirement. Cheapest, highest quotas, fewest cross-region gotchas. (If you later need EU residency: `eu-west-1` works the same but credentials are region-scoped — pick once and stick with it.)

### Steps

1. **Verify the domain.**
   Open <https://us-east-1.console.aws.amazon.com/ses/home?region=us-east-1#/verified-identities> → **Create identity** → **Domain** → `debatekit.com` → enable Easy DKIM (RSA 2048). SES gives you three CNAME records (`<token1>._domainkey.debatekit.com` → `<token1>.dkim.amazonses.com`, etc.). Add them to the Cloudflare zone (proxy OFF — DKIM lookups need raw CNAMEs).

2. **SPF.**
   Add TXT on `@`:
   ```
   v=spf1 include:amazonses.com -all
   ```
   If you already have an SPF record, merge — only one SPF TXT per host. (Cloudflare Email Routing adds its own `include:_spf.mx.cloudflare.net` SPF; combine both: `v=spf1 include:amazonses.com include:_spf.mx.cloudflare.net -all`.)

3. **DMARC.**
   Add TXT on `_dmarc.debatekit.com`:
   ```
   v=DMARC1; p=quarantine; rua=mailto:postmaster@debatekit.com; ruf=mailto:postmaster@debatekit.com; fo=1
   ```
   Start with `p=quarantine`; move to `p=reject` once you're confident no legit mail is failing alignment.

4. **Wait for verification.** SES polls DNS; usually a few minutes via Cloudflare. Identity will flip to **Verified** with **DKIM: Successful**.

5. **Request production access.**
   New SES accounts are in **sandbox** (can only send to verified recipients, 200/day limit). Open <https://us-east-1.console.aws.amazon.com/ses/home?region=us-east-1#/account> → **Request production access**. Explain the use case (transactional only: auth, password reset, account notifications), expected volume, and bounce/complaint handling. Approval typically 24h.

6. **Create the IAM sender.**
   IAM → **Users** → **Create user** → `debatekit-ses-sender` (programmatic access only, no console login). Attach a scoped policy:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["ses:SendEmail", "ses:SendRawEmail"],
       "Resource": "arn:aws:ses:us-east-1:<ACCOUNT_ID>:identity/debatekit.com"
     }]
   }
   ```

   Then **Security credentials** → **Create access key** → use case "Application running outside AWS".

7. **Drop credentials into `apps/api/.dev.vars`:**
   ```
   AWS_SES_ACCESS_KEY_ID=<from step 6>
   AWS_SES_SECRET_ACCESS_KEY=<from step 6>
   ```
   For deployed environments use `./scripts/bootstrap-cf-secrets.sh --app api` to push them to Cloudflare Worker secrets.

---

## 3. Role mapping

| Mailbox | Inbound (forwards to) | Outbound (sent by app from) |
|---|---|---|
| `noreply@debatekit.com` | ava + soheil | yes — auth verification, password reset, account notifications |
| `support@debatekit.com` | ava + soheil | manual replies from team (via personal client w/ "Send As") |
| `hello@mail.debatekit.com` | ava + soheil | marketing / newsletters (low volume) |
| `*@debatekit.com` (catch-all) | ava + soheil | — |

---

## 4. DNS records summary

All records live in the Cloudflare zone for `debatekit.com`. The script doesn't add these — Cloudflare (for routing) and SES (for DKIM) add them via their dashboards. Listed here for reference.

| Name | Type | Value | Added by | Purpose |
|---|---|---|---|---|
| `debatekit.com` | MX (prio 10) | `route1.mx.cloudflare.net` | CF Email Routing | Inbound |
| `debatekit.com` | MX (prio 20) | `route2.mx.cloudflare.net` | CF Email Routing | Inbound |
| `debatekit.com` | MX (prio 30) | `route3.mx.cloudflare.net` | CF Email Routing | Inbound |
| `debatekit.com` | TXT | `v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com -all` | merged manually | SPF (both senders) |
| `<token1>._domainkey` | CNAME | `<token1>.dkim.amazonses.com` | SES (3 records) | DKIM |
| `<token2>._domainkey` | CNAME | `<token2>.dkim.amazonses.com` | SES | DKIM |
| `<token3>._domainkey` | CNAME | `<token3>.dkim.amazonses.com` | SES | DKIM |
| `_dmarc` | TXT | `v=DMARC1; p=quarantine; rua=mailto:postmaster@debatekit.com; fo=1` | manual | DMARC |
| `mail` (subdomain zone) | MX×3 | `route{1,2,3}.mx.cloudflare.net` | CF Email Routing on `mail` zone | Marketing subdomain inbound |

DKIM CNAMEs must NOT be proxied (orange-cloud OFF) — orange-cloud only proxies HTTP, and SES needs raw DNS resolution.

---

## 5. Verification checklist

- [ ] Send a test email from a personal account → `noreply@debatekit.com`. Confirm it lands in both `ava@deadpixel.ai` and `soheil@deadpixel.ai`.
- [ ] Same for `support@debatekit.com` and `hello@mail.debatekit.com`.
- [ ] Send to a made-up address (`random123@debatekit.com`) to confirm catch-all works.
- [ ] Trigger a password reset from the app — confirm SES delivers the message and the From address is `noreply@debatekit.com`.
- [ ] Run a deliverability test: send to a fresh address at <https://www.mail-tester.com/> and aim for ≥ 9/10. Anything below means SPF, DKIM, or DMARC alignment is broken.
- [ ] After ~48h of production sending, check SES → Reputation dashboard. Bounce rate < 5%, complaint rate < 0.1%.

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Script says "Destination address not verified" forever | Recipient didn't click the Cloudflare confirm email | Check inbox + spam; re-run the script (it re-polls). To re-send the confirmation, delete the destination in the CF dashboard and re-add. |
| MX records missing on `debatekit.com` | Email Routing not enabled, or enable failed silently | Open CF dashboard → Email → Routing → **Enable**. If a third-party MX (Google, Fastmail) was there first, CF refuses — remove the conflicting MX records first. |
| SES "Message rejected: Email address is not verified" | Account is still in SES sandbox | Request production access in SES console; until then, verify the recipient address as an identity. |
| SES DKIM stuck at "Pending" > 1h | CNAME records wrong or proxied | In CF DNS, confirm the three `*._domainkey` CNAMEs match SES exactly and have orange-cloud OFF. |
| Inbound mail bounces with "550 5.7.1" or similar | SPF or DMARC alignment broken (often from a stale SPF record) | Only one SPF TXT per host — merge into a single record with both `include:`s. |
| App throws `InvalidClientTokenId` from SES | IAM access key is wrong, deleted, or for a different account | Regenerate access key, update `.dev.vars`, push to Worker secrets via `./scripts/bootstrap-cf-secrets.sh --app api`. |
| `hello@mail.debatekit.com` doesn't receive | Email Routing only handles zones it manages — `mail.debatekit.com` needs its own zone or the routing rule should target the apex | Add `mail.debatekit.com` as a separate CF zone and enable Email Routing on it. |
| Mail-tester score 7/10 with "DKIM signed but not aligned" | App is sending from a `From:` that doesn't match the SES-verified domain | Ensure `From:` header uses `noreply@debatekit.com` exactly (not a subdomain or alias). |
