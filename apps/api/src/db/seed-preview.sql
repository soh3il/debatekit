-- PREVIEW ENVIRONMENT (Test Mode)
-- Stripe Account: acct_1SPXN852vWNZ3v8w
-- URL: https://web-preview.debatekit.com
--
-- Synced from Stripe TEST mode on 2026-01-06
-- Product: Pro (prod_UYFCSIwtSMEqMx) - $59/month
-- Price: price_1TZ8iT2R16aMJLB0XbDt5CcP

-- Stripe Product Catalog - Pro Plan Only
INSERT OR IGNORE INTO stripe_product (id, name, description, active, default_price_id, metadata, images, features, created_at, updated_at) VALUES
('prod_UYFCSIwtSMEqMx', 'Pro', '2,000,000 credits per month with automatic renewal. Full access to all AI models.', 1, 'price_1TZ8iT2R16aMJLB0XbDt5CcP', '{"planType":"paid","displayOrder":"1","badge":"most_popular"}', '[]', '["2,000,000 credits per month","Automatic monthly renewal","Unlimited AI models","Priority support"]', 1766569436, 1767707231);

INSERT OR IGNORE INTO stripe_price (id, product_id, active, currency, unit_amount, type, `interval`, interval_count, trial_period_days, metadata, created_at, updated_at) VALUES
('price_1TZ8iT2R16aMJLB0XbDt5CcP', 'prod_UYFCSIwtSMEqMx', 1, 'usd', 5900, 'recurring', 'month', 1, NULL, '{"planType":"paid"}', 1767707199, 1767707199);
