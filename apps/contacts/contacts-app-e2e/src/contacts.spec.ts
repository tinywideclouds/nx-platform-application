import { test, expect } from '@playwright/test';
import { ContactsPage } from './po/contacts.po';
import { MOCK_ALICE } from '@nx-platform-application/contacts-app-mocking';

test.describe('Contacts App', () => {
  let contactsPage: ContactsPage;

  test.beforeEach(async ({ page }) => {
    contactsPage = new ContactsPage(page);
  });

  test('Scenario: Empty State', async () => {
    await contactsPage.goto('empty');
    await expect(contactsPage.emptyListMessage).toBeVisible();
    await expect(contactsPage.emptyListMessage).toContainText(
      'No contacts found',
    );
    await expect(contactsPage.sidebarList).toHaveCount(0);
  });

  test('Scenario: Populated List', async () => {
    await contactsPage.goto('populated');
    const aliceRow = await contactsPage.getContactRow(MOCK_ALICE.alias);
    await expect(aliceRow).toBeVisible();
    await expect(aliceRow).toContainText(MOCK_ALICE.email);
  });

  test('Interaction: Select Contact', async ({ page }) => {
    await contactsPage.goto('populated');

    await contactsPage.selectContact(MOCK_ALICE.alias);

    // 1. URL Check
    await expect(page).toHaveURL(
      /selectedId=urn(:|%3A)contacts(:|%3A)user(:|%3A)alice/,
    );

    // 2. Detail Header Check
    await expect(contactsPage.detailHeader).toBeVisible();

    // 3. Form Data Check
    await expect(page.getByLabel('First Name')).toHaveValue(
      MOCK_ALICE.firstName,
    );
  });

  test('Flow: Create New Contact', async ({ page }) => {
    await contactsPage.goto('empty');

    // 1. Enter Create Mode
    await contactsPage.createButton.click();
    await expect(page).toHaveURL(/new=contact/);

    // 2. Fill Form
    await page.getByLabel('First Name').fill('Charlie');
    await page.getByLabel('Surname').fill('Bucket');
    await page.getByLabel('Alias').fill('Charlie');

    // ✅ FIX: Match the 'aria-label="email"' from the template
    await page.getByLabel('email').fill('charlie@factory.com');

    // 3. Save
    await page.getByTestId('save-button').click();

    // 4. Assert Redirect back to list
    await expect(page).not.toHaveURL(/new=contact/);

    // 5. Assert Charlie is now in the sidebar
    const newRow = await contactsPage.getContactRow('Charlie');
    await expect(newRow).toBeVisible();
  });
});
