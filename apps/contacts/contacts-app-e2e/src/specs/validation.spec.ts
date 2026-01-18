import { test, expect } from '@playwright/test';
import { ContactsPage } from '../fixtures/contacts.po';

test.describe('Spec: Form Guidance & Validation', () => {
  let app: ContactsPage;

  test.beforeEach(async ({ page }) => {
    app = new ContactsPage(page);
    await app.goto('empty');
    await app.list.createButton.click(); // Updated
  });

  test('should guide user through the 3-Stage Completion Flow', async () => {
    // --- STAGE 1: DORMANT ---
    await test.step('Stage 1: Initially Disabled', async () => {
      await app.form.expectSaveButtonState('disabled'); // Updated

      // Verify "Pending" icons
      expect(await app.form.getFieldStatus('First Name')).toBe('priority_high'); // Updated
      expect(await app.form.getFieldStatus('Alias')).toBe('priority_high'); // Updated
    });

    // --- STAGE 2: SEMI-ACTIVE ---
    await test.step('Stage 2: Semi-Active Guidance', async () => {
      await app.form.firstName.fill('Alice'); // Updated

      // First Name should turn Green
      expect(await app.form.getFieldStatus('First Name')).toBe('check_circle'); // Updated
    });

    // --- STAGE 3: READY ---
    await test.step('Stage 3: Fully Ready', async () => {
      await app.form.alias.fill('Ali'); // Updated
      await app.form.email.fill('alice@test.com'); // Updated
      await app.form.expectSaveButtonState('ready'); // Updated
    });
  });
});
