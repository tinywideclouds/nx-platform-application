import { test, expect } from '@playwright/test';
import { ContactsPage } from '../fixtures/contacts.po';
import { MOCK_ALICE } from '@nx-platform-application/contacts-app-mocking';

test.describe('Contacts: Responsive Master-Detail Layout', () => {
  let app: ContactsPage;

  test.beforeEach(async ({ page }) => {
    app = new ContactsPage(page);
    // Ensure we start in a clean state
    await app.goto('populated');
  });

  test('Desktop (Wide): Shows List and Detail simultaneously', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    // Navigate (Deep Link)
    const aliceId = MOCK_ALICE.id.toString();
    await page.goto(`/?scenario=populated&selectedId=${aliceId}`);

    // Check Layout
    await expect(app.sidebar).toBeVisible();
    await expect(app.mainPane).toBeVisible();

    // Logic Checks
    // FIX: Use Form PO property which now uses getByLabel
    await expect(app.form.firstName).toHaveValue(MOCK_ALICE.firstName);
    await expect(app.sidebar).toContainText(MOCK_ALICE.alias);
  });

  test('Mobile (Narrow): Enforces Single-Pane View', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const aliceId = MOCK_ALICE.id.toString();

    // --- CASE 1: LIST VIEW ---
    await page.goto('/?scenario=populated');

    await expect(app.sidebar).toBeVisible();
    await expect(app.mainPane).toBeHidden();

    // --- CASE 2: DETAIL VIEW ---
    await page.goto(`/?scenario=populated&selectedId=${aliceId}`);

    await expect(app.sidebar).toBeHidden();
    await expect(app.mainPane).toBeVisible();

    // FIX: Use Form PO property which now uses getByLabel
    await expect(app.form.firstName).toHaveValue(MOCK_ALICE.firstName);
  });
});
