import { Injectable, signal, computed, Signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  IAuthService,
  AuthStatusResponse,
} from '@nx-platform-application/platform-infrastructure-auth-access';
import { User, URN } from '@nx-platform-application/platform-types';

// ✅ FIX: Import from types.ts
import { MockServerAuthState } from '../types';

@Injectable({ providedIn: 'root' })
export class MockAuthService implements IAuthService {
  // --- INTERNAL STATE ---
  private readonly _currentUser = signal<User | null>({
    id: URN.parse('urn:contacts:user:me'),
    alias: 'Me',
    email: 'me@example.com',
  });

  // --- CONFIGURATION API (Driver) ---
  public loadScenario(config: MockServerAuthState) {
    console.log('[MockAuthService] 🔄 Configuring Session:', config);
    if (config.authenticated) {
      this._currentUser.set(
        config.user || {
          id: URN.parse('urn:contacts:user:me'),
          alias: 'Me',
          email: 'me@example.com',
        },
      );
    } else {
      this._currentUser.set(null);
    }
  }

  // --- IAuthService Implementation ---
  public readonly currentUser: Signal<User | null> =
    this._currentUser.asReadonly();

  public readonly isAuthenticated: Signal<boolean> = computed(
    () => !!this.currentUser(),
  );

  public readonly sessionLoaded$: Observable<AuthStatusResponse | null> =
    toObservable(this._currentUser).pipe(
      map((user) => {
        if (!user) return null;
        return {
          authenticated: true,
          user: user,
          token: 'mock-offline-token',
        };
      }),
    );

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

  public logout(): Observable<void> {
    this.loadScenario({ authenticated: false });
    return of(void 0);
  }
}
