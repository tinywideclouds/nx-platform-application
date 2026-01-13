import { computed, inject, Injectable, signal, Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
// --- 1. Import URN and User from the types package ---
import { User, URN } from '@nx-platform-application/platform-types';
// --- 2. Import the 'map' operator ---
import { catchError, Observable, of, tap, shareReplay, map } from 'rxjs';
import { AUTH_API_URL } from './auth-data.config';

// --- 3. Create a DTO for the raw HTTP response ---
// This represents the JSON from the wire, where id is a string
interface AuthStatusResponseDTO {
  authenticated: boolean;
  user: {
    id: string; // <-- The ID is a string but MUST be parsable as an URN
    alias: string;
    email: string;
    profileUrl: string;
  } | null;
  token: string | null;
}

// This interface remains the same, representing the DOMAIN object
export interface AuthStatusResponse {
  authenticated: boolean;
  user: User; // <-- The ID is a URN here
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
      shareReplay(1), // Cache the result for all subscribers
    );
  }

  public checkAuthStatus(): Observable<AuthStatusResponse | null> {
    return (
      this.http
        // --- 4. Get the DTO, not the domain object ---
        .get<AuthStatusResponseDTO>(`${this.authApiUrl}/status`, {
          withCredentials: true,
        })
        .pipe(
          // --- 5. Map the DTO to the domain AuthStatusResponse ---
          map((dto): AuthStatusResponse | null => {
            if (dto && dto.authenticated && dto.user && dto.token) {
              // This is the transformation
              const domainUser: User = {
                id: URN.parse(dto.user.id), // <-- PARSE THE STRING
                alias: dto.user.alias,
                email: dto.user.email,
                profileUrl: dto.user.profileUrl,
              };

              return {
                authenticated: true,
                user: domainUser,
                token: dto.token,
              };
            }
            // If not authenticated or data is missing, return null
            return null;
          }),
          // 'response' is now the mapped AuthStatusResponse or null
          tap((response) => {
            if (response) {
              this.setAuthState(response.user, response.token);
            } else {
              this.clearAuthState();
            }
          }),
          catchError(() => {
            this.clearAuthState();
            return of(null);
          }),
        )
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
