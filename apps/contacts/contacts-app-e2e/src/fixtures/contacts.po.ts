import { Page, Locator, expect } from '@playwright/test';

export class ContactsPage {
  readonly page: Page;

  // --- Views ---
  readonly sidebarList: Locator;
  readonly emptyListMessage: Locator;
  readonly detailHeader: Locator;

  // --- Inputs ---
  readonly firstNameInput: Locator;
  readonly surnameInput: Locator;
  readonly aliasInput: Locator;
  readonly emailInput: Locator;

  // --- Actions ---
  readonly createContactButton: Locator;
  readonly saveButton: Locator;
  readonly editButton: Locator;
  readonly cancelButton: Locator;
  readonly deleteButton: Locator;

  // --- Dialogs ---
  readonly dialogConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sidebarList = page.locator('contacts-list-item');
    this.emptyListMessage = page.getByTestId('empty-list');
    this.detailHeader = page.locator('contacts-viewer header h1');

    // ✅ FIX: Match the aria-labels defined in the refactored Component
    this.firstNameInput = page.locator('input[aria-label="first name"]');
    this.surnameInput = page.locator('input[aria-label="surname"]');
    this.aliasInput = page.locator('input[aria-label="alias"]');
    this.emailInput = page.locator('input[aria-label="email"]');

    this.createContactButton = page.locator('a[href*="new=contact"]');
    this.saveButton = page.getByTestId('save-button');
    this.editButton = page.getByTestId('edit-button');
    this.cancelButton = page.getByTestId('cancel-button');
    this.deleteButton = page.getByTestId('delete-button');

    // Material Dialog
    this.dialogConfirmButton = page.locator(
      'mat-dialog-container button[color="warn"]',
    );
  }

  async goto(scenario: 'empty' | 'populated' = 'populated') {
    await this.page.goto(`/?scenario=${scenario}`);
    await this.page.waitForLoadState('networkidle');
  }

  // --- Actions ---

  async fillForm(data: {
    firstName?: string;
    surname?: string;
    alias?: string;
    email?: string;
  }) {
    if (data.firstName) await this.firstNameInput.fill(data.firstName);
    if (data.surname) await this.surnameInput.fill(data.surname);
    if (data.alias) await this.aliasInput.fill(data.alias);
    if (data.email) await this.emailInput.fill(data.email);
  }

  async selectContact(alias: string) {
    // Click the sidebar item to open details
    await this.sidebarList.filter({ hasText: alias }).click();
  }

  // --- Assertions ---

  async expectContactVisible(alias: string) {
    await expect(this.sidebarList.filter({ hasText: alias })).toBeVisible();
  }

  async expectContactHidden(alias: string) {
    await expect(this.sidebarList.filter({ hasText: alias })).toBeHidden();
  }

  // --- 🚦 Traffic Light & Button State Helpers ---

  async getFieldStatus(labelText: string): Promise<string | null> {
    const field = this.page
      .locator('mat-form-field')
      .filter({ hasText: labelText });
    const icon = field.locator('mat-icon[matSuffix]');
    if ((await icon.count()) === 0) return null;
    return await icon.textContent();
  }

  async expectSaveButtonState(state: 'disabled' | 'semi-active' | 'ready') {
    if (state === 'disabled') {
      await expect(this.saveButton).toBeDisabled();
    } else if (state === 'semi-active') {
      await expect(this.saveButton).toBeEnabled();
      await expect(this.saveButton).toHaveClass(/opacity-50/);
    } else {
      await expect(this.saveButton).toBeEnabled();
      await expect(this.saveButton).not.toHaveClass(/opacity-50/);
    }
  }
}
