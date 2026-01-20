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

    // FIX: "User-First" Selector.
    // matches <button>New Contact</button>
    // matches <button aria-label="New Contact"><icon/></button>
    // matches <button>Create Contact</button> (from your empty state)
    this.createButton = page.getByRole('button', {
      name: /new contact|create contact/i,
    });
  }

  async select(alias: string) {
    await this.items.filter({ hasText: alias }).click();
  }

  /**
   * INTENTION CHECK: The "Polished Exit"
   * Verifies that the row is physically capable of animating before we delete it.
   */
  async expectDiscardIntention(alias: string) {
    const row = this.items.filter({ hasText: alias });

    // 1. Verify row exists
    await expect(row).toBeVisible();

    // 2. Verify Angular Animation Trigger is present
    await expect(row).toHaveClass(/ng-trigger-discard/);
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
