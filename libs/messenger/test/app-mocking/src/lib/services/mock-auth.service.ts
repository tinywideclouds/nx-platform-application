import { Injectable, signal, computed, Signal } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import {
  IAuthService,
  AuthStatusResponse,
} from '@nx-platform-application/platform-infrastructure-auth-access';
import { User, URN } from '@nx-platform-application/platform-types';

@Injectable()
export class MockAuthService implements IAuthService {
  // --- STATE ---
  // Writable signal for internal test manipulation
  private readonly _currentUser = signal<User | null>({
    id: URN.parse('urn:contacts:user:me'),
    alias: 'Me',
    email: 'me@example.com',
  });

  // --- IAuthService Implementation ---

  public readonly currentUser: Signal<User | null> =
    this._currentUser.asReadonly();

  public readonly isAuthenticated: Signal<boolean> = computed(
    () => !!this.currentUser(),
  );

  // Immediately emit a valid session for E2E speed
  public readonly sessionLoaded$: Observable<AuthStatusResponse | null> =
    new BehaviorSubject<AuthStatusResponse | null>({
      authenticated: true,
      user: this._currentUser()!,
      token: 'mock-offline-token',
    });

  public getJwtToken(): string | null {
    return this._currentUser() ? 'mock-offline-token' : null;
  }

  public checkAuthStatus(): Observable<AuthStatusResponse | null> {
    const user = this._currentUser();
    if (user) {
      return of({
        authenticated: true,
        user: user,
        token: 'mock-offline-token',
      });
    }
    return of(null);
  }

  public logout(): Observable<unknown> {
    this._currentUser.set(null);
    return of(true);
  }

  // --- Helper for Scenarios ---
  public setMockUser(user: User | null): void {
    this._currentUser.set(user);
  }
}
