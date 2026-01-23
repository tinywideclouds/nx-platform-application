import { Injectable, inject } from '@angular/core';
import {
  PublicKeys,
  URN,
  KeyNotFoundError,
} from '@nx-platform-application/platform-types';
import { ISecureKeyService } from '@nx-platform-application/messenger-infrastructure-key-access';
import { CryptoEngine } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { MockServerIdentityState } from '../types';
import { SCENARIO_USERS } from '../scenarios.const';

@Injectable({ providedIn: 'root' })
export class MockKeyService implements ISecureKeyService {
  private crypto = inject(CryptoEngine);
  // Simulates the server-side key database
  private keyStore = new Map<string, PublicKeys>();

  // --- CONFIGURATION API (Test Driver) ---

  async loadScenario(config: MockServerIdentityState): Promise<void> {
    console.log('[MockKeyService] 🔄 Configuring Identity Store:', config);
    this.keyStore.clear();

    const myUrn = SCENARIO_USERS.ME.toString();

    // 1. Configure "Me" based on the scenario
    if (config.hasMyKey) {
      if (config.keyMismatch) {
        // Conflict Scenario: Server has garbage keys
        this.keyStore.set(myUrn, {
          encKey: new Uint8Array([9, 9, 9]),
          sigKey: new Uint8Array([9, 9, 9]),
        });
      } else {
        // Happy Path: Server has valid keys
        const keys = await this.generateDefaultKeys();
        this.keyStore.set(myUrn, keys);
      }
    }
  }

  // --- RUNTIME API (Application) ---

  async getKey(userId: URN): Promise<PublicKeys> {
    const urnString = userId.toString();

    // 1. Check the Store
    if (this.keyStore.has(urnString)) {
      return this.keyStore.get(urnString)!;
    }

    // 2. Scenario Logic: "Me"
    // If I requested MY keys and they aren't in the store, that is a 404 (New User).
    if (urnString === SCENARIO_USERS.ME.toString()) {
      throw new KeyNotFoundError(urnString);
    }

    // 3. Scenario Logic: "Others" (Alice, Bob)
    // For mocked chats, we assume Alice/Bob always exist.
    // We auto-generate a VALID key pair for them on the fly.
    const newKeys = await this.generateDefaultKeys();
    this.keyStore.set(urnString, newKeys);
    return newKeys;
  }

  async storeKeys(userUrn: URN, keys: PublicKeys): Promise<void> {
    console.log(
      `[MockKeyService] ☁️ Storing Keys for: ${userUrn.toString()}`,
      keys,
    );
    this.keyStore.set(userUrn.toString(), keys);
  }

  clearCache(): void {
    this.keyStore.clear();
  }

  // --- HELPERS ---

  private async generateDefaultKeys(): Promise<PublicKeys> {
    // 1. Generate keys using the App's CryptoEngine (ensures correct algorithm/params)
    const encPair = await this.crypto.generateEncryptionKeys();
    const sigPair = await this.crypto.generateSigningKeys();

    // 2. Export to SPKI bytes using Native Browser API
    // (CryptoEngine abstracts operations, but we need raw bytes for the interface)
    const encPublic = await window.crypto.subtle.exportKey(
      'spki',
      encPair.publicKey,
    );
    const sigPublic = await window.crypto.subtle.exportKey(
      'spki',
      sigPair.publicKey,
    );

    return {
      encKey: new Uint8Array(encPublic),
      sigKey: new Uint8Array(sigPublic),
    };
  }
}
