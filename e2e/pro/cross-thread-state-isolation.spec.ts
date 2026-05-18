import { expect, test } from '@playwright/test';

import { getMessageInput } from '../helpers';

/**
 * Cross-Thread State Isolation E2E Tests (Pro User)
 *
 * Verifies two critical bugs are fixed:
 * 1. State leaking: navigating from thread A to thread B
 *    should NOT show thread A's messages on thread B's page.
 * 2. Resume on navigate-back: navigating back to a completed thread
 *    should show the correct messages.
 *
 * Run with: bunx playwright test e2e/pro/cross-thread-state-isolation.spec.ts --project=chromium-pro
 */

// Run serially to avoid rate limiting
test.describe.configure({ mode: 'serial' });

// Store thread URLs across serial tests
let threadAUrl: string;
let threadBUrl: string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Scope assertions to main content area (excludes sidebar thread titles) */
function mainContent(page: import('@playwright/test').Page) {
  return page.locator('main');
}

/** Submit message with comprehensive retry logic */
async function submitMessage(page: import('@playwright/test').Page, message: string) {
  const input = getMessageInput(page);
  await expect(input).toBeEnabled({ timeout: 15000 });

  // Extra settle time for credits/stats loading
  await page.waitForTimeout(3000);

  await input.fill(message);
  await expect(input).toHaveValue(message);

  // Verify send button is enabled (credits loaded, not streaming, etc.)
  const sendButton = page.getByRole('button', { name: /send message/i });
  await expect(sendButton).toBeEnabled({ timeout: 15000 });

  // Try clicking the send button
  await sendButton.click();

  // Give it a moment to see if submission triggered
  await page.waitForTimeout(2000);

  // If the URL hasn't started changing and the text is still in the input,
  // the click didn't trigger submission. Retry with direct form.requestSubmit()
  const urlAfterClick = page.url();
  if (!urlAfterClick.match(/\/chat\/[\w-]+/)) {
    const inputValue = await input.inputValue().catch(() => '');
    if (inputValue === message) {
      // Click didn't work — try keyboard Enter
      await input.focus();
      await input.press('Enter');
      await page.waitForTimeout(2000);
    }

    // If still stuck, try direct form submit
    const urlAfterEnter = page.url();
    if (!urlAfterEnter.match(/\/chat\/[\w-]+/)) {
      const stillHasText = await input.inputValue().catch(() => '');
      if (stillHasText === message) {
        await page.evaluate(() => {
          const form = document.querySelector('form');
          if (form) {
            form.requestSubmit();
          }
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tests: Create Threads (these must run first)
// ---------------------------------------------------------------------------

test.describe('Setup: Create Test Threads', () => {
  test.setTimeout(300000);

  test('create thread A with unique message', async ({ page }) => {
    // Monitor API requests for debugging
    const apiRequests: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/') || response.url().includes('/unified-stream')) {
        apiRequests.push(`${response.status()} ${response.url().split('?')[0]}`);
      }
    });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('textarea')).toBeVisible({ timeout: 15000 });

    await submitMessage(page, 'Thread A canary msg xyzzy 7734');

    // Wait for thread navigation (round completes and URL changes)
    await page.waitForURL(/\/chat\/[\w-]+/, { timeout: 180000 });
    threadAUrl = page.url();
    expect(threadAUrl).toMatch(/\/chat\/[\w-]+/);

    // Wait for round to complete
    await expect(page.locator('textarea')).toBeEnabled({ timeout: 180000 });

    // Verify message visible in main content
    await expect(
      mainContent(page).getByText('Thread A canary msg xyzzy 7734').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('create thread B with unique message', async ({ page }) => {
    // Monitor API requests for debugging — capture full response body on errors
    const apiErrors: string[] = [];
    page.on('response', async (response) => {
      const status = response.status();
      if (status >= 400) {
        const body = await response.text().catch(() => 'N/A');
        apiErrors.push(`${status} ${response.url().split('?')[0]}: ${body.slice(0, 500)}`);
      }
    });

    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('textarea')).toBeVisible({ timeout: 15000 });

    await submitMessage(page, 'Thread B canary msg plugh 9921');

    // Check if any API errors occurred
    if (apiErrors.length > 0) {
      console.error('API errors during thread B creation:', apiErrors);
    }

    await page.waitForURL(/\/chat\/[\w-]+/, { timeout: 180000 });
    threadBUrl = page.url();
    expect(threadBUrl).toMatch(/\/chat\/[\w-]+/);

    await expect(page.locator('textarea')).toBeEnabled({ timeout: 180000 });

    await expect(
      mainContent(page).getByText('Thread B canary msg plugh 9921').first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Tests: State Isolation Between Threads
// ---------------------------------------------------------------------------

test.describe('State Isolation: Thread ↔ Thread', () => {
  test.setTimeout(60000);

  test('thread A does not show thread B messages', async ({ page }) => {
    test.skip(!threadAUrl, 'Thread A not created');

    await page.goto(threadAUrl, { waitUntil: 'networkidle' });
    await expect(page.locator('textarea')).toBeVisible({ timeout: 15000 });

    // Thread A's message should be visible
    await expect(
      mainContent(page).getByText('Thread A canary msg xyzzy 7734').first(),
    ).toBeVisible({ timeout: 10000 });

    // Thread B's message should NOT be visible in main content
    const leak = mainContent(page).getByText('Thread B canary msg plugh 9921');
    await expect(leak).toBeHidden({ timeout: 3000 });
  });

  test('thread B does not show thread A messages', async ({ page }) => {
    test.skip(!threadBUrl, 'Thread B not created');

    await page.goto(threadBUrl, { waitUntil: 'networkidle' });
    await expect(page.locator('textarea')).toBeVisible({ timeout: 15000 });

    // Thread B's message should be visible
    await expect(
      mainContent(page).getByText('Thread B canary msg plugh 9921').first(),
    ).toBeVisible({ timeout: 10000 });

    // Thread A's message should NOT be visible
    const leak = mainContent(page).getByText('Thread A canary msg xyzzy 7734');
    await expect(leak).toBeHidden({ timeout: 3000 });
  });

  test('navigate thread A → thread B → thread A → messages stay correct', async ({ page }) => {
    test.skip(!threadAUrl || !threadBUrl, 'Threads not created');

    // Visit thread A
    await page.goto(threadAUrl, { waitUntil: 'networkidle' });
    await expect(
      mainContent(page).getByText('Thread A canary msg xyzzy 7734').first(),
    ).toBeVisible({ timeout: 10000 });

    // Visit thread B
    await page.goto(threadBUrl, { waitUntil: 'networkidle' });
    await expect(
      mainContent(page).getByText('Thread B canary msg plugh 9921').first(),
    ).toBeVisible({ timeout: 10000 });
    // No thread A leak
    await expect(
      mainContent(page).getByText('Thread A canary msg xyzzy 7734'),
    ).toBeHidden({ timeout: 3000 });

    // Back to thread A
    await page.goto(threadAUrl, { waitUntil: 'networkidle' });
    await expect(
      mainContent(page).getByText('Thread A canary msg xyzzy 7734').first(),
    ).toBeVisible({ timeout: 10000 });
    // No thread B leak
    await expect(
      mainContent(page).getByText('Thread B canary msg plugh 9921'),
    ).toBeHidden({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Tests: State Isolation Between Thread and Overview
// ---------------------------------------------------------------------------

test.describe('State Isolation: Thread ↔ Overview', () => {
  test.setTimeout(60000);

  test('overview does not show thread messages in main content', async ({ page }) => {
    test.skip(!threadAUrl, 'Thread A not created');

    // Visit thread A first to "warm" the store
    await page.goto(threadAUrl, { waitUntil: 'networkidle' });
    await expect(
      mainContent(page).getByText('Thread A canary msg xyzzy 7734').first(),
    ).toBeVisible({ timeout: 10000 });

    // Navigate to overview
    await page.goto('/chat', { waitUntil: 'networkidle' });
    await expect(page.locator('textarea')).toBeVisible({ timeout: 15000 });

    // Overview should NOT have any user message bubbles
    const userMsgBubble = mainContent(page).locator('[data-message-role="user"]');
    await expect(userMsgBubble).toBeHidden({ timeout: 5000 });

    // Overview should show welcome content
    await expect(mainContent(page).getByText(/DebateKit/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('overview textarea is clean and functional after visiting thread', async ({ page }) => {
    test.skip(!threadAUrl, 'Thread A not created');

    await page.goto(threadAUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    await page.goto('/chat', { waitUntil: 'networkidle' });

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible({ timeout: 15000 });
    await expect(textarea).toBeEnabled({ timeout: 30000 });

    // Textarea should be empty
    await expect(textarea).toHaveValue('');

    // Should be able to type
    await textarea.fill('Test clean input');
    await expect(textarea).toHaveValue('Test clean input');
  });
});

// ---------------------------------------------------------------------------
// Tests: Navigation to Non-Chat Routes
// ---------------------------------------------------------------------------

test.describe('State Isolation: Thread ↔ Pricing', () => {
  test.setTimeout(60000);

  test('pricing page has no thread message bubbles', async ({ page }) => {
    test.skip(!threadAUrl, 'Thread A not created');

    // Visit thread first
    await page.goto(threadAUrl, { waitUntil: 'networkidle' });
    await expect(
      mainContent(page).getByText('Thread A canary msg xyzzy 7734').first(),
    ).toBeVisible({ timeout: 10000 });

    // Navigate to pricing
    await page.goto('/chat/pricing', { waitUntil: 'networkidle' });

    // No user message bubbles on pricing
    const userMsgBubble = mainContent(page).locator('[data-message-role=\"user\"]');
    await expect(userMsgBubble).toBeHidden({ timeout: 3000 });
  });

  test('thread → pricing → back to thread → messages intact', async ({ page }) => {
    test.skip(!threadAUrl, 'Thread A not created');

    await page.goto(threadAUrl, { waitUntil: 'networkidle' });
    await expect(
      mainContent(page).getByText('Thread A canary msg xyzzy 7734').first(),
    ).toBeVisible({ timeout: 10000 });

    // Pricing detour
    await page.goto('/chat/pricing', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Back to thread
    await page.goto(threadAUrl, { waitUntil: 'networkidle' });
    await expect(
      mainContent(page).getByText('Thread A canary msg xyzzy 7734').first(),
    ).toBeVisible({ timeout: 15000 });

    // Input should be functional
    await expect(page.locator('textarea')).toBeEnabled({ timeout: 30000 });
  });
});

// ---------------------------------------------------------------------------
// Tests: Rapid Navigation Stress
// ---------------------------------------------------------------------------

test.describe('Rapid Navigation Stress', () => {
  test.setTimeout(60000);

  test('rapid hops: overview ↔ thread A ↔ pricing ↔ thread B → app stays functional', async ({ page }) => {
    test.skip(!threadAUrl || !threadBUrl, 'Threads not created');

    const routes = ['/chat', threadAUrl, '/chat/pricing', threadBUrl, '/chat', threadAUrl, '/chat'];

    for (const route of routes) {
      try {
        await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(500);
      } catch {
        // Navigation interrupted — acceptable in stress test
      }
    }

    // End on overview — should be functional
    await page.goto('/chat', { waitUntil: 'networkidle' });
    await expect(page.locator('textarea')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('textarea')).toBeEnabled({ timeout: 30000 });

    const textarea = page.locator('textarea');
    await textarea.fill('Post-stress functional check');
    await expect(textarea).toHaveValue('Post-stress functional check');
  });

  test('rapid hops do not leak messages into overview', async ({ page }) => {
    test.skip(!threadAUrl || !threadBUrl, 'Threads not created');

    // Rapid sequence ending on overview
    await page.goto(threadAUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await page.goto(threadBUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);
    await page.goto('/chat', { waitUntil: 'networkidle' });

    // No message bubbles in overview
    const userMsgBubble = mainContent(page).locator('[data-message-role="user"]');
    await expect(userMsgBubble).toBeHidden({ timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Tests: Navigate Back to Completed Thread
// ---------------------------------------------------------------------------

test.describe('Navigate Back to Completed Thread', () => {
  test.setTimeout(60000);

  test('completed thread survives overview → pricing → back round trip', async ({ page }) => {
    test.skip(!threadAUrl, 'Thread A not created');

    // Overview
    await page.goto('/chat', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Pricing
    await page.goto('/chat/pricing', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Back to thread A
    await page.goto(threadAUrl, { waitUntil: 'networkidle' });

    await expect(
      mainContent(page).getByText('Thread A canary msg xyzzy 7734').first(),
    ).toBeVisible({ timeout: 15000 });

    await expect(page.locator('textarea')).toBeEnabled({ timeout: 30000 });
  });

  test('thread input accepts follow-up after navigation round trip', async ({ page }) => {
    test.skip(!threadAUrl, 'Thread A not created');

    await page.goto('/chat/pricing', { waitUntil: 'networkidle' });
    await page.goto(threadAUrl, { waitUntil: 'networkidle' });

    await expect(page.locator('textarea')).toBeEnabled({ timeout: 30000 });

    const input = getMessageInput(page);
    await input.fill('Follow-up after navigation');
    await expect(input).toHaveValue('Follow-up after navigation');
  });
});
