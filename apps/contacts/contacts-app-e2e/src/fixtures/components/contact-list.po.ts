import { Page, Locator, expect } from '@playwright/test';

export class ContactListPO {
  readonly page: Page;
  readonly items: Locator;
  readonly emptyMessage: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.items = page.locator('contacts-list-item');
    this.emptyMessage = page.getByTestId('empty-list');
    // Assuming the Floating Action Button (FAB) or Toolbar button has this ID/Label
    this.createButton = page
      .getByTestId('create-contact-button')
      .or(page.locator('button[aria-label="Create Contact"]'));
  }

  /**
   * Selects a contact by their alias (visible text in the list)
   */
  async select(alias: string) {
    await this.items.filter({ hasText: alias }).click();
  }

  async expectVisible(alias: string) {
    await expect(this.items.filter({ hasText: alias })).toBeVisible();
  }

  async expectHidden(alias: string) {
    await expect(this.items.filter({ hasText: alias })).toBeHidden();
  }

  async count() {
    return await this.items.count();
  }
}
