import { Injectable, signal, computed } from '@angular/core';
import { User, URN } from '@nx-platform-application/platform-types'; // <-- 1. Import URN
import { of, Observable } from 'rxjs'; // <-- 2. Import Observable
import {
  AuthStatusResponse,
  IAuthService,
} from '@nx-platform-application/platform-auth-data-access';
import { vi } from 'vitest';

// --- 3. Define a mock user with a REAL URN instance ---
const MOCK_USER: User = {
  id: URN.parse('urn:sm:user:mock-user'), // <-- This is the fix
  alias: 'Mock User',
  email: 'mock@example.com',
};

@Injectable()
export class MockAuthService implements IAuthService {
  // --- State (Private) ---
  private _currentUser = signal<User | null>(null);

  // --- Public API (Matches IAuthService) ---
  public currentUser = this._currentUser.asReadonly();
  public isAuthenticated = computed(() => !!this._currentUser());

  // --- 4. Implement the sessionLoaded$ observable ---
  public sessionLoaded$: Observable<AuthStatusResponse | null>;

  constructor() {
    // By default, simulate a successful login on startup
    this.sessionLoaded$ = of(this.getMockSuccessResponse(MOCK_USER));
    this._currentUser.set(MOCK_USER);
  }

  // --- Mocked Methods ---
  checkAuthStatus = vi.fn(
    (): Observable<AuthStatusResponse | null> =>
      of(this.getMockSuccessResponse(MOCK_USER))
  );
  logout = vi.fn(() => of(undefined));
  getJwtToken = vi.fn(() => 'mock-e2e-token');

  // --- Private Helper ---
  private getMockSuccessResponse(user: User): AuthStatusResponse {
    return {
      authenticated: true,
      user: user,
      token: 'mock-e2e-token',
    };
  }

  // --- Test Control Methods (from platform-auth-data-access/testing) ---
  public setAuthenticated(mockUser: User) {
    this._currentUser.set(mockUser);
  }

  public setUnauthenticated() {
    this._currentUser.set(null);
  }

  public mockCheckAuthStatusSuccess(mockUser: User) {
    this.checkAuthStatus.mockImplementation(() => {
      this.setAuthenticated(mockUser);
      return of(this.getMockSuccessResponse(mockUser));
    });
  }

  public mockCheckAuthStatusFailure() {
    this.checkAuthStatus.mockImplementation(() => {
      this.setUnauthenticated();
      return of(null);
    });
  }

  public mockCheckAuthStatusError() {
    this.checkAuthStatus.mockImplementation(() => {
      this.setUnauthenticated();
      return of(null);
    });
  }
}