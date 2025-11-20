import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { User } from '@nx-platform-application/platform-types';
import { MockAuthService } from './mock-auth.service';
import { Router } from '@angular/router';

// 1. Import the new token
import { MOCK_USERS_TOKEN } from './mock-auth.config';

@Component({
  selector: 'app-mock-login',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule],
  template: `
    <div class="mock-login-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Mock Login</mat-card-title>
          <mat-card-subtitle>Select a user to log in</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content class="user-buttons">
          @for (user of mockUsers; track user.id.toString()) {
          <button mat-raised-button color="primary" (click)="login(user)">
            Login as {{ user.alias }}
          </button>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    /* ... styles ... */
  ],
})
export class MockLoginComponent {
  private authService = inject(MockAuthService) as MockAuthService;
  private router = inject(Router);

  // 3. Inject the user list from the token
  public mockUsers = inject(MOCK_USERS_TOKEN);

  login(user: User): void {
    this.authService.loginAs(user);
    this.router.navigate(['/']);
  }
}
