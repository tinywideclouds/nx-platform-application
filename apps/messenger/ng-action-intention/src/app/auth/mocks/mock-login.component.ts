import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { User } from '@nx-platform-application/platform-types';
import { IAuthService } from '@nx-platform-application/platform-auth-data-access';
import { MockAuthService, MOCK_USERS } from './mock-auth.service';

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
          @for (user of mockUsers; track user.id) {
            <button mat-raised-button color="primary" (click)="login(user)">
              Login as {{ user.alias }}
            </button>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .mock-login-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        background-color: #f5f5f5;
      }
      mat-card {
        width: 400px;
      }
      .user-buttons {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding-top: 1rem;
      }
    `,
  ],
})
export class MockLoginComponent {
  // We can safely cast AuthService to MockAuthService here because this
  // component will only ever be used in the mock environment.
  private authService = inject(IAuthService) as MockAuthService;

  public mockUsers = MOCK_USERS;

  login(user: User): void {
    this.authService.loginAs(user);
  }
}
