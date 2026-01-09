import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  URN,
  KeyNotFoundError,
  PublicKeys,
} from '@nx-platform-application/platform-types';
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { Logger } from '@nx-platform-application/console-logger';
import {
  MessengerCryptoService,
  PrivateKeys,
} from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity';
import { DevicePairingService } from '@nx-platform-application/messenger-domain-device-pairing';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import { DevicePairingSession } from '@nx-platform-application/messenger-types';

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

  public readonly onboardingState = signal<OnboardingState>('CHECKING');
  public readonly isCeremonyActive = signal<boolean>(false);
  public readonly myKeys = signal<PrivateKeys | null>(null);

  async initialize(): Promise<void> {
    try {
      this.onboardingState.set('CHECKING');

      // Ensure session is loaded before checking keys
      await firstValueFrom(this.authService.sessionLoaded$);

      const currentUser = this.authService.currentUser();
      if (!currentUser || !currentUser.id) {
        throw new Error(
          'Identity initialization failed: No authenticated user.',
        );
      }

      const senderUrn = currentUser.id;
      const localKeys = await this.cryptoService.loadMyKeys(senderUrn);

      let serverKeys: PublicKeys | null = null;
      let isServerReachable = true;

      try {
        serverKeys = await this.keyService.getPublicKey(senderUrn);
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

      // 1. Offline Mode: We have keys, but can't verify against server
      if (localKeys && !isServerReachable) {
        this.myKeys.set(localKeys);
        this.onboardingState.set('OFFLINE_READY');
        return;
      }

      // 2. New User / First Time Setup: No keys anywhere
      if (!localKeys && !serverKeys && isServerReachable) {
        this.onboardingState.set('GENERATING');
        await this.performFirstTimeSetup(senderUrn, currentUser.email);
        return;
      }

      // 3. Consistency Check: Ensure local keys match server keys
      const isConsistent = await this.checkIntegrity(
        senderUrn,
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

      // 4. Success Case
      if (localKeys) {
        this.myKeys.set(localKeys);
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

  private async performFirstTimeSetup(urn: URN, email?: string): Promise<void> {
    const keys = await this.keyWorker.resetIdentityKeys(urn, email);
    this.myKeys.set(keys);
    this.onboardingState.set('READY');
  }

  public async performIdentityReset(): Promise<void> {
    const user = this.authService.currentUser();
    if (!user) return;

    this.onboardingState.set('GENERATING');
    try {
      const newKeys = await this.keyWorker.resetIdentityKeys(
        user.id,
        user.email,
      );
      this.myKeys.set(newKeys);
      this.onboardingState.set('READY');
    } catch (e) {
      this.logger.error('[IdentityFacade] Reset failed', e);
      this.onboardingState.set('REQUIRES_LINKING');
    }
  }

  // --- Device Pairing (The Ceremony) ---

  public cancelLinking(): void {
    this.isCeremonyActive.set(false);
  }

  public async startTargetLinkSession(): Promise<DevicePairingSession> {
    if (this.onboardingState() !== 'REQUIRES_LINKING') {
      throw new Error(
        'Device Linking is only available during onboarding halt.',
      );
    }

    const token = this.authService.getJwtToken();
    if (token) this.liveService.connect(token);

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

    const token = this.authService.getJwtToken();
    if (token) this.liveService.connect(token);

    const keys = await this.pairingService.redeemSenderSession(qrCode, user.id);

    if (keys) {
      await this.finalizeLinking(keys);
    } else {
      throw new Error('Sync message not found yet. Please try again.');
    }
  }

  public async linkTargetDevice(qrCode: string): Promise<void> {
    const user = this.authService.currentUser();
    const keys = this.myKeys();

    if (!user?.id || !keys) {
      throw new Error('Cannot link device: You are not authenticated.');
    }

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
    const keys = this.myKeys();
    if (!user?.id || !keys) throw new Error('Not authenticated');

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

  public async finalizeLinking(restoredKeys: PrivateKeys): Promise<void> {
    const user = this.authService.currentUser();
    if (user?.id) {
      await this.cryptoService.storeMyKeys(user.id, restoredKeys);
    }
    this.myKeys.set(restoredKeys);
    this.onboardingState.set('READY');
  }
}
