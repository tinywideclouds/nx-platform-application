import { TestBed } from '@angular/core/testing';
import { MockAuthService } from './mock-auth.service';
import { User, URN } from '@nx-platform-application/platform-types';
import { firstValueFrom } from 'rxjs';

describe('MockAuthService', () => {
  let service: MockAuthService;

  const MOCK_ALICE: User = {
    id: URN.parse('urn:contacts:user:alice'),
    alias: 'Alice',
    email: 'alice@example.com',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      // ✅ Explicitly providing it ensures the test bed knows how to build it
      providers: [MockAuthService],
    });
    service = TestBed.inject(MockAuthService);
  });

  describe('Scenario Loading', () => {
    it('should default to "Authenticated as Me" (Happy Path)', async () => {
      // 1. Verify default internal state
      expect(service.isAuthenticated()).toBe(true);

      // 2. Verify reactive stream (what the app sees)
      const session = await firstValueFrom(service.sessionLoaded$);
      expect(session?.user.alias).toBe('Me');
    });

    it('should switch to "Logged Out" when scenario loaded', async () => {
      // Action
      service.loadScenario({ authenticated: false });

      // Verification
      expect(service.isAuthenticated()).toBe(false);
      const session = await firstValueFrom(service.sessionLoaded$);
      expect(session).toBeNull();
    });

    it('should switch users when scenario loaded', async () => {
      // Action
      service.loadScenario({ authenticated: true, user: MOCK_ALICE });

      // Verification
      expect(service.currentUser()).toEqual(MOCK_ALICE);
      const session = await firstValueFrom(service.sessionLoaded$);
      expect(session?.user.id.toString()).toContain('alice');
    });
  });

  describe('Interface Compliance', () => {
    it('logout() should trigger the "Logged Out" scenario', async () => {
      service.loadScenario({ authenticated: true });

      // Action
      await firstValueFrom(service.logout());

      // Verification
      expect(service.isAuthenticated()).toBe(false);
    });
  });
});
