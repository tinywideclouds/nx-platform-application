import { TestBed } from '@angular/core/testing';
import { ChatIdentityFacade } from './chat-identity.facade';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { MockProvider } from 'ng-mocks';
import { BehaviorSubject } from 'rxjs';
import { signal } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { DevicePairingSession } from '@nx-platform-application/messenger-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ✅ Mocks for Domains
import { KeyLifecycleService } from '@nx-platform-application/messenger-domain-key-manager';
import { ChatKeyService } from '@nx-platform-application/messenger-domain-identity';
import { DevicePairingService } from '@nx-platform-application/messenger-domain-device-pairing';
import { SessionService } from '@nx-platform-application/messenger-domain-session';

describe('ChatIdentityFacade', () => {
  let facade: ChatIdentityFacade;
  let lifecycle: KeyLifecycleService;
  let recipientKeys: ChatKeyService;
  let pairing: DevicePairingService;
  let sessionService: SessionService;

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
        MockProvider(KeyLifecycleService),
        MockProvider(ChatKeyService),
        MockProvider(DevicePairingService),
        MockProvider(SessionService, {
          initialize: vi.fn(),
          updateKeys: vi.fn(),
          snapshot: { keys: { encKey: 'k' } } as any,
          keys: signal({ encKey: 'k' } as any),
        }),
        MockProvider(ChatLiveDataService),
        MockProvider(Logger),
      ],
    });

    facade = TestBed.inject(ChatIdentityFacade);
    lifecycle = TestBed.inject(KeyLifecycleService);
    recipientKeys = TestBed.inject(ChatKeyService);
    pairing = TestBed.inject(DevicePairingService);
    sessionService = TestBed.inject(SessionService);
  });

  describe('Lifecycle ("Me")', () => {
    it('should transition to READY if lifecycle restores identity', async () => {
      const mockKeys = { encKey: 'k' } as any;
      vi.spyOn(lifecycle, 'restoreIdentity').mockResolvedValue(mockKeys);

      await facade.initialize();

      expect(lifecycle.restoreIdentity).toHaveBeenCalledWith(mockUrn);
      expect(sessionService.initialize).toHaveBeenCalled();
      expect(facade.onboardingState()).toBe('READY');
    });

    it('should generate new identity if restore returns null', async () => {
      const mockKeys = { encKey: 'new' } as any;
      vi.spyOn(lifecycle, 'restoreIdentity').mockResolvedValue(null);
      vi.spyOn(lifecycle, 'createIdentity').mockResolvedValue(mockKeys);

      await facade.initialize();

      expect(lifecycle.createIdentity).toHaveBeenCalledWith(mockUrn);
      expect(sessionService.initialize).toHaveBeenCalled();
      expect(facade.onboardingState()).toBe('READY');
    });

    it('should delegate cache clearing to lifecycle', async () => {
      await facade.clearPublicKeyCache();
      expect(lifecycle.clearCache).toHaveBeenCalled();
    });
  });

  describe('Verification ("Them")', () => {
    it('should delegate verification to ChatKeyService', async () => {
      const aliceUrn = URN.parse('urn:contacts:user:alice');
      vi.spyOn(recipientKeys, 'checkRecipientKeys').mockResolvedValue(true);

      const result = await facade.verifyContactIdentity(aliceUrn);

      expect(recipientKeys.checkRecipientKeys).toHaveBeenCalledWith(aliceUrn);
      expect(result).toBe(true);
    });
  });

  describe('Device Pairing (Linking)', () => {
    it('should start target link session only if in REQUIRES_LINKING state', async () => {
      facade.onboardingState.set('REQUIRES_LINKING');
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

    it('should link target device (existing user flow)', async () => {
      // Mock session ready
      Object.defineProperty(sessionService, 'isReady', { get: () => true });

      vi.spyOn(pairing, 'linkTargetDevice').mockResolvedValue(undefined);

      await facade.linkTargetDevice('qr-data');

      expect(pairing.linkTargetDevice).toHaveBeenCalled();
    });
  });
});
