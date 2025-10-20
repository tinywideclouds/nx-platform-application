import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '@nx-platform-application/platform-auth-data-access';
// 1. Import firstValueFrom for modern promise conversion
import { firstValueFrom } from 'rxjs';

@Component({
  standalone: true,
  selector: 'aui-login-success',
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './login-success.html',
})
export class LoginSuccessComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  public statusMessage = signal('Finalizing login...');

  /**
   * On initialization, check the authentication status.
   * This method is async to handle the promise returned by firstValueFrom.
   */
  async ngOnInit(): Promise<void> {
    try {
      // 2. Await the result of the auth status check.
      // If the service's observable throws an error, firstValueFrom will reject the promise.
      await firstValueFrom(this.authService.checkAuthStatus());

      // 3. Check the result and navigate accordingly.
      if (this.authService.isAuthenticated()) {
        this.statusMessage.set('Success! Redirecting...');
        this.router.navigate(['/']);
      } else {
        // This handles cases where the API call succeeds but returns an unauthenticated state.
        this.statusMessage.set('Authentication failed. Redirecting...');
        this.router.navigate(['/login'], { queryParams: { error: 'auth_failed' } });
      }
    } catch (error) {
      // 4. This catch block executes if the promise from firstValueFrom is rejected.
      // This is our "network error" scenario.
      console.log('Login check failed:', error);
      this.statusMessage.set('Error connecting to service. Redirecting...');
      this.router.navigate(['/login'], { queryParams: { error: 'auth_failed' } });
    }
  }
}
