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
   * 1. Initialize the World based on the Scenario.
   * This happens BEFORE the App boots.
   */
  /**
   * Configures the World Identity.
   * ✅ NOW ACCEPTS CONTACTS to derive Router Aliases dynamically.
   */
  async configure(config: MockServerIdentityState, contacts: Contact[]) {
    this.logger.info('🌍 Constructing Identity World...', {
      config,
      contactCount: contacts.length,
    });
    this.worldState.clear();

    // 1. Setup ME (The Protagonist)
    const me = await this.generateWorldIdentity(MESSENGER_USERS.ME);

    // ✅ NEW: Register My Public Alias
    // This allows the World to look up keys using 'me@example.com'
    await this.registerAlias(lookupMe, me);

    // 2. Setup KNOWN CONTACTS (The Cast)
    // We iterate the scenario's address book to ensure we know everyone the App knows.
    for (const contact of contacts) {
      // A. Generate Primary Identity (urn:contacts:user:...)
      const identity = await this.generateWorldIdentity(contact.id);

      // B. Derive Router Handle (Mimic ContactMessengerMapper logic)
      // If the app knows Alice's email, it will use that to route messages.
      // The World must verify messages sent to that email handle.
      const email = contact.email || contact.emailAddresses?.[0];
      if (email) {
        // [Logic Mirror]: URN.create('email', email, 'lookup')
        const handleUrn = URN.create('email', email, 'lookup');
        await this.registerAlias(handleUrn, identity);
      }

      // Handle Linked Identities (if defined in mock data)
      // if (contact.linkedIdentities) {
      //   for (const linkedUrn of contact.linkedIdentities) {
      //     await this.registerAlias(linkedUrn, identity);
      //   }
      // }
    }

    // 3. Ensure "Alice" exists even if not in contacts (for edge case tests)
    // (This acts as a failsafe if the scenario contact list is empty but we still script Alice)
    if (!this.worldState.has(MESSENGER_USERS.ALICE.toString())) {
      await this.generateWorldIdentity(MESSENGER_USERS.ALICE);
    }

    // 4. Seed Network (MockKeyService)
    if (config.hasMyKey) {
      if (config.keyMismatch) {
        await this.mockKeyServer.storeKeys(MESSENGER_USERS.ME, {
          encKey: new Uint8Array([0]),
          sigKey: new Uint8Array([0]),
        });
      } else {
        await this.mockKeyServer.storeKeys(MESSENGER_USERS.ME, me.publicBytes);
      }
    }

    // 5. Seed App Storage
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
   * This mirrors the role of messenger-domain-identity-adapter in the real app
   */
  private async registerAlias(alias: URN, identity: WorldKeyPair) {
    const aliasStr = alias.toString();
    if (this.worldState.has(aliasStr)) return;

    this.logger.info(`🔗 Mapping Alias: ${aliasStr} -> Contact Identity`);
    this.worldState.set(aliasStr, identity);

    // Ensure the Alias is also routable on the network (Mock Server)
    await this.mockKeyServer.storeKeys(alias, identity.publicBytes);
  }

  /**
   * WORLD API: Get the authoritative Public Key for a user.
   * The QueueBuilder uses this to encrypt messages.
   * This removes the dependency on SecureKeyService for the Builder.
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
   * ✅ NEW: WORLD API: Get the authoritative Private Key for a user.
   * Used by WorldInboxService to decrypt messages sent TO this user.
   */
  getPrivateKey(user: URN): CryptoKey {
    const identity = this.worldState.get(user.toString());
    if (!identity) {
      throw new Error(
        `[World] User ${user} has not been created in this scenario.`,
      );
    }
    // We return the encryption private key (RSA-OAEP)
    return identity.cryptoKeys.enc;
  }

  // --- INTERNAL GENERATION ---

  private async generateWorldIdentity(user: URN): Promise<WorldKeyPair> {
    const urn = user.toString();
    if (this.worldState.has(urn)) return this.worldState.get(urn)!;

    // 1. Generate Valid Keys (using App's Algo settings)
    const encPair = await this.crypto.generateEncryptionKeys();
    const sigPair = await this.crypto.generateSigningKeys();

    // 2. Export to Bytes (for Network/DB)
    const subtle = (globalThis.crypto || window.crypto).subtle;

    // Public (SPKI)
    const encPubBytes = await subtle.exportKey('spki', encPair.publicKey);
    const sigPubBytes = await subtle.exportKey('spki', sigPair.publicKey);

    // Private (JWK)
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

    this.worldState.set(urn, identity);

    // Default: Everyone except ME is on the server
    if (!user.equals(MESSENGER_USERS.ME)) {
      await this.mockKeyServer.storeKeys(user, identity.publicBytes);
    }

    return identity;
  }

  private getEncKeyUrn(userId: URN): string {
    return `messenger:${userId.toString()}:key:encryption`;
  }

  private getSigKeyUrn(userId: URN): string {
    return `messenger:${userId.toString()}:key:signing`;
  }
}
