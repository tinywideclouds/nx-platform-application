import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from './environments/environment';

// Import the Driver (ensure this path matches your tsconfig alias)
import { MessengerScenarioDriver } from '@nx-platform-application/lib-messenger-test-app-mocking';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
})
export class App {
  // 1. Inject Optionally
  // In 'production' or 'development' (real backend), this provider won't exist.
  // We mark it optional so Angular doesn't throw an error during normal use.
  private driver = inject(MessengerScenarioDriver, { optional: true });

  constructor() {
    this.exposeTestHarness();
  }

  private exposeTestHarness() {
    // 2. Safety Check
    // We only attach to window if the environment says so AND the driver was actually provided.
    if (environment.useMocks && this.driver) {
      // 3. Expose to Playwright
      // Playwright will use `await page.evaluate(() => window.messengerDriver.simulate...)`
      (window as any).messengerDriver = this.driver;

      console.log(
        '🔧 [Test Harness] MessengerDriver attached to window.messengerDriver',
      );
    }
  }
}
