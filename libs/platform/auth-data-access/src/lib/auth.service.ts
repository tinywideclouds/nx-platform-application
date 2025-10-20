import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User } from '@nx-platform-application/platform-types';
import { catchError, of, tap } from 'rxjs';

/**
 * Interface for the auth status response
 */
interface AuthStatusResponse {
  authenticated: boolean;
  user: User;
  token: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);

  // --- State Signals ---

  /**
   * Private signal holding the current user object.
   * (Renamed to _currentUser to avoid name collision)
   */
  private _currentUser = signal<User | null>(null);

  /**
   * Private signal holding the current JWT.
   * (Renamed to _jwt for consistency)
   */
  private _jwt = signal<string | null>(null);

  // --- Public State ---

  /**
   * Public readonly signal for the current user.
   */
  public currentUser = this._currentUser.asReadonly();

  /**
   * Public computed signal to determine if the user is authenticated.
   * (Computes from the public readonly signal as requested)
   */
  public isAuthenticated = computed(() => !!this.currentUser());

  constructor() {
    // Check auth status as soon as the service is instantiated
    this.checkAuthStatus().subscribe();
  }

  // --- Public Methods ---

  /**
   * Calls the backend to check the current session status.
   * On success, updates the user and JWT signals.
   */
  public checkAuthStatus() {
    return this.http.get<AuthStatusResponse>('/api/auth/status').pipe(
      tap((response) => this.setAuthState(response.user, response.token)),
      catchError(() => {
        // On error (e.g., 401), ensure state is cleared
        this.clearAuthState();
        return of(null); // Return a successful observable stream
      }),
    );
  }

  /**
   * Calls the backend to log the user out.
   * On success, clears the auth state.
   */
  public logout() {
    return this.http
      .post('/api/auth/logout', {})
      .pipe(tap(() => this.clearAuthState()));
  }

  /**
   * Returns the current JWT value.
   * This is intended for use by an HTTP interceptor.
   */
  public getJwtToken(): string | null {
    return this._jwt();
  }

  // --- Private Helpers ---

  private setAuthState(user: User, token: string) {
    this._currentUser.set(user);
    this._jwt.set(token);
  }

  private clearAuthState() {
    this._currentUser.set(null);
    this._jwt.set(null);
  }
}
