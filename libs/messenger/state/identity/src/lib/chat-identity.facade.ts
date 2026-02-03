import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  URN,
  KeyNotFoundError,
  PublicKeys,
} from '@nx-platform-application/platform-types';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity';
import { DevicePairingService } from '@nx-platform-application/messenger-domain-device-pairing';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import { DevicePairingSession } from '@nx-platform-application/messenger-types';
import { SessionService } from '@nx-platform-application/messenger-domain-session';

export type OnboardingState =
  | 'CHECKING'
  | 'READY'
  | 'OFFLINE_READY'
  | 'REQUIRES_LINKING'
  | 'GENERATING';

@Injectable({ providedIn: 'root' })
export class ChatIdentityFacade {
  private readonly logger = inject(Logger);
  private readonly authService = inject(IAuthService);
  private readonly cryptoService = inject(MessengerCryptoService);
  private readonly keyService = inject(KeyCacheService);
  private readonly keyWorker = inject(ChatKeyService);
  private readonly pairingService = inject(DevicePairingService);
  private readonly liveService = inject(ChatLiveDataService);
  private readonly sessionService = inject(SessionService);

  // --- STATE ---
  public readonly onboardingState = signal<OnboardingState>('CHECKING');
  public readonly isCeremonyActive = signal<boolean>(false);

  // ✅ FIXED: Uses URN.create (Deterministic)
  public readonly myUrn = computed(() => {
    const user = this.authService.currentUser();
    if (user?.email) {
      // urn:app:user:alice@example.com
      return URN.create('user', user.email);
    }
    return user?.id ? URN.create('user', user.id.entityId) : null;
  });

  async initialize(): Promise<void> {
    try {
      this.onboardingState.set('CHECKING');

      await firstValueFrom(this.authService.sessionLoaded$);

      const currentUser = this.authService.currentUser();
      if (!currentUser || !currentUser.id) {
        throw new Error(
          'Identity initialization failed: No authenticated user.',
        );
      }

      // 1. Resolve Identities
      const authUrn = currentUser.id; // The UUID from Auth0

      const networkUrn = currentUser.email
        ? URN.create('user', currentUser.email, 'messenger')
        : authUrn;

      const localKeys = await this.cryptoService.loadMyKeys(authUrn);

      let serverKeys: PublicKeys | null = null;
      let isServerReachable = true;

      try {
        // Check Public Directory using Network Handle
        serverKeys = await this.keyService.getPublicKey(networkUrn);
      } catch (error) {
        if (error instanceof KeyNotFoundError) {
          serverKeys = null;
        } else {
          this.logger.warn(
            '[IdentityFacade] Key Service unreachable, falling back to offline mode.',
          );
          isServerReachable = false;
        }
      }

      // 2. Offline Mode
      if (localKeys && !isServerReachable) {
        this.sessionService.initialize(authUrn, networkUrn, localKeys);
        this.onboardingState.set('OFFLINE_READY');
        return;
      }

      // 3. First Time Setup / Missing Keys
      if (!serverKeys && isServerReachable) {
        if (localKeys) {
          this.logger.info(
            '[IdentityFacade] Local keys found but Server is empty. Re-uploading...',
          );
          const restoredPublicKeys =
            await this.cryptoService.loadMyPublicKeys(authUrn);

          if (restoredPublicKeys) {
            await this.keyService.storeKeys(networkUrn, restoredPublicKeys);
            this.sessionService.initialize(authUrn, networkUrn, localKeys);
            this.onboardingState.set('READY');
            return;
          } else {
            this.logger.error(
              '[IdentityFacade] CRITICAL: Private keys exist but Public keys cannot be recovered.',
            );
          }
        }

        this.onboardingState.set('GENERATING');
        await this.performFirstTimeSetup(
          authUrn,
          networkUrn,
          currentUser.email,
        );
        return;
      }

      // 4. Consistency Check
      const isConsistent = await this.checkIntegrity(
        networkUrn,
        localKeys,
        serverKeys,
      );

      if (!isConsistent) {
        this.logger.warn(
          '[IdentityFacade] Integrity check failed: Requires linking.',
        );
        this.onboardingState.set('REQUIRES_LINKING');
        return;
      }

      // 5. Success
      if (localKeys) {
        this.sessionService.initialize(authUrn, networkUrn, localKeys);
        this.onboardingState.set('READY');
      }
    } catch (error) {
      this.logger.error('[IdentityFacade] Boot sequence failed', error);
    }
  }

  // --- Identity Actions ---

  private async checkIntegrity(
    urn: URN,
    local: PrivateKeys | null,
    server: PublicKeys | null,
  ): Promise<boolean> {
    if (!local && server) return false;
    if (local && server) {
      return await this.cryptoService.verifyKeysMatch(urn, server);
    }
    if (local && !server) return false;
    return true;
  }

  private async performFirstTimeSetup(
    authUrn: URN,
    networkUrn: URN,
    email?: string,
  ): Promise<void> {
    // Generate keys for the Network Identity (Email)
    const keys = await this.keyWorker.resetIdentityKeys(networkUrn, email);

    // Store locally under Auth Identity (UUID)
    await this.cryptoService.storeMyKeys(authUrn, keys);

    this.sessionService.initialize(authUrn, networkUrn, keys);
    this.onboardingState.set('READY');
  }

  public async performIdentityReset(): Promise<void> {
    const user = this.authService.currentUser();
    if (!user || !user.id) return;

    this.onboardingState.set('GENERATING');
    try {
      const authUrn = user.id;
      // ✅ FIXED: Deterministic Create
      const networkUrn = user.email
        ? URN.create('user', user.email, 'lookup')
        : authUrn;

      const newKeys = await this.keyWorker.resetIdentityKeys(
        networkUrn,
        user.email,
      );

      await this.cryptoService.storeMyKeys(authUrn, newKeys);

      this.sessionService.updateKeys(newKeys);
      this.onboardingState.set('READY');
    } catch (e) {
      this.logger.error('[IdentityFacade] Reset failed', e);
      this.onboardingState.set('REQUIRES_LINKING');
    }
  }

  public async finalizeLinking(restoredKeys: PrivateKeys): Promise<void> {
    const user = this.authService.currentUser();
    if (user?.id) {
      const authUrn = user.id;
      // ✅ FIXED: Deterministic Create
      const networkUrn = user.email ? URN.create('user', user.email) : authUrn;

      await this.cryptoService.storeMyKeys(authUrn, restoredKeys);
      this.sessionService.initialize(authUrn, networkUrn, restoredKeys);
    }
    this.onboardingState.set('READY');
  }

  // --- Device Pairing ---

  public cancelLinking(): void {
    this.isCeremonyActive.set(false);
  }

  public async startTargetLinkSession(): Promise<DevicePairingSession> {
    if (this.onboardingState() !== 'REQUIRES_LINKING') {
      throw new Error(
        'Device Linking is only available during onboarding halt.',
      );
    }

    if (this.authService.getJwtToken()) {
      this.liveService.connect(() => this.authService.getJwtToken() ?? '');
    }

    const session = await this.pairingService.startReceiverSession();

    return {
      sessionId: session.sessionId,
      qrPayload: session.qrPayload,
      publicKey: session.publicKey,
      privateKey: session.privateKey,
      mode: 'RECEIVER_HOSTED',
    };
  }

  public async checkForSyncMessage(
    sessionPrivateKey: CryptoKey,
  ): Promise<boolean> {
    const user = this.authService.currentUser();
    if (!user?.id || this.onboardingState() !== 'REQUIRES_LINKING')
      return false;

    // Use Auth URN for pairing verification
    const keys = await this.pairingService.pollForReceiverSync(
      sessionPrivateKey,
      user.id,
    );

    if (keys) {
      await this.finalizeLinking(keys);
      return true;
    }
    return false;
  }

  public async redeemSourceSession(qrCode: string): Promise<void> {
    const user = this.authService.currentUser();
    const currentState = this.onboardingState();

    if (!user?.id || currentState !== 'REQUIRES_LINKING') {
      this.logger.error(`[Identity] Redeem Blocked. State=${currentState}`);
      throw new Error('Invalid State for redeeming session');
    }

    if (this.authService.getJwtToken()) {
      this.liveService.connect(() => this.authService.getJwtToken() ?? '');
    }

    const keys = await this.pairingService.redeemSenderSession(qrCode, user.id);

    if (keys) {
      await this.finalizeLinking(keys);
    } else {
      throw new Error('Sync message not found yet. Please try again.');
    }
  }

  public async linkTargetDevice(qrCode: string): Promise<void> {
    const user = this.authService.currentUser();
    if (!user?.id) throw new Error('Not authenticated');

    if (!this.sessionService.isReady) {
      throw new Error('Cannot link device: Session not ready');
    }
    const keys = this.sessionService.snapshot.keys;

    try {
      this.isCeremonyActive.set(true);
      this.logger.debug('Linking target device...');
      await this.pairingService.linkTargetDevice(qrCode, keys, user.id);
    } finally {
      this.isCeremonyActive.set(false);
    }
  }

  public async startSourceLinkSession(): Promise<DevicePairingSession> {
    const user = this.authService.currentUser();
    if (!user?.id) throw new Error('Not authenticated');

    if (!this.sessionService.isReady) {
      throw new Error('Cannot link device: Session not ready');
    }
    const keys = this.sessionService.snapshot.keys;

    this.isCeremonyActive.set(true);

    const session = await this.pairingService.startSenderSession(keys, user.id);
    this.logger.info('Started source link session', session);
    return {
      sessionId: session.sessionId,
      qrPayload: session.qrPayload,
      oneTimeKey: session.oneTimeKey,
      mode: 'SENDER_HOSTED',
    };
  }
}
