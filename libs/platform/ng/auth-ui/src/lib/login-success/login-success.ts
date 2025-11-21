import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { firstValueFrom } from 'rxjs';
import { Logger } from '@nx-platform-application/console-logger';

@Component({
  standalone: true,
  selector: 'aui-login-success',
  imports: [CommonModule, MatProgressSpinnerModule],
  templateUrl: './login-success.html',
})
export class LoginSuccessComponent implements OnInit {
  private authService = inject(IAuthService);
  private router = inject(Router);
  private logger = inject(Logger);

  public statusMessage = signal('Finalizing login...');

  async ngOnInit(): Promise<void> {
    try {
      await firstValueFrom(this.authService.checkAuthStatus());

      if (this.authService.isAuthenticated()) {
        this.statusMessage.set('Success! Redirecting...');
        this.router.navigate(['/']);
      } else {
        this.statusMessage.set('Authentication failed. Redirecting...');
        this.router.navigate(['/login'], {
          queryParams: { error: 'auth_failed' },
        });
      }
    } catch (error) {
      this.logger.error('Login check failed', error as Error);
      this.statusMessage.set('Error connecting to service. Redirecting...');
      this.router.navigate(['/login'], {
        queryParams: { error: 'auth_failed' },
      });
    }
  }
}