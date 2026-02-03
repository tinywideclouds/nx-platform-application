// libs/messenger/domain/session/src/lib/session.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { WebCryptoKeys } from '@nx-platform-application/messenger-infrastructure-private-keys';

export interface ActiveSession {
  authUrn: URN; // From OIDC/Auth (Who I am logged in as)
  networkUrn: URN; // From Directory (Who I am to the network)
  keys: WebCryptoKeys; // My Identity Keys
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  // We use a private signal to hold state, but expose specific snapshots
  private _session = signal<ActiveSession | null>(null);

  public readonly currentSession = this._session.asReadonly();
  /**
   * Called by AppState on boot.
   */
  initialize(authUrn: URN, networkUrn: URN, keys: WebCryptoKeys) {
    console.log(
      'SESSION INITIALIZATION',
      authUrn.toString(),
      networkUrn.toString(),
    );
    this._session.set({ authUrn, networkUrn, keys });
  }

  /**
   * Called on Key Rotation.
   */
  updateKeys(newKeys: WebCryptoKeys) {
    this._session.update((current) =>
      current ? { ...current, keys: newKeys } : null,
    );
  }

  /**
   * The "Guaranteed" Snapshot.
   * Domain services call this. If it throws, the app is in an invalid state.
   */
  get snapshot(): ActiveSession {
    const s = this._session();
    if (!s) {
      throw new Error(
        'SessionService: Accessing session before initialization',
      );
    }
    return s;
  }

  /**
   * Helper to check if we are ready (e.g. for Guards)
   */
  get isReady(): boolean {
    return this._session() !== null;
  }
}
