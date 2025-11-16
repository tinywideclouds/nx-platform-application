import { computed, inject, Injectable, signal, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User } from '@nx-platform-application/platform-types';
import { catchError, Observable, of, tap, shareReplay } from 'rxjs';
import { AUTH_API_URL } from './auth-data.config'; // <-- 1. Import the token

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
  private authApiUrl = inject(AUTH_API_URL); // <-- 2. Inject the token

  public readonly sessionLoaded$: Observable<AuthStatusResponse | null>;
  private _currentUser = signal<User | null>(null);
  private _jwt = signal<string | null>(null);

  public currentUser = this._currentUser.asReadonly();
  public isAuthenticated = computed(() => !!this.currentUser());

  constructor() {
    this.sessionLoaded$ = this.checkAuthStatus().pipe(
      shareReplay(1) // Cache the result for all subscribers
    );
  }

  public checkAuthStatus(): Observable<AuthStatusResponse | null> {
    // 3. Use the injected URL
    return this.http
      .get<AuthStatusResponse>(`${this.authApiUrl}/status`, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => {
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
    // 4. Use the injected URL
    return this.http
      .post(`${this.authApiUrl}/logout`, {}, { withCredentials: true })
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