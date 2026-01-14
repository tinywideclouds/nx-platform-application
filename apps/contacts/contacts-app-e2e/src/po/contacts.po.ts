import { Page, Locator, expect } from '@playwright/test';

export class ContactsPage {
  readonly page: Page;

  // Locators
  readonly sidebarList: Locator;
  readonly emptyListMessage: Locator;
  readonly detailHeader: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebarList = page.locator('contacts-list-item');
    this.emptyListMessage = page.getByTestId('empty-list');
    this.detailHeader = page.locator('contacts-viewer header h1');

    // Using the queryParams link we created in the sidebar
    this.createButton = page.locator('a[href*="new=contact"]');
  }

  async goto(scenario = 'populated') {
    // 🪄 MAGIC: We control the DB state via URL
    await this.page.goto(`/?scenario=${scenario}`);
    // Wait for the app to settle
    await this.page.waitForLoadState('networkidle');
  }

  async selectContact(name: string) {
    await this.page.getByText(name, { exact: true }).click();
  }

  async getContactRow(name: string) {
    return this.page.locator('contacts-list-item').filter({ hasText: name });
  }
}
