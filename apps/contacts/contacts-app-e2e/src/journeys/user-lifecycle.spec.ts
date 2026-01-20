import { test, expect } from '@playwright/test';
import { ContactsPage } from '../fixtures/contacts.po';

test.describe('Journey: Contact Lifecycle', () => {
  let app: ContactsPage;

  test.beforeEach(async ({ page }) => {
    app = new ContactsPage(page);
    await app.goto('empty');
  });

  test('should allow user to create, view, and delete a contact', async ({
    page,
  }) => {
    const newContact = {
      firstName: 'Charlie',
      surname: 'Bucket',
      alias: 'GoldenTicket',
      email: 'charlie@wonka.com',
    };

    // 1. CREATE
    await test.step('Create new contact', async () => {
      // FIX: Access via the List PO
      await app.list.createButton.click();

      // FIX: Access via the Form PO
      await app.form.fill(newContact);
      await app.form.saveButton.click();

      // Verification: Sidebar update via List PO
      await app.list.expectVisible(newContact.alias);
    });

    // 2. READ
    await test.step('View details', async () => {
      // FIX: Access via the List PO
      await app.list.select(newContact.alias);

      await expect(app.form.editButton).toBeVisible();
      await expect(app.form.firstName).toHaveValue(newContact.firstName);
    });

    // 3. DELETE
    await test.step('Delete contact', async () => {
      await app.form.editButton.click();

      // Intention Check (Optional but recommended by protocol)
      // await app.list.expectDiscardIntention(newContact.alias);

      await app.form.deleteButton.click();

      await expect(app.dialogConfirmButton).toBeVisible();
      await app.dialogConfirmButton.click();

      // Verification: Gone from list
      await app.list.expectHidden(newContact.alias);
    });
  });
});
