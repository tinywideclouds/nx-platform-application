import { Injectable, signal, Signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { User } from '@nx-platform-application/platform-types';
// Import the IAuthService contract and the response type
import {
  IAuthService,
  AuthStatusResponse,
} from '@nx-platform-application/platform-infrastructure-auth-access';

export const MOCK_USERS: User[] = [
  { id: 'user-123', email: 'user@local.mock', alias: 'Regular User' },
  { id: 'admin-001', email: 'admin@local.mock', alias: 'Admin User' },
  { id: 'power-789', email: 'power@local.mock', alias: 'Power User' },
];

@Injectable()
export class MockAuthService implements IAuthService {
  private readonly _currentUser = signal<User | null>(null);
  public readonly currentUser: Signal<User | null> =
    this._currentUser.asReadonly();
  public readonly isAuthenticated: Signal<boolean> = computed(
    () => !!this._currentUser(),
  );

  // REMOVED: The old authStateLoaded signal is obsolete.

  // ADDED: Implement the sessionLoaded$ observable.
  // In a mock environment, there's no async loading, so we can use an observable
  // that emits immediately to unblock the guards.
  public readonly sessionLoaded$: Observable<AuthStatusResponse | null> =
    of(null);

  private router = inject(Router);

  constructor() {
    (window as any).auth = this;
  }

  // UPDATED: The method signature now matches the IAuthService contract.
  // The implementation remains simple as it's not needed for mock control.
  checkAuthStatus(): Observable<AuthStatusResponse | null> {
    return of(null);
  }

  getJwtToken(): string | null {
    return this._currentUser() ? 'MOCK_JWT_TOKEN' : null;
  }

  logout(): Observable<void> {
    console.log('MockAuthService (Frontend): Logging out...');
    this._currentUser.set(null);
    this.router.navigate(['/login']);
    return of(undefined);
  }

  loginAs(user: User | null): void {
    if (user) {
      console.log(`MockAuthService (Frontend): Logging in as ${user.alias}`);
      this._currentUser.set(user);
      setTimeout(() => this.router.navigate(['/messaging']), 0);
    } else {
      this.logout();
    }
  }
}
