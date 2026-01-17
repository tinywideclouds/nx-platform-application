import { test, expect } from '@playwright/test';

test.describe('Messenger App: Guest Access', () => {
  test('should redirect anonymous user to login page', async ({ page }) => {
    // 1. Arrange & Act
    // Visit the root application URL.
    // Playwright starts with a fresh context (empty LocalStorage), so we are "Logged Out".
    await page.goto('/');

    // 2. Assert
    // The AuthGuard should catch the missing session and redirect immediately.
    await expect(page).toHaveURL('/login');

    // 3. Verification
    // Updated assertions to match 'aui-login' component structure (login.html)
    // The header is inside a <mat-card-title>
    await expect(page.locator('mat-card-title')).toContainText(
      'Platform Login',
    );

    // The login button is actually an anchor tag (<a>) pointing to the Google Auth URL
    await expect(page.locator('a')).toContainText('Login with Google');
  });
});
