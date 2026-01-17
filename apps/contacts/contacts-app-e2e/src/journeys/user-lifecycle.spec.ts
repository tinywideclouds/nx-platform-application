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
      await app.createContactButton.click();
      await app.fillForm(newContact);
      await app.saveButton.click();

      // Verification: Sidebar update
      await app.expectContactVisible(newContact.alias);
    });

    // 2. READ
    await test.step('View details', async () => {
      // ✅ FIX: Select the contact first
      await app.selectContact(newContact.alias);

      // Now the "Edit" button should be visible (Read Mode)
      await expect(app.editButton).toBeVisible();
      await expect(app.firstNameInput).toHaveValue(newContact.firstName);
    });

    // 3. DELETE
    await test.step('Delete contact', async () => {
      // Enter Edit Mode
      await app.editButton.click();

      // Click Delete
      await app.deleteButton.click();

      // Handle Dialog
      await expect(app.dialogConfirmButton).toBeVisible();
      await app.dialogConfirmButton.click();

      // Verification: List should be empty again
      await app.expectContactHidden(newContact.alias);
      await expect(app.emptyListMessage).toBeVisible();
    });
  });
});
