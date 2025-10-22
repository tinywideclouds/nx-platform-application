import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { IAuthService } from '@nx-platform-application/platform-auth-data-access';

@Component({
  selector: 'app-messaging',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule],
  templateUrl: './messaging.component.html',
})
export class MessagingComponent {
  private authService = inject(IAuthService);
  private router = inject(Router);

  // Expose the currentUser signal directly to the template
  public currentUser = this.authService.currentUser;

  constructor() {
    // --- 2. ADD THIS DEBUGGING EFFECT ---
    effect(() => {
      const user = this.currentUser(); // Read the signal's value
      console.log(
        `%c[MessagingComponent Effect] currentUser signal changed:`,
        'color: #2ecc71; font-weight: bold;',
        user // Log the new value
      );
    });
    // ------------------------------------
  }
  /**
   * Logs the user out and navigates back to the login page.
   */
  logout(): void {
    this.authService.logout().subscribe(() => {
      // After logout is successful, redirect to login
      this.router.navigate(['/login']);
    });
  }
}
