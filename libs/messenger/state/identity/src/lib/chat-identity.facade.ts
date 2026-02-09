import { Injectable, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { SessionService } from '@nx-platform-application/messenger-domain-session';
import { DevicePairingService } from '@nx-platform-application/messenger-domain-device-pairing';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import { WebCryptoKeys } from '@nx-platform-application/messenger-infrastructure-private-keys';
import { DevicePairingSession } from '@nx-platform-application/messenger-types';

// ✅ DOMAIN SERVICES
import { KeyLifecycleService } from '@nx-platform-application/messenger-domain-key-manager';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity'; // "Them"

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
  private readonly sessionService = inject(SessionService);
  private readonly liveService = inject(ChatLiveDataService);

  // ✅ DOMAIN INJECTIONS
  private readonly lifecycle = inject(KeyLifecycleService); // "Me"
  private readonly recipientKeys = inject(ChatKeyService); // "Them"
  private readonly pairingService = inject(DevicePairingService); // "Linking"

  // --- STATE SIGNALS ---
  public readonly onboardingState = signal<OnboardingState>('CHECKING');
  public readonly isCeremonyActive = signal<boolean>(false);

  public readonly currentUser = this.authService.currentUser;

  public readonly myUrn = computed(() => {
    const user = this.currentUser();

    if (user?.email) {
      return URN.create('email', user.email, 'lookup');
    }

    // No Email = No Identity = App is Loading
    return null;
  });

  public readonly myKeys = this.sessionService.keys; // Expose keys for UI/Debugger

  // =================================================================
  // 1. LIFECYCLE ("Me")
  // =================================================================

  async initialize(): Promise<void> {
    try {
      this.onboardingState.set('CHECKING');
      await firstValueFrom(this.authService.sessionLoaded$);

      const currentUser = this.authService.currentUser();
      if (!currentUser?.id) throw new Error('No authenticated user');

      const authUrn = currentUser.id;
      const networkUrn = currentUser.email
        ? this.networkUrnFromEmail(currentUser.email)
        : authUrn;

      // 1. Delegate to Domain (Me)
      const keys = await this.lifecycle.restoreIdentity(authUrn);

      if (keys) {
        this.sessionService.initialize(authUrn, networkUrn, keys);
        this.onboardingState.set('READY');
      } else {
        // 2. No Identity Found -> Generate New
        this.onboardingState.set('GENERATING');
        await this.performFirstTimeSetup(authUrn, networkUrn);
      }
    } catch (error) {
      this.logger.error('[IdentityFacade] Boot failed', error);
      this.onboardingState.set('REQUIRES_LINKING');
    }
  }

  public async performIdentityReset(): Promise<void> {
    const user = this.authService.currentUser();
    if (!user?.id) return;

    this.onboardingState.set('GENERATING');
    try {
      // Create new identity (Handles generation + publishing)
      const keys = await this.lifecycle.createIdentity(user.id);
      this.sessionService.updateKeys(keys);
      this.onboardingState.set('READY');
    } catch (e) {
      this.logger.error('[IdentityFacade] Reset failed', e);
      this.onboardingState.set('REQUIRES_LINKING');
    }
  }

  public async loadMyFingerprint(): Promise<string> {
    const urn = this.myUrn();
    if (!urn) return '';
    return this.lifecycle.loadFingerprint(urn);
  }

  /**
   * Clears the local Public Key Cache.
   * Useful for debugging or forcing a refresh of contact keys.
   */
  public async clearPublicKeyCache(): Promise<void> {
    await this.lifecycle.clearCache();
  }

  // =================================================================
  // 2. RECIPIENT VERIFICATION ("Them")
  // =================================================================

  /**
   * Checks if we have valid keys for a contact.
   * Used by UI to show warnings or block sending.
   */
  public async verifyContactIdentity(urn: URN): Promise<boolean> {
    return this.recipientKeys.checkRecipientKeys(urn);
  }

  // =================================================================
  // 3. PAIRING & LINKING ("The Ceremony")
  // =================================================================

  public async startTargetLinkSession(): Promise<DevicePairingSession> {
    if (this.onboardingState() !== 'REQUIRES_LINKING')
      throw new Error('Invalid State');

    if (this.authService.getJwtToken()) {
      this.liveService.connect(() => this.authService.getJwtToken() ?? '');
    }

    const session = await this.pairingService.startReceiverSession();
    return { ...session, mode: 'RECEIVER_HOSTED' };
  }

  public async startSourceLinkSession(): Promise<DevicePairingSession> {
    const user = this.authService.currentUser();
    if (!user?.id || !this.sessionService.isReady)
      throw new Error('Session not ready');

    this.isCeremonyActive.set(true);
    const session = await this.pairingService.startSenderSession(
      this.sessionService.snapshot.keys,
      user.id,
    );
    return { ...session, mode: 'SENDER_HOSTED' };
  }

  public async checkForSyncMessage(key: CryptoKey): Promise<boolean> {
    const user = this.authService.currentUser();
    if (!user?.id) return false;

    const keys = await this.pairingService.pollForReceiverSync(key, user.id);
    if (keys) {
      await this.finalizeLinking(keys);
      return true;
    }
    return false;
  }

  public async redeemSourceSession(qrCode: string): Promise<void> {
    const user = this.authService.currentUser();
    if (!user?.id) throw new Error('Invalid State');

    const keys = await this.pairingService.redeemSenderSession(qrCode, user.id);
    if (keys) await this.finalizeLinking(keys);
    else throw new Error('Sync message not found');
  }

  public async linkTargetDevice(qrCode: string): Promise<void> {
    const user = this.authService.currentUser();
    if (!user?.id || !this.sessionService.isReady)
      throw new Error('Session not ready');

    try {
      this.isCeremonyActive.set(true);
      await this.pairingService.linkTargetDevice(
        qrCode,
        this.sessionService.snapshot.keys,
        user.id,
      );
    } finally {
      this.isCeremonyActive.set(false);
    }
  }

  public cancelLinking(): void {
    this.isCeremonyActive.set(false);
  }

  // --- HELPERS ---

  private async performFirstTimeSetup(
    authUrn: URN,
    networkUrn: URN,
  ): Promise<void> {
    // Generate + Publish
    const keys = await this.lifecycle.createIdentity(authUrn);
    this.sessionService.initialize(authUrn, networkUrn, keys);
    this.onboardingState.set('READY');
  }

  private async finalizeLinking(restoredKeys: WebCryptoKeys): Promise<void> {
    const user = this.authService.currentUser();
    if (user?.id) {
      const authUrn = user.id;
      const networkUrn = user.email
        ? this.networkUrnFromEmail(user.email)
        : authUrn;

      // Import to Local Storage
      await this.lifecycle.importIdentity(authUrn, restoredKeys);

      this.sessionService.initialize(authUrn, networkUrn, restoredKeys);
    }
    this.onboardingState.set('READY');
  }

  private networkUrnFromEmail(email: string): URN {
    return URN.create('email', email, 'lookup');
  }
}
