import { TestBed } from '@angular/core/testing';
import { SessionService } from './session.service';
import { URN } from '@nx-platform-application/platform-types';
import { WebCryptoKeys } from '@nx-platform-application/messenger-infrastructure-private-keys';

describe('SessionService', () => {
  let service: SessionService;

  const mockAuthUrn = URN.parse('urn:auth:google:user1');
  const mockNetworkUrn = URN.parse('urn:lookup:email:user1@test.com');
  const mockKeys: WebCryptoKeys = {
    encKey: { algorithm: { name: 'ECDH' } } as any,
    sigKey: { algorithm: { name: 'ECDSA' } } as any,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SessionService],
    });
    service = TestBed.inject(SessionService);
  });

  it('should be created with null state', () => {
    expect(service.isReady).toBe(false);
    expect(service.currentSession()).toBeNull();
    expect(service.keys()).toBeNull();
  });

  describe('Initialization', () => {
    it('should set session state correctly', () => {
      service.initialize(mockAuthUrn, mockNetworkUrn, mockKeys);

      expect(service.isReady).toBe(true);
      expect(service.currentSession()).toEqual({
        authUrn: mockAuthUrn,
        networkUrn: mockNetworkUrn,
        keys: mockKeys,
      });
      // Verify Computed Signal
      expect(service.keys()).toBe(mockKeys);
    });
  });

  describe('Key Rotation', () => {
    it('should update keys while preserving URNs', () => {
      // 1. Init
      service.initialize(mockAuthUrn, mockNetworkUrn, mockKeys);

      // 2. Update
      const newKeys = { ...mockKeys, encKey: { algorithm: 'NEW' } } as any;
      service.updateKeys(newKeys);

      // 3. Verify
      const session = service.snapshot;
      expect(session.keys).toBe(newKeys);
      expect(session.authUrn).toBe(mockAuthUrn); // Unchanged
    });

    it('should ignore key updates if session is not initialized', () => {
      // 1. Update without Init
      service.updateKeys(mockKeys);

      // 2. Verify still null
      expect(service.currentSession()).toBeNull();
    });
  });

  describe('Snapshot Access', () => {
    it('should throw error if accessed before initialization', () => {
      expect(() => service.snapshot).toThrow(
        'Accessing session before initialization',
      );
    });

    it('should return active session if initialized', () => {
      service.initialize(mockAuthUrn, mockNetworkUrn, mockKeys);
      expect(service.snapshot).toBeDefined();
    });
  });
});
