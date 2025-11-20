import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import {
  IAuthService,
  AUTH_API_URL,
} from '@nx-platform-application/platform-auth-access';

@Component({
  selector: 'aui-login',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule],
  templateUrl: './login.html',
})
export class LoginComponent {
  // Inject the correct service
  private authService = inject(IAuthService) as IAuthService;

  private apiUrl = inject(AUTH_API_URL); // Source of Truth

  readonly googleLoginUrl = `${this.apiUrl}/google`;

  // Expose signals directly to the template
  isAuthenticated = this.authService.isAuthenticated;
  currentUser = this.authService.currentUser;

  /**
   * Delegates the logout action to the AuthService.
   */
  logout(): void {
    this.authService.logout();
  }
}
