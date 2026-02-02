import { Injectable, inject } from '@angular/core';
import { URN, PublicKeys } from '@nx-platform-application/platform-types';
import { Contact } from '@nx-platform-application/contacts-types';
import { SecureKeyService } from '@nx-platform-application/messenger-infrastructure-key-access';
import { WebKeyDbStore } from '@nx-platform-application/platform-infrastructure-web-key-storage';
import { CryptoEngine } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

import { MESSENGER_USERS, DEFAULT_USER } from '../data/users.const';
import { MockServerIdentityState } from '../types';

// The Internal Truth Structure
interface WorldKeyPair {
  publicBytes: PublicKeys;
  privateJwks: {
    encKey: JsonWebKey;
    sigKey: JsonWebKey;
  };
  cryptoKeys: {
    enc: CryptoKey;
    sig: CryptoKey;
  };
}

const lookupMe = URN.create('email', DEFAULT_USER.email, 'lookup');

@Injectable({ providedIn: 'root' })
export class IdentitySetupService {
  private logger = inject(Logger).withPrefix('[World:Identity]');
  private crypto = inject(CryptoEngine);

  // --- BOUNDARIES ---
  // The App's Network Mock (We feed it Public Keys)
  private mockKeyServer = inject(SecureKeyService);
  // The App's Local Storage (We feed it Private Keys)
  private browserStorage = inject(WebKeyDbStore);

  // --- GOD STATE ---
  private worldState = new Map<string, WorldKeyPair>();

  /**
   * Configures the World Identity.
   */
  async configure(config: MockServerIdentityState, contacts: Contact[]) {
    this.logger.info('🌍 Constructing Identity World...', {
      config,
      contactCount: contacts.length,
    });
    this.worldState.clear();

    // 1. Setup ME (The Protagonist)
    const me = await this.generateWorldIdentity(MESSENGER_USERS.ME);

    // ✅ NEW: Register My Public Alias (So others can find ME)
    await this.registerAlias(lookupMe, me);

    // 2. Setup KNOWN CONTACTS (The Cast)
    for (const contact of contacts) {
      // A. Generate Identity (Internal Only)
      const identity = await this.generateWorldIdentity(contact.id);

      // B. Derive Router Handle (Public)
      // This mimics how the real world works: Alice has an email,
      // and that email is her public handle on the network.
      const email = contact.email || contact.emailAddresses?.[0];
      if (email) {
        const handleUrn = URN.create('email', email, 'lookup');
        await this.registerAlias(handleUrn, identity);
      }
    }

    // 3. Ensure "Alice" exists for edge case tests
    if (!this.worldState.has(MESSENGER_USERS.ALICE.toString())) {
      const aliceIdentity = await this.generateWorldIdentity(
        MESSENGER_USERS.ALICE,
      );
      // Register Alice's alias if she wasn't in the contact list
      const aliceEmail = 'alice@example.com';
      await this.registerAlias(
        URN.create('email', aliceEmail, 'lookup'),
        aliceIdentity,
      );
    }

    // 4. Seed Network (MockKeyService) for ME
    // We only publish ME if the scenario config says so
    if (config.hasMyKey) {
      if (config.keyMismatch) {
        // Simulating a broken state
        await this.mockKeyServer.storeKeys(MESSENGER_USERS.ME, {
          encKey: new Uint8Array([0]),
          sigKey: new Uint8Array([0]),
        });
      } else {
        // Publish ME to the network (optional, usually done by app on startup)
        await this.mockKeyServer.storeKeys(MESSENGER_USERS.ME, me.publicBytes);
      }
    }

    // 5. Seed App Storage (BrowserDB)
    if (config.seeded) {
      this.logger.info('💾 Seeding Browser Storage (Active User Mode)');
      await this.browserStorage.saveJwk(
        this.getEncKeyUrn(MESSENGER_USERS.ME),
        me.privateJwks.encKey,
      );
      await this.browserStorage.saveJwk(
        this.getSigKeyUrn(MESSENGER_USERS.ME),
        me.privateJwks.sigKey,
      );
    } else {
      await this.browserStorage.clearDatabase();
    }
  }

  getMyPublicHandle(): URN {
    return lookupMe;
  }

  /**
   * Registers a Router URN (Alias) pointing to an existing Identity.
   * ✅ BOUNDARY ENFORCEMENT: This is the ONLY place we publish to MockKeyService
   * for other users.
   */
  private async registerAlias(alias: URN, identity: WorldKeyPair) {
    const aliasStr = alias.toString();
    if (this.worldState.has(aliasStr)) return;

    this.logger.info(`🔗 Mapping Alias: ${aliasStr} -> Contact Identity`);

    // 1. Internal Map (So WorldInbox can decrypt messages sent to this alias)
    this.worldState.set(aliasStr, identity);

    // 2. Public Network (So App can find the key to encrypt)
    await this.mockKeyServer.storeKeys(alias, identity.publicBytes);
  }

  /**
   * WORLD API: Get the authoritative Public Key for a user.
   */
  getPublicKey(user: URN): PublicKeys {
    const identity = this.worldState.get(user.toString());
    if (!identity) {
      throw new Error(
        `[World] User ${user} has not been created in this scenario.`,
      );
    }
    return identity.publicBytes;
  }

  /**
   * WORLD API: Get the authoritative Private Key for a user.
   */
  getPrivateKey(user: URN): CryptoKey {
    const identity = this.worldState.get(user.toString());
    if (!identity) {
      throw new Error(
        `[World] User ${user} has not been created in this scenario.`,
      );
    }
    return identity.cryptoKeys.enc;
  }

  // --- INTERNAL GENERATION ---

  private async generateWorldIdentity(user: URN): Promise<WorldKeyPair> {
    const urn = user.toString();
    if (this.worldState.has(urn)) return this.worldState.get(urn)!;

    // 1. Generate Valid Keys
    const encPair = await this.crypto.generateEncryptionKeys();
    const sigPair = await this.crypto.generateSigningKeys();

    // 2. Export to Bytes
    const subtle = (globalThis.crypto || window.crypto).subtle;
    const encPubBytes = await subtle.exportKey('spki', encPair.publicKey);
    const sigPubBytes = await subtle.exportKey('spki', sigPair.publicKey);
    const encPrivJwk = await subtle.exportKey('jwk', encPair.privateKey);
    const sigPrivJwk = await subtle.exportKey('jwk', sigPair.privateKey);

    const identity: WorldKeyPair = {
      publicBytes: {
        encKey: new Uint8Array(encPubBytes),
        sigKey: new Uint8Array(sigPubBytes),
      },
      privateJwks: {
        encKey: encPrivJwk,
        sigKey: sigPrivJwk,
      },
      cryptoKeys: {
        enc: encPair.privateKey,
        sig: sigPair.privateKey,
      },
    };

    // 3. Store Internal Reference ONLY
    // We do NOT publish `urn:contacts:...` to the MockKeyServer.
    // If the App tries to fetch this URN, it will correctly fail.
    this.worldState.set(urn, identity);

    return identity;
  }

  private getEncKeyUrn(userId: URN): string {
    return `messenger:${userId.toString()}:key:encryption`;
  }

  private getSigKeyUrn(userId: URN): string {
    return `messenger:${userId.toString()}:key:signing`;
  }

  public isSameIdentity(urnA: URN, urnB: URN): boolean {
    if (urnA.equals(urnB)) return true;

    const identityA = this.worldState.get(urnA.toString());
    const identityB = this.worldState.get(urnB.toString());

    // Check Reference Equality (They point to the same KeyPair object in memory)
    return !!identityA && !!identityB && identityA === identityB;
  }

  // ✅ NEW METHOD: Smart Resolve
  /**
   * Given a Local URN (urn:contacts:user:alice), finds the corresponding
   * Network URN (urn:lookup:email:alice@example.com) used for routing.
   */
  resolveNetworkHandle(urn: URN): URN {
    const urnStr = urn.toString();
    const identity = this.worldState.get(urnStr);

    // If we don't know this user, or it's already a lookup URN, return as-is
    if (!identity || urnStr.startsWith('urn:lookup:')) {
      return urn;
    }

    // Reverse Lookup: Find the alias pointing to this same identity object
    for (const [key, value] of this.worldState.entries()) {
      // Check Reference Equality (Same Identity) AND Protocol (Lookup)
      if (value === identity && key.startsWith('urn:lookup:')) {
        return URN.parse(key);
      }
    }

    return urn;
  }
}
