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
    await expect(app.list.emptyMessage).toBeVisible(); // Updated
    await expect(app.list.items).toHaveCount(0); // Updated

    // B. Start Creation
    await app.list.createButton.click(); // Updated
    await expect(page).toHaveURL(/new=contact/);

    // C. Validation Check
    await app.form.expectSaveButtonState('disabled'); // Updated

    // D. Fill Data
    await app.form.fill({
      firstName: 'Alice',
      surname: 'Wonderland',
      alias: 'Ali',
      email: 'alice@wonderland.com',
    });

    // E. Save
    await app.form.expectSaveButtonState('ready'); // Updated
    await app.form.saveButton.click();

    // F. Verify Redirect
    await expect(page).not.toHaveURL(/new=contact/);
    await expect(app.list.items).toHaveCount(1); // Updated
    await app.list.expectVisible('Ali'); // Updated
  });
});
