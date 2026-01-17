import { test, expect } from '@playwright/test';
import { ContactsPage } from '../fixtures/contacts.po';

test.describe('Journey: User Onboarding', () => {
  let app: ContactsPage;

  test.beforeEach(async ({ page }) => {
    app = new ContactsPage(page);
    await app.goto('empty');
  });

  test('should allow user to create their first contact', async ({ page }) => {
    // A. Verify Empty State
    await expect(app.emptyListMessage).toBeVisible();
    await expect(app.sidebarList).toHaveCount(0);

    // B. Start Creation
    await app.createContactButton.click();
    await expect(page).toHaveURL(/new=contact/);

    // C. Validation Check (Stage 1: Disabled)
    await app.expectSaveButtonState('disabled');

    // D. Fill Data
    await app.fillForm({
      firstName: 'Alice',
      surname: 'Wonderland',
      alias: 'Ali',
      email: 'alice@wonderland.com',
    });

    // E. Save (Stage 3: Ready)
    await app.expectSaveButtonState('ready');
    await app.saveButton.click();

    // F. Verify Redirect (List View)
    await expect(page).not.toHaveURL(/new=contact/);
    await expect(app.sidebarList).toHaveCount(1);
    await app.expectContactVisible('Ali');

    // ✅ FIX: Re-select the contact to view details
    await app.selectContact('Ali');

    // Check Detail View
    await expect(app.firstNameInput).toHaveValue('Alice');
  });
});
