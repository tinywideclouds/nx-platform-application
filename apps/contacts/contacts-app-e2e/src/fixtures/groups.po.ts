import { Page, Locator, expect } from '@playwright/test';

export class GroupsPage {
  readonly page: Page;

  readonly saveButton: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.saveButton = page.getByTestId('save-button');
    this.deleteButton = page.getByTestId('delete-button');
  }

  async fillForm(data: { name: string; description?: string }) {
    await this.page.getByLabel('Group Name').fill(data.name);
    if (data.description) {
      await this.page.getByLabel('Description').fill(data.description);
    }
  }

  async expectGroupVisible(name: string) {
    // Groups appear in the sidebar under the "Groups" tab.
    // Ideally, we'd switch tabs here, but for now we assume visibility check.
    await expect(
      this.page
        .locator('contacts-group-list mat-list-item')
        .filter({ hasText: name }),
    ).toBeVisible();
  }
}
