import { Page, Locator, expect } from '@playwright/test';

export class ContactFormPO {
  readonly page: Page;

  // Inputs
  readonly firstName: Locator;
  readonly surname: Locator;
  readonly alias: Locator;
  readonly email: Locator;

  // Actions
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly deleteButton: Locator;
  readonly editButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Locators matched to your aria-labels in the component
    this.firstName = page.getByLabel('First Name');
    this.surname = page.getByLabel('Surname');
    this.alias = page.getByLabel('Alias');
    this.email = page.getByLabel('Email');

    this.saveButton = page.getByTestId('save-button');
    this.cancelButton = page.getByTestId('cancel-button');
    this.deleteButton = page.getByRole('button', { name: /delete/i });

    this.editButton = page
      .getByTestId('edit-button')
      .or(page.getByRole('button', { name: 'Edit' }));
  }

  async fill(data: {
    firstName?: string;
    surname?: string;
    alias?: string;
    email?: string;
  }) {
    if (data.firstName) await this.firstName.fill(data.firstName);
    if (data.surname) await this.surname.fill(data.surname);
    if (data.alias) await this.alias.fill(data.alias);
    if (data.email) await this.email.fill(data.email);
  }

  /**
   * Helper to check the "Traffic Light" validation icons
   */
  async getFieldStatus(labelText: string): Promise<string | null> {
    const field = this.page
      .locator('mat-form-field')
      .filter({ hasText: labelText });

    // Checks for the matSuffix icon
    const icon = field.locator('mat-icon[matSuffix]');

    if ((await icon.count()) === 0) return null;

    // FIX: Trim whitespace to handle " priority_high " vs "priority_high"
    const text = await icon.textContent();
    return text ? text.trim() : null;
  }

  async expectSaveButtonState(state: 'disabled' | 'ready') {
    await expect(this.saveButton).toBeEnabled();
    if (state === 'disabled') {
      await expect(this.saveButton).toContainText(/Issues/);
    } else {
      await expect(this.saveButton).toHaveText('Save');
    }
  }
}
