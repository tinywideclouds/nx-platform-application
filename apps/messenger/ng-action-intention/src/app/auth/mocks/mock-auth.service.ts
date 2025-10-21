import { Injectable, signal, WritableSignal, Signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { User } from '@nx-platform-application/platform-types';
import { IAuthService } from '@nx-platform-application/platform-auth-data-access';

// --- Define your library of mock users ---
export const MOCK_USERS: User[] = [
  { id: 'user-123', email: 'user@local.mock', alias: 'Regular User' },
  { id: 'admin-001', email: 'admin@local.mock', alias: 'Admin User' },
  { id: 'power-789', email: 'power@local.mock', alias: 'Power User' },
];
// -----------------------------------------

@Injectable()
export class MockAuthService implements IAuthService {
  private readonly _currentUser: WritableSignal<User | null> = signal(null);
  public readonly currentUser: Signal<User | null> = this._currentUser.asReadonly();
  public readonly isAuthenticated: Signal<boolean> = computed(() => !!this._currentUser());

  private router = inject(Router);

  constructor() {
    (window as any).auth = this; // Expose for easy debugging
  }

  getJwtToken(): string | null {
    return this._currentUser() ? 'MOCK_JWT_TOKEN' : null;
  }

  logout(): Observable<void> {
    console.log('MockAuthService (Frontend): Logging out...');
    this._currentUser.set(null);
    // On logout, always navigate to the login page
    this.router.navigate(['/login']);
    return of(undefined);
  }

  /**
   * Logs in as a specific mock user.
   * @param user The User object to set as the current user.
   */
  loginAs(user: User | null): void {
    if (user) {
      console.log(`MockAuthService (Frontend): Logging in as ${user.alias}`);
      this._currentUser.set(user);
      // After login, redirect to the main messaging page
      setTimeout(() => this.router.navigate(['/messaging']), 0);
    } else {
      this.logout();
    }
  }
}
