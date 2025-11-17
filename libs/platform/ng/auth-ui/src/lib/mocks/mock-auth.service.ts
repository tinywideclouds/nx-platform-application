import { Injectable, signal, computed } from '@angular/core';
import { User, URN } from '@nx-platform-application/platform-types';
import { of, Observable, BehaviorSubject } from 'rxjs';
import {
  AuthStatusResponse,
  IAuthService,
} from '@nx-platform-application/platform-auth-data-access';

// Note: MOCK_USERS are no longer defined or exported from this file.
// They will be provided by the application via an InjectionToken.

@Injectable()
export class MockAuthService implements IAuthService {
  // --- State (Private) ---
  private _currentUser = signal<User | null>(null);

  // --- Public API (Matches IAuthService) ---
  public currentUser = this._currentUser.asReadonly();
  public isAuthenticated = computed(() => !!this._currentUser());

  // Use BehaviorSubject to allow login/logout to push new states
  public sessionLoaded$: BehaviorSubject<AuthStatusResponse | null>;

  constructor() {
    // Start as logged out
    this.sessionLoaded$ = new BehaviorSubject<AuthStatusResponse | null>(null);
    this._currentUser.set(null);
  }

  // --- Mocked Methods (re-implemented without 'vi') ---

  checkAuthStatus(): Observable<AuthStatusResponse | null> {
    return this.sessionLoaded$.asObservable();
  }

  logout(): Observable<void> {
    this._currentUser.set(null);
    this.sessionLoaded$.next(null);
    return of(undefined);
  }

  getJwtToken(): string | null {
    // Return a token only if authenticated
    return this._currentUser() ? 'mock-e2e-token' : null;
  }

  // --- Private Helper ---
  private getMockSuccessResponse(user: User): AuthStatusResponse {
    return {
      authenticated: true,
      user: user,
      token: 'mock-e2e-token',
    };
  }

  // --- Public Control Method (for MockLoginComponent) ---

  /**
   * Simulates a user logging in.
   * Sets the current user and pushes a new, authenticated
   * status to the sessionLoaded$ stream.
   */
  public loginAs(user: User) {
    this._currentUser.set(user);
    this.sessionLoaded$.next(this.getMockSuccessResponse(user));
  }

  // --- Test Control Methods (for testing the service itself) ---

  /** Sets the service to an authenticated state. */
  public setAuthenticated(mockUser: User) {
    this._currentUser.set(mockUser);
  }

  /** Sets the service to an unauthenticated state. */
  public setUnauthenticated() {
    this._currentUser.set(null);
  }

  /** Mocks a successful auth check. */
  public mockCheckAuthStatusSuccess(mockUser: User) {
    this.loginAs(mockUser);
  }

  /** Mocks a failed auth check. */
  public mockCheckAuthStatusFailure() {
    this.logout();
  }

  /** Mocks an error during auth check. */
  public mockCheckAuthStatusError() {
    this.logout();
  }
}