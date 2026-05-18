# Domain Migration Runbook — debatekit.com

This runbook walks the operator through registering `debatekit.com` (if not already registered), moving DNS authority from GoDaddy to Cloudflare (under Soheil's Cloudflare account), and wiring up the subdomains the DebateKit Workers expect.

**Scope:** primarily `debatekit.com`. The same procedure applies to any other deadpixel domains currently parked at GoDaddy that should also move to Cloudflare — see [Section 10](#10-other-domains).

**Constraints:**
- Operator runs all commands locally. This doc never assumes Claude has CF API access.
- No real credentials are stored here. Replace placeholders inline at runtime.

---

## 1. Prerequisites

- [ ] Cloudflare access: log in as `ava@deadpixel.ai` via Google SSO at https://dash.cloudflare.com/login, then switch to **Soheil's account** (id `c21c4d074e34a8b1b9d335a41c2f69e3`) via the account switcher in the top-left.
- [ ] GoDaddy access: log in as `firstexhotic@gmail.com` at https://sso.godaddy.com/login (Ava's personal GoDaddy).
- [ ] Decide: is `debatekit.com` already registered?
  - Check via WHOIS: https://www.whois.com/whois/debatekit.com
  - If unregistered → go to [Section 2](#2-register-debatekitai-if-not-already).
  - If already registered in Ava's GoDaddy → skip to [Section 3](#3-add-zone-to-cloudflare).
- [ ] Local tooling for the optional verification step: `dig` (built-in on macOS), `wrangler` (already installed in the project repos).

---

## 2. Register debatekit.com (if not already)

`.ai` is run by NIC.AI (Anguilla). Notes:

- **Minimum registration is 2 years** (registry rule, not GoDaddy's).
- Typical price: **$80–100/year** at GoDaddy. Cheaper at Porkbun (~$55/yr) if cost matters more than keeping everything in one registrar.
- WHOIS privacy is **not required** by the registry, but GoDaddy will offer it — accept the free tier.

Steps:

1. Open https://www.godaddy.com/domainsearch/find?domainToCheck=debatekit.com
2. Add `debatekit.com` to cart. Set registration term to 2 years.
3. Decline upsells (no need for GoDaddy hosting, email, SSL — Cloudflare covers all of that).
4. Pay with the team card.
5. Wait 5–15 min for the domain to appear in https://dcc.godaddy.com/control/portfolio
6. Confirm the domain is active (status: "Active") before moving on.

---

## 3. Add zone to Cloudflare

1. Open https://dash.cloudflare.com/c21c4d074e34a8b1b9d335a41c2f69e3/add-site
2. Enter `debatekit.com` and click **Continue**.
3. Select **Free** plan. (Free is sufficient for our needs. Upgrade later only if we want WAF rules, Argo Smart Routing, or Image Resizing.)
4. Cloudflare will scan existing DNS records. For a freshly registered domain this should be **empty** — that's fine.
5. Click **Continue** to land on the "Change your nameservers" screen.
6. Copy the **two Cloudflare-assigned nameservers** shown (format: `aaa.ns.cloudflare.com` + `bbb.ns.cloudflare.com`, where `aaa`/`bbb` are unique per zone). Keep this tab open.

---

## 4. Swap nameservers in GoDaddy

1. Open https://dcc.godaddy.com/manage/dns?domainName=debatekit.com (signed in as `firstexhotic@gmail.com`).
2. Scroll to the **Nameservers** card and click **Change**.
3. Switch from **"GoDaddy defaults"** to **"I'll use my own nameservers"**.
4. Paste the two Cloudflare nameservers from [Section 3](#3-add-zone-to-cloudflare).
5. Click **Save**. GoDaddy will warn that DNS is being delegated externally and that any existing GoDaddy DNS records will stop being authoritative. **Confirm.**
6. Back in the Cloudflare add-site tab, click **Done, check nameservers** to queue activation.

---

## 5. Wait for propagation

- Typical wait: **5–30 min** for a freshly registered domain; up to **24h** for older domains with cached NS records.
- Cloudflare will email Soheil's account email (`ava@deadpixel.ai` if logged in via that SSO) when activation completes. Zone status will flip to **Active** in https://dash.cloudflare.com/c21c4d074e34a8b1b9d335a41c2f69e3/debatekit.com
- Optional local check (operator runs):

  ```bash
  dig +short NS debatekit.com @8.8.8.8
  ```

  Expect two `*.ns.cloudflare.com` entries.

---

## 6. Add DNS records in Cloudflare

The DebateKit Workers declare their custom domains via `routes` blocks in each `wrangler.jsonc`. Once the zone is active and you run `wrangler deploy`, Cloudflare **auto-creates the corresponding DNS records** (proxied `A` records pointing at `100::`/Workers infra) — you do not need to add them by hand.

Subdomains expected by the Workers:

| Type | Name             | Target                  | Proxy | Purpose                  |
|------|------------------|-------------------------|-------|--------------------------|
| A    | `@`              | (Workers routes auto)   | yes   | web prod (apex)          |
| A    | `api`            | (Workers routes auto)   | yes   | api prod                 |
| A    | `mcp`            | (Workers routes auto)   | yes   | mcp prod                 |
| A    | `web-preview`    | (Workers routes auto)   | yes   | web preview              |
| A    | `api-preview`    | (Workers routes auto)   | yes   | api preview              |
| A    | `mcp-preview`    | (Workers routes auto)   | yes   | mcp preview              |
| A    | `slack`          | (Workers routes auto)   | yes   | slack worker             |
| A    | `telegram`       | (Workers routes auto)   | yes   | telegram worker          |
| A    | `whatsapp`       | (Workers routes auto)   | yes   | whatsapp worker          |

**Verification:** open each `wrangler.jsonc` and confirm the `routes` block lists the correct `pattern` + `custom_domain: true`. Example shape:

```jsonc
"routes": [
  { "pattern": "api.debatekit.com", "custom_domain": true }
]
```

Then deploy each worker (run from each worker package):

```bash
wrangler deploy
```

After deploy, verify in the dashboard: **Workers & Pages → `<worker-name>` → Settings → Triggers → Custom Domains**.

If for some reason a worker is *not* claiming a subdomain (e.g. a marketing landing page hosted elsewhere), add the DNS record manually:

```bash
# Example: manual proxied A record (requires CF_API_TOKEN with Zone.DNS:Edit)
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"A","name":"www","content":"192.0.2.1","proxied":true,"ttl":1}'
```

(Zone ID is on the Cloudflare zone overview page, right-hand sidebar.)

---

## 7. Email DNS records

Email for `debatekit.com` is handled in a separate runbook so receiving (Cloudflare Email Routing) and sending (AWS SES) can evolve independently of the DNS migration.

See **[`docs/EMAIL_SETUP.md`](./EMAIL_SETUP.md)** for the exact records:

- MX (Cloudflare Email Routing inbound)
- SPF (TXT, includes SES + CF)
- DKIM (3× CNAME from SES)
- DMARC (TXT)

Addresses that must work after that doc is applied:

- `noreply@debatekit.com` — transactional outbound (SES)
- `support@debatekit.com` — inbound, routed to a human inbox via Email Routing
- `hello@mail.debatekit.com` — inbound on the `mail.` subdomain (separate MX on the `mail` subdomain)

Do **not** add these records yet if the email runbook hasn't been finalised — adding partial SPF/DKIM/DMARC can break deliverability harder than having none.

---

## 8. SSL/TLS

In the Cloudflare dashboard for the `debatekit.com` zone:

1. **SSL/TLS → Overview** → set encryption mode to **Full (strict)**.
   - This requires the Workers to serve a valid cert on the origin. Workers do this automatically — no action needed.
2. **SSL/TLS → Edge Certificates**:
   - [ ] **Always Use HTTPS:** on
   - [ ] **Automatic HTTPS Rewrites:** on
   - [ ] **Minimum TLS Version:** 1.2
   - [ ] **Opportunistic Encryption:** on
3. **HSTS:** leave **off** for now. Enable only after ~1 week of stable traffic — once HSTS is pinned, any cert/DNS misconfig will lock users out of the domain for the `max-age` window.

---

## 9. Verification checklist

After NS swap + Workers deploy:

- [ ] `dig +short NS debatekit.com @8.8.8.8` returns two `*.ns.cloudflare.com` entries
- [ ] Cloudflare zone status shows **Active** (https://dash.cloudflare.com/c21c4d074e34a8b1b9d335a41c2f69e3/debatekit.com)
- [ ] `https://debatekit.com` loads and the browser shows a Cloudflare-issued cert (click the padlock → "Certificate is valid" → issuer is Google Trust Services or Let's Encrypt via CF)
- [ ] Each Worker's custom domain appears under **Workers & Pages → `<worker>` → Settings → Triggers → Custom Domains** with status **Active**
- [ ] No "I'm not the DNS authority for this zone" warning in the CF zone overview banner
- [ ] `dig +short api.debatekit.com` returns Cloudflare anycast IPs (`104.x.x.x` / `172.x.x.x`)
- [ ] All 9 subdomains in the table from [Section 6](#6-add-dns-records-in-cloudflare) resolve

---

## 10. Other domains

If Soheil has other deadpixel-owned domains in the same GoDaddy account that should also move to Cloudflare, repeat **steps 3 through 8** for each. Track them here:

- [ ] `debatekit.com` — primary, this runbook
- [ ] `_________________` — purpose: _________
- [ ] `_________________` — purpose: _________
- [ ] `_________________` — purpose: _________

(Operator: fill in the list before starting, or ask Soheil for the full portfolio export from https://dcc.godaddy.com/control/portfolio.)

Each domain is an independent CF zone — they don't share NS or settings. The only thing that's shared is the Cloudflare account they all live under.

---

## 11. Rollback

If something goes wrong and we need to revert DNS authority to GoDaddy:

1. Go to https://dcc.godaddy.com/manage/dns?domainName=debatekit.com
2. Under **Nameservers**, switch back to **"GoDaddy defaults"** and save.
3. Wait 5–30 min for propagation.
4. Any DNS records that previously existed in GoDaddy will resume serving.

Cloudflare **keeps the zone configuration** when nameservers point elsewhere — the zone just goes into a "Pending / not the authority" state. If you swap NS back to Cloudflare later, all records and settings are still there. No reconfiguration needed for a quick flip-flop.

For a permanent removal: delete the zone from CF afterward via **Manage Account → Zones → debatekit.com → Advanced Actions → Remove Site**.

---

## Appendix — useful links

- Cloudflare account: https://dash.cloudflare.com/c21c4d074e34a8b1b9d335a41c2f69e3
- Add a zone: https://dash.cloudflare.com/c21c4d074e34a8b1b9d335a41c2f69e3/add-site
- GoDaddy portfolio: https://dcc.godaddy.com/control/portfolio
- GoDaddy DNS for debatekit.com: https://dcc.godaddy.com/manage/dns?domainName=debatekit.com
- GoDaddy registration search: https://www.godaddy.com/domainsearch/find?domainToCheck=debatekit.com
- WHOIS check: https://www.whois.com/whois/debatekit.com
- Sibling runbook (email): [`./EMAIL_SETUP.md`](./EMAIL_SETUP.md)
