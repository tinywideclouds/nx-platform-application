import { Injectable } from '@angular/core';
import {
  PublicKeys,
  URN,
  KeyNotFoundError,
} from '@nx-platform-application/platform-types';
import { ISecureKeyService } from '@nx-platform-application/messenger-infrastructure-key-access';
import { MockServerIdentityState, SCENARIO_USERS } from '../scenarios.const';

@Injectable({ providedIn: 'root' })
export class MockKeyService implements ISecureKeyService {
  // ✅ FIX: Use a Map to simulate a real Key Table
  private keyStore = new Map<string, PublicKeys>();

  // --- CONFIGURATION API (Test Driver) ---

  loadScenario(config: MockServerIdentityState) {
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
        // Happy Path: Server has valid keys (matching defaults)
        this.keyStore.set(myUrn, this.generateDefaultKeys());
      }
    }
    // If hasMyKey is false, we simply do NOT add 'me' to the map.
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
    // For mocked chats, we assume Alice/Bob always exist to prevent 404s breaking the UI.
    // We auto-generate a dummy key for them on the fly.
    return this.generateDefaultKeys();
  }

  async storeKeys(userUrn: URN, keys: PublicKeys): Promise<void> {
    console.log(
      `[MockKeyService] ☁️ Storing Keys for: ${userUrn.toString()}`,
      keys,
    );

    // ✅ FIX: Actually store the key for the specific user
    this.keyStore.set(userUrn.toString(), keys);
  }

  clearCache(): void {
    // No-op for mock (or could clear an internal cache if we simulated client-side caching)
  }

  private generateDefaultKeys(): PublicKeys {
    return {
      encKey: new Uint8Array([10, 20, 30]),
      sigKey: new Uint8Array([40, 50, 60]),
    };
  }
}
