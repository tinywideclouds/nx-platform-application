import { Component, inject } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import {
  IAuthService,
  AUTH_API_URL,
} from '@nx-platform-application/platform-auth-access';

@Component({
  selector: 'aui-login',
  standalone: true,
  imports: [MatButtonModule, MatCardModule],
  templateUrl: './login.html',
})
export class LoginComponent {
  private authService = inject(IAuthService);
  private apiUrl = inject(AUTH_API_URL);

  readonly googleLoginUrl = `${this.apiUrl}/google`;

  isAuthenticated = this.authService.isAuthenticated;
  currentUser = this.authService.currentUser;

  logout(): void {
    this.authService.logout();
  }
}
