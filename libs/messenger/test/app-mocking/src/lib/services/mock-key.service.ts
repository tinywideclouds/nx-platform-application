import { Injectable } from '@angular/core';
import {
  URN,
  PublicKeys,
  KeyNotFoundError,
} from '@nx-platform-application/platform-types';
import { SecureKeyService } from '@nx-platform-application/messenger-infrastructure-key-access';

@Injectable()
export class MockKeyService implements Partial<SecureKeyService> {
  private keyStore = new Map<string, PublicKeys>();

  // --- Test Helper ---
  public registerUser(urn: URN, keys: PublicKeys): void {
    this.keyStore.set(urn.toString(), keys);
  }

  // --- API Implementation ---
  public async getKey(userId: URN): Promise<PublicKeys> {
    const keys = this.keyStore.get(userId.toString());
    if (keys) {
      return keys;
    }
    // Match the behavior of the real service (204 -> KeyNotFoundError)
    throw new KeyNotFoundError(userId.toString());
  }

  public async storeKeys(userUrn: URN, keys: PublicKeys): Promise<void> {
    console.log(`[MockKeys] 🔑 Stored keys for ${userUrn}`);
    this.keyStore.set(userUrn.toString(), keys);
  }
}
