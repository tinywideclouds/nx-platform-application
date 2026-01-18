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
    this.firstName = page.locator('input[aria-label="first name"]');
    this.surname = page.locator('input[aria-label="surname"]');
    this.alias = page.locator('input[aria-label="alias"]');
    this.email = page.locator('input[aria-label="email"]');

    this.saveButton = page.getByTestId('save-button');
    this.cancelButton = page.getByTestId('cancel-button');
    this.deleteButton = page.getByTestId('delete-button');
    // Assuming edit button appears in read-mode toolbar
    this.editButton = page
      .getByTestId('edit-contact-button')
      .or(page.locator('button[aria-label="Edit Contact"]'));
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
    return await icon.textContent();
  }

  async expectSaveButtonState(state: 'disabled' | 'semi-active' | 'ready') {
    if (state === 'disabled') {
      await expect(this.saveButton).toBeDisabled();
    } else {
      await expect(this.saveButton).toBeEnabled();
      if (state === 'ready') {
        await expect(this.saveButton).not.toHaveClass(/opacity-50/);
      }
    }
  }
}
