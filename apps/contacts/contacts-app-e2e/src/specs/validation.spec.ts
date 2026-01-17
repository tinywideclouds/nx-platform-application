import { test, expect } from '@playwright/test';
import { ContactsPage } from '../fixtures/contacts.po';

test.describe('Spec: Form Guidance & Validation', () => {
  let app: ContactsPage;

  test.beforeEach(async ({ page }) => {
    app = new ContactsPage(page);
    await app.goto('empty');
    await app.createContactButton.click();
  });

  test('should guide user through the 3-Stage Completion Flow', async ({
    page,
  }) => {
    // --- STAGE 1: DORMANT ---
    // Nothing typed yet. Button should be genuinely disabled.
    await test.step('Stage 1: Initially Disabled', async () => {
      await app.expectSaveButtonState('disabled');

      // Verify "Pending" icons (Amber Warning) are visible for required fields
      expect(await app.getFieldStatus('First Name')).toBe('priority_high');
      expect(await app.getFieldStatus('Alias')).toBe('priority_high');

      // Optional field (Surname) should have no icon
      expect(await app.getFieldStatus('Surname')).toBe('');
    });

    // --- STAGE 2: SEMI-ACTIVE (Smart Submit) ---
    // Type partial data. Button becomes clickable but dim.
    await test.step('Stage 2: Semi-Active Guidance', async () => {
      await app.firstNameInput.fill('Alice');

      // First Name should turn Green (Success)
      expect(await app.getFieldStatus('First Name')).toBe('check_circle');

      // Button is now clickable (to show errors), but visually dim
      await app.expectSaveButtonState('semi-active');
    });

    // --- INTERACTION: SMART JUMP ---
    // User clicks "Save" prematurely. Should focus the first error.
    await test.step('Interaction: Jump to Error', async () => {
      // Alias is empty/invalid.
      // We click the semi-active save button.
      await app.saveButton.click();

      // 1. We expect NO navigation (still on form)
      await expect(page).toHaveURL(/new=contact/);

      // 2. We expect Focus to jump to the invalid field (likely Alias or Email)
      // Since Alias is the next one in the DOM:
      await expect(app.aliasInput).toBeFocused();

      // 3. Alias should now show Red Error icon (because we touched/focused it?)
      // Note: Focus behavior varies, but let's check it gets marked touched/invalid
      await app.aliasInput.blur();
      expect(await app.getFieldStatus('Alias')).toBe('priority_high'); // Or 'error' depending on validation logic
    });

    // --- STAGE 3: READY ---
    // Fill remaining fields.
    await test.step('Stage 3: Fully Ready', async () => {
      await app.aliasInput.fill('Ali');
      await app.emailInput.fill('alice@test.com');

      // Check Green Lights
      expect(await app.getFieldStatus('Alias')).toBe('check_circle');
      expect(await app.getFieldStatus('Primary Email')).toBe('check_circle');

      // Button should now be fully opaque and ready
      await app.expectSaveButtonState('ready');
    });

    // --- FINAL: SUCCESS ---
    await test.step('Action: Save', async () => {
      await app.saveButton.click();
      // Should navigate away
      await expect(page).not.toHaveURL(/new=contact/);
    });
  });
});
