import { Page, Locator, expect } from '@playwright/test';
import { ContactListPO } from './components/contact-list.po';
import { ContactFormPO } from './components/contact-form.po';

export class ContactsPage {
  readonly page: Page;

  // Sub-Components
  readonly list: ContactListPO;
  readonly form: ContactFormPO;

  // Global / Overlay Elements
  readonly dialogConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.list = new ContactListPO(page);
    this.form = new ContactFormPO(page);

    // Standard Material Confirm Button (usually 'warn' color in delete dialogs)
    this.dialogConfirmButton = page.locator(
      'mat-dialog-container button[color="warn"]',
    );
  }

  async goto(scenario: string = 'populated') {
    await this.page.goto(`/?scenario=${scenario}`);
    // Wait for the app to settle
    await this.page.waitForLoadState('networkidle');
  }
}
