import { test, expect } from '@playwright/test';
import { MOCK_ALICE } from '@nx-platform-application/contacts-app-mocking';

test.describe('Contacts: Responsive Master-Detail Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?scenario=populated');
    await page.waitForLoadState('networkidle');
  });

  test('Desktop (Wide): Shows List and Detail simultaneously', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // Navigate (Deep Link)
    const aliceId = MOCK_ALICE.id.toString();
    await page.goto(`/?scenario=populated&selectedId=${aliceId}`);

    const sidebar = page.locator('.md-sidebar');
    const main = page.locator('.md-main');

    await expect(sidebar).toBeVisible();
    await expect(main).toBeVisible();

    // ✅ FIX: Use toHaveValue for inputs
    await expect(main.getByLabel('First Name')).toHaveValue(
      MOCK_ALICE.firstName,
    );
    await expect(sidebar).toContainText(MOCK_ALICE.alias);
  });

  test('Mobile (Narrow): Enforces Single-Pane View', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const aliceId = MOCK_ALICE.id.toString();

    // --- CASE 1: LIST VIEW ---
    await page.goto('/?scenario=populated');

    await expect(page.locator('.md-sidebar')).toBeVisible();
    await expect(page.locator('.md-main')).toBeHidden();

    // --- CASE 2: DETAIL VIEW ---
    await page.goto(`/?scenario=populated&selectedId=${aliceId}`);

    await expect(page.locator('.md-sidebar')).toBeHidden();
    await expect(page.locator('.md-main')).toBeVisible();

    // ✅ FIX: Verify we are looking at Alice by checking the Input Value
    await expect(page.locator('.md-main').getByLabel('First Name')).toHaveValue(
      MOCK_ALICE.firstName,
    );
  });
});
