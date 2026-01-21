import { TestBed } from '@angular/core/testing';
import { MockKeyService } from './mock-key.service';
import {
  KeyNotFoundError,
  PublicKeys,
} from '@nx-platform-application/platform-types';
import { SCENARIO_USERS } from '../scenarios.const';

describe('MockKeyService', () => {
  let service: MockKeyService;
  const ME_URN = SCENARIO_USERS.ME;
  const ALICE_URN = SCENARIO_USERS.ALICE;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MockKeyService],
    });
    service = TestBed.inject(MockKeyService);
  });

  describe('Scenario Configuration (loadScenario)', () => {
    it('should throw KeyNotFoundError for "Me" when configured as New User (hasMyKey: false)', async () => {
      service.loadScenario({ hasMyKey: false });

      // Expect 404 for Me
      await expect(service.getKey(ME_URN)).rejects.toThrow(KeyNotFoundError);

      // But Alice should still work (Mock convenience)
      const aliceKeys = await service.getKey(ALICE_URN);
      expect(aliceKeys).toBeDefined();
    });

    it('should return valid keys for "Me" when configured as Existing User (hasMyKey: true)', async () => {
      service.loadScenario({ hasMyKey: true });

      const keys = await service.getKey(ME_URN);
      expect(keys.encKey).toBeDefined();
      expect(keys.sigKey).toBeDefined();
    });

    it('should return specific garbage keys when configured with keyMismatch', async () => {
      service.loadScenario({ hasMyKey: true, keyMismatch: true });

      const keys = await service.getKey(ME_URN);
      // We expect the specific "9,9,9" pattern we defined for conflicts
      expect(keys.encKey).toEqual(new Uint8Array([9, 9, 9]));
    });
  });

  describe('Runtime Persistence (storeKeys)', () => {
    it('should allow a New User to upload keys and retrieve them immediately', async () => {
      // 1. Start as New User
      service.loadScenario({ hasMyKey: false });

      // 2. Upload Keys
      const newKeys: PublicKeys = {
        encKey: new Uint8Array([1, 2, 3]),
        sigKey: new Uint8Array([4, 5, 6]),
      };
      await service.storeKeys(ME_URN, newKeys);

      // 3. Verify Retrieval
      const result = await service.getKey(ME_URN);
      expect(result).toEqual(newKeys);
    });

    it('should NOT overwrite "Me" keys when uploading keys for "Alice" (Isolation Guard)', async () => {
      // 1. Setup: Me has keys
      service.loadScenario({ hasMyKey: true });
      const myOriginalKeys = await service.getKey(ME_URN);

      // 2. Upload keys for Alice
      const aliceKeys: PublicKeys = {
        encKey: new Uint8Array([100]),
        sigKey: new Uint8Array([200]),
      };
      await service.storeKeys(ALICE_URN, aliceKeys);

      // 3. Verify Alice is updated
      expect(await service.getKey(ALICE_URN)).toEqual(aliceKeys);

      // 4. CRITICAL: Verify "Me" is UNTOUCHED
      // (This failed in the previous implementation)
      expect(await service.getKey(ME_URN)).toEqual(myOriginalKeys);
    });
  });
});
