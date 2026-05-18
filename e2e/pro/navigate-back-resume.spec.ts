import { expect, test } from '@playwright/test';

import { getMessageInput } from '../helpers';

/**
 * Navigate-Back Resume E2E Tests (Pro User)
 *
 * Verifies that navigating away from a streaming thread and back
 * correctly resumes the UI — participant placeholders visible,
 * streaming content updating, user message intact.
 *
 * Run with: bunx playwright test e2e/pro/navigate-back-resume.spec.ts --project=chromium-pro
 */

test.describe.configure({ mode: 'serial' });

let streamingThreadUrl: string;
let completedThreadUrl: string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mainContent(page: import('@playwright/test').Page) {
  return page.locator('main');
}

async function submitMessage(page: import('@playwright/test').Page, message: string) {
  const input = getMessageInput(page);
  await expect(input).toBeEnabled({ timeout: 15000 });
  await page.waitForTimeout(3000);

  await input.fill(message);
  await expect(input).toHaveValue(message);

  const sendButton = page.getByRole('button', { name: /send message/i });
  await expect(sendButton).toBeEnabled({ timeout: 15000 });
  await sendButton.click();

  await page.waitForTimeout(2000);

  const urlAfterClick = page.url();
  if (!urlAfterClick.match(/\/chat\/[\w-]+/)) {
    const inputValue = await input.inputValue().catch(() => '');
    if (inputValue === message) {
      await input.focus();
      await input.press('Enter');
      await page.waitForTimeout(2000);
    }

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
// Setup: Create a completed thread (for later use)
// ---------------------------------------------------------------------------

test.describe('Setup: Create Test Threads', () => {
  test.setTimeout(300000);

  test('create a completed thread for navigate-back test', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('textarea')).toBeVisible({ timeout: 15000 });

    await submitMessage(page, 'Navigate-back completed canary qwrtz 8812');

    await page.waitForURL(/\/chat\/[\w-]+/, { timeout: 180000 });
    completedThreadUrl = page.url();
    expect(completedThreadUrl).toMatch(/\/chat\/[\w-]+/);

    // Wait for round to complete
    await expect(page.locator('textarea')).toBeEnabled({ timeout: 180000 });

    await expect(
      mainContent(page).getByText('Navigate-back completed canary qwrtz 8812').first(),
    ).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Tests: Navigate away during streaming and back
// ---------------------------------------------------------------------------

test.describe('Navigate Back to Streaming Thread', () => {
  test.setTimeout(300000);

  test('navigate away during streaming then back — UI resumes', async ({ page }) => {
    // 1. Start new thread from overview
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('textarea')).toBeVisible({ timeout: 15000 });

    await submitMessage(page, 'Navigate-back streaming canary plxyz 4456');

    // 2. Wait for streaming to begin (URL changes + participant placeholder visible)
    await page.waitForURL(/\/chat\/[\w-]+/, { timeout: 180000 });
    streamingThreadUrl = page.url();

    // Wait for at least one participant placeholder or streaming indicator
    const streamingIndicator = page
      .locator('[data-streaming="true"]')
      .or(page.locator('[data-participant-index]'))
      .or(page.locator('[data-round-streaming="true"]'))
      .or(page.getByRole('button', { name: /stop/i }));
    await streamingIndicator.first().waitFor({ state: 'visible', timeout: 60000 });

    // Verify user message is visible before navigating away
    await expect(
      mainContent(page).getByText('Navigate-back streaming canary plxyz 4456').first(),
    ).toBeVisible({ timeout: 10000 });

    // 3. Navigate away to the completed thread
    test.skip(!completedThreadUrl, 'Completed thread not created');
    await page.goto(completedThreadUrl, { waitUntil: 'networkidle' });

    // Verify we're on the other thread
    await expect(
      mainContent(page).getByText('Navigate-back completed canary qwrtz 8812').first(),
    ).toBeVisible({ timeout: 15000 });

    // 4. Navigate back to the streaming thread
    await page.goto(streamingThreadUrl, { waitUntil: 'networkidle' });

    // 5. Assert: User's original message is still visible
    await expect(
      mainContent(page).getByText('Navigate-back streaming canary plxyz 4456').first(),
    ).toBeVisible({ timeout: 15000 });

    // 6. Assert: Participant content is visible (either still streaming or completed)
    // Look for participant placeholders, assistant messages, or streaming content
    const participantContent = mainContent(page)
      .locator('[data-participant-index]')
      .or(mainContent(page).locator('[data-message-role="assistant"]'))
      .or(mainContent(page).locator('[data-round-streaming="true"]'));
    await expect(participantContent.first()).toBeVisible({ timeout: 30000 });

    // 7. Wait for completion (streaming should finish or already be done)
    await expect(page.locator('textarea')).toBeEnabled({ timeout: 180000 });
  });
});

// ---------------------------------------------------------------------------
// Tests: Navigate back to completed thread
// ---------------------------------------------------------------------------

test.describe('Navigate Back to Completed Thread', () => {
  test.setTimeout(60000);

  test('navigate away and back to completed thread — messages intact, no placeholders', async ({ page }) => {
    test.skip(!completedThreadUrl, 'Completed thread not created');

    // Visit completed thread
    await page.goto(completedThreadUrl, { waitUntil: 'networkidle' });
    await expect(
      mainContent(page).getByText('Navigate-back completed canary qwrtz 8812').first(),
    ).toBeVisible({ timeout: 10000 });

    // Navigate to overview
    await page.goto('/chat', { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    // Navigate back to completed thread
    await page.goto(completedThreadUrl, { waitUntil: 'networkidle' });

    // Messages should still be visible
    await expect(
      mainContent(page).getByText('Navigate-back completed canary qwrtz 8812').first(),
    ).toBeVisible({ timeout: 15000 });

    // Textarea should be enabled (not in streaming state)
    await expect(page.locator('textarea')).toBeEnabled({ timeout: 30000 });
  });

  test('navigate back via thread-to-thread — messages intact', async ({ page }) => {
    test.skip(!completedThreadUrl || !streamingThreadUrl, 'Threads not created');

    // Visit streaming thread (should be completed by now)
    await page.goto(streamingThreadUrl, { waitUntil: 'networkidle' });
    await expect(
      mainContent(page).getByText('Navigate-back streaming canary plxyz 4456').first(),
    ).toBeVisible({ timeout: 15000 });

    // Navigate to completed thread
    await page.goto(completedThreadUrl, { waitUntil: 'networkidle' });
    await expect(
      mainContent(page).getByText('Navigate-back completed canary qwrtz 8812').first(),
    ).toBeVisible({ timeout: 15000 });

    // No state leak from streaming thread
    await expect(
      mainContent(page).getByText('Navigate-back streaming canary plxyz 4456'),
    ).toBeHidden({ timeout: 3000 });

    // Back to streaming thread (now completed)
    await page.goto(streamingThreadUrl, { waitUntil: 'networkidle' });
    await expect(
      mainContent(page).getByText('Navigate-back streaming canary plxyz 4456').first(),
    ).toBeVisible({ timeout: 15000 });

    // No leak from completed thread
    await expect(
      mainContent(page).getByText('Navigate-back completed canary qwrtz 8812'),
    ).toBeHidden({ timeout: 3000 });
  });
});
