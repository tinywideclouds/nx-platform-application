import { TestBed } from '@angular/core/testing';
import { ChatIdentityFacade } from './chat-identity.facade';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity';
import { DevicePairingService } from '@nx-platform-application/messenger-domain-device-pairing';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { MockProvider } from 'ng-mocks';
import { BehaviorSubject } from 'rxjs';
import { signal } from '@angular/core';
import { URN, KeyNotFoundError } from '@nx-platform-application/platform-types';
import { DevicePairingSession } from '@nx-platform-application/messenger-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ChatIdentityFacade', () => {
  let facade: ChatIdentityFacade;
  let crypto: MessengerCryptoService;
  let keyCache: KeyCacheService;
  let keyWorker: ChatKeyService;
  let pairing: DevicePairingService;

  // Use a strictly valid 4-part URN
  const mockUrn = URN.parse('urn:contacts:user:me');

  const mockAuth = {
    sessionLoaded$: new BehaviorSubject({ authenticated: true }),
    currentUser: signal({ id: mockUrn, email: 'me@test.com' }),
    getJwtToken: vi.fn(() => 'mock-token'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ChatIdentityFacade,
        { provide: IAuthService, useValue: mockAuth },
        MockProvider(MessengerCryptoService),
        MockProvider(KeyCacheService),
        MockProvider(ChatKeyService),
        MockProvider(DevicePairingService),
        MockProvider(ChatLiveDataService),
        MockProvider(Logger),
      ],
    });

    facade = TestBed.inject(ChatIdentityFacade);
    crypto = TestBed.inject(MessengerCryptoService);
    keyCache = TestBed.inject(KeyCacheService);
    keyWorker = TestBed.inject(ChatKeyService);
    pairing = TestBed.inject(DevicePairingService);
  });

  describe('Initialization', () => {
    it('should transition to READY when keys match', async () => {
      vi.spyOn(crypto, 'loadMyKeys').mockResolvedValue({ encKey: 'k' } as any);
      vi.spyOn(keyCache, 'getPublicKey').mockResolvedValue({
        encKey: 'k',
      } as any);
      vi.spyOn(crypto, 'verifyKeysMatch').mockResolvedValue(true);

      await facade.initialize();

      expect(facade.onboardingState()).toBe('READY');
      expect(facade.myKeys()).toEqual({ encKey: 'k' });
    });

    it('should enter REQUIRES_LINKING if keys mismatch', async () => {
      vi.spyOn(crypto, 'loadMyKeys').mockResolvedValue({ encKey: 'k1' } as any);
      vi.spyOn(keyCache, 'getPublicKey').mockResolvedValue({
        encKey: 'k2',
      } as any);
      vi.spyOn(crypto, 'verifyKeysMatch').mockResolvedValue(false);

      await facade.initialize();

      expect(facade.onboardingState()).toBe('REQUIRES_LINKING');
    });

    it('should generate new keys if user is brand new', async () => {
      vi.spyOn(crypto, 'loadMyKeys').mockResolvedValue(null);
      vi.spyOn(keyCache, 'getPublicKey').mockRejectedValue(
        new KeyNotFoundError('not found'),
      );
      vi.spyOn(keyWorker, 'resetIdentityKeys').mockResolvedValue({
        encKey: 'new',
      } as any);

      await facade.initialize();

      expect(facade.onboardingState()).toBe('READY');
      expect(keyWorker.resetIdentityKeys).toHaveBeenCalledWith(
        mockUrn,
        'me@test.com',
      );
    });
  });

  describe('Device Pairing', () => {
    it('should start target link session only if in REQUIRES_LINKING state', async () => {
      facade.onboardingState.set('REQUIRES_LINKING');

      // Satisfy DevicePairingSession interface including 'mode'
      const mockSession: DevicePairingSession = {
        sessionId: 's1',
        qrPayload: 'qr',
        publicKey: {} as any,
        privateKey: {} as any,
        mode: 'RECEIVER_HOSTED',
      };

      vi.spyOn(pairing, 'startReceiverSession').mockResolvedValue(mockSession);

      const session = await facade.startTargetLinkSession();

      expect(session.sessionId).toBe('s1');
      expect(pairing.startReceiverSession).toHaveBeenCalled();
    });

    it('should throw if starting target link session in wrong state', async () => {
      facade.onboardingState.set('READY');
      await expect(facade.startTargetLinkSession()).rejects.toThrow(
        /Device Linking is only available/,
      );
    });

    it('should redeem source session and finalize linking', async () => {
      facade.onboardingState.set('REQUIRES_LINKING');
      const mockKeys = { encKey: 'recovered' } as any;

      vi.spyOn(pairing, 'redeemSenderSession').mockResolvedValue(mockKeys);
      vi.spyOn(facade, 'finalizeLinking');

      await facade.redeemSourceSession('qr-code-data');

      expect(pairing.redeemSenderSession).toHaveBeenCalledWith(
        'qr-code-data',
        mockUrn,
      );
      expect(facade.finalizeLinking).toHaveBeenCalledWith(mockKeys);
    });

    it('should link target device (existing user flow)', async () => {
      facade.myKeys.set({ encKey: 'my-keys' } as any);
      vi.spyOn(pairing, 'linkTargetDevice').mockResolvedValue(undefined);

      await facade.linkTargetDevice('qr-data');

      expect(pairing.linkTargetDevice).toHaveBeenCalled();
      expect(facade.isCeremonyActive()).toBe(false);
    });
  });
});
