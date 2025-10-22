import { Injectable, signal, computed } from '@angular/core';
import { User } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';

/**
 * This interface defines the shape of the success response,
 * matching the real service.
 */
interface AuthStatusResponse {
  authenticated: boolean;
  user: User;
  token: string;
}

@Injectable()
export class MockAuthService {
  // --- State (Private) ---
  private _currentUser = signal<User | null>(null);

  // --- Public API (Matches AuthService) ---
  public currentUser = this._currentUser.asReadonly();
  public isAuthenticated = computed(() => !!this._currentUser());

  // --- Mocked Methods ---
  /**
   * Correctly typed mock. It is initialized to return `of(null)` by default,
   * but its type signature `Observable<AuthStatusResponse | null>` allows it
   * to also return the success object, resolving the TypeScript error.
   */
  checkAuthStatus = vi.fn(() => of(null as AuthStatusResponse | null));
  logout = vi.fn(() => of({}));
  getJwtToken = vi.fn(() => null);

  // --- Test Control Methods ---
  public setAuthenticated(mockUser: User) {
    this._currentUser.set(mockUser);
  }

  public setUnauthenticated() {
    this._currentUser.set(null);
  }

  public mockCheckAuthStatusSuccess(mockUser: User) {
    this.checkAuthStatus.mockImplementation(() => {
      this.setAuthenticated(mockUser);
      const response: AuthStatusResponse = {
        authenticated: true,
        user: mockUser,
        token: 'mock-token',
      };
      return of(response);
    });
  }

  public mockCheckAuthStatusFailure() {
    this.checkAuthStatus.mockImplementation(() => {
      this.setUnauthenticated();
      return of(null);
    });
  }

  /**
   * Mocks a `checkAuthStatus` call that simulates a network error.
   * This now correctly mimics the real AuthService, which catches the error
   * and returns a successful observable of `null`.
   */
  public mockCheckAuthStatusError() {
    this.checkAuthStatus.mockImplementation(() => {
      this.setUnauthenticated();
      return of(null);
    });
  }
}

