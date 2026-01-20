import { Page, Locator, expect } from '@playwright/test';
import { ContactListPO } from './components/contact-list.po';
import { ContactFormPO } from './components/contact-form.po';

export class ContactsPage {
  readonly page: Page;

  // Sub-Components
  readonly list: ContactListPO;
  readonly form: ContactFormPO;

  // Layout Elements (FIX: Added these to satisfy layout.spec.ts)
  readonly sidebar: Locator;
  readonly mainPane: Locator;

  // Global / Overlay Elements
  readonly dialogConfirmButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.list = new ContactListPO(page);
    this.form = new ContactFormPO(page);

    // FIX: Targets <div sidebar> and <div main> from MasterDetailLayout
    this.sidebar = page.locator('[sidebar]');
    this.mainPane = page.locator('[main]');

    // Standard Material Confirm Button
    this.dialogConfirmButton = page
      .locator('mat-dialog-container')
      .getByRole('button', { name: /delete/i });
  }

  async goto(scenario: string = 'populated') {
    await this.page.goto(`/?scenario=${scenario}`);
    // Wait for the app to settle
    await this.page.waitForLoadState('networkidle');
  }
}
