# Hand-off for Soheil — owner-only actions

A few things are blocked on you as the account owner. None can be done by Ava or by automation.

## 1. Stripe KYC — **unpauses live payments** (highest priority)

The DebateKit Stripe account (`acct_1TZ8Fg2R16aMJLB0`) has **capabilities paused** — two required tasks are **past due (May 20, 2026)**:

- **Provide a passport** for the account representative (**Seyed Soheil Alavi**) — identity verification.
- **Provide a business license** for the business.

Until both are submitted and verified, live charges are at risk / paused regardless of the code being ready.
→ Dashboard: `https://dashboard.stripe.com/acct_1TZ8Fg2R16aMJLB0/account/status`

**This is exactly why prod checkout is currently broken.** Verified end-to-end: clicking "Get Started" on debatekit.com/chat/pricing calls `POST /api/v1/billing/checkout`, which calls Stripe `POST /v1/checkout/sessions` → **400**: *"No valid payment method types for this Checkout Session… activate payment methods compatible with your currency."* In Settings → Payment methods, **Cards = "Requires action"** because the live `card_payments` capability is paused on the KYC above. **Completing the 2 KYC tasks activates Cards → checkout works.** The integration code is correct; nothing else needs changing.

## 2. Cloudflare ↔ GitHub Workers Builds (only if Ava can't)

**No workers are currently Git-connected** on the Cloudflare account (`67bc7b51…`) — every deploy is a manual `wrangler deploy`. To enable auto-deploy on push:

1. In the CF dashboard, open any worker → **Settings → Build → Connect to Git → GitHub**.
2. **Authorize the Cloudflare GitHub App on `soh3il/debatekit`** (needs repo admin — Ava now has this, so she can do it; otherwise you).
3. After the repo is connected, the per-worker build config (root dir, build command, branch globs) is applied via `scripts/setup-cf-git-integration.sh` (needs a `CLOUDFLARE_API_TOKEN` with *Workers Scripts: Edit*).

Branch model the script uses: `main` → production deploy; every other branch → preview deploy.

## 3. (Optional) Stripe test-mode webhook

The **test-mode** webhook currently points at `api.debatekit.com` (prod) instead of `api-preview.debatekit.com`. If you want preview/test subscriptions to sync, add a test-mode endpoint → `https://api-preview.debatekit.com/api/v1/webhooks/stripe` and set its signing secret as the **preview** API worker's `STRIPE_WEBHOOK_SECRET`. (Prod/live webhook is already correct.)
