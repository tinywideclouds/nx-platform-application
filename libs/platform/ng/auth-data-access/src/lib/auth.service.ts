import { computed, inject, Injectable, signal, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User } from '@nx-platform-application/platform-types';
import { catchError, Observable, of, tap, shareReplay } from 'rxjs';

// This interface correctly defines the flat structure
export interface AuthStatusResponse {
  authenticated: boolean;
  user: User;
  token: string;
}

export abstract class IAuthService {
  abstract readonly currentUser: Signal<User | null>;
  abstract readonly isAuthenticated: Signal<boolean>;
  abstract readonly sessionLoaded$: Observable<AuthStatusResponse | null>;
  abstract getJwtToken(): string | null;
  abstract logout(): Observable<unknown>;
  abstract checkAuthStatus(): Observable<AuthStatusResponse | null>;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService implements IAuthService {
  private http = inject(HttpClient);
  public readonly sessionLoaded$: Observable<AuthStatusResponse | null>;
  private _currentUser = signal<User | null>(null);
  private _jwt = signal<string | null>(null);

  public currentUser = this._currentUser.asReadonly();
  public isAuthenticated = computed(() => !!this.currentUser());

  constructor() {
    this.sessionLoaded$ = this.checkAuthStatus().pipe(
      shareReplay(1) // Cache the result for all subscribers
    );
    // The subscribe call that was here has been REMOVED.
    // The APP_INITIALIZER will now trigger this observable.
  }

  public checkAuthStatus(): Observable<AuthStatusResponse | null> {
    return this.http
      .get<AuthStatusResponse>('/api/auth/status', { withCredentials: true })
      .pipe(
        tap((response) => {
          // This logic now correctly handles the flat response
          if (response && response.authenticated) {
            this.setAuthState(response.user, response.token);
          } else {
            this.clearAuthState();
          }
        }),
        catchError(() => {
          this.clearAuthState();
          return of(null);
        })
      );
  }

  public logout() {
    return this.http
      .post('/api/auth/logout', {}, { withCredentials: true })
      .pipe(tap(() => this.clearAuthState()));
  }

  public getJwtToken(): string | null {
    return this._jwt();
  }

  private setAuthState(user: User, token: string) {
    this._currentUser.set(user);
    this._jwt.set(token);
  }

  private clearAuthState() {
    this._currentUser.set(null);
    this._jwt.set(null);
  }
}
