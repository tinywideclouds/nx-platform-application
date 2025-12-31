import { TestBed } from '@angular/core/testing';
import { ContactsFacadeService } from './contacts-facade.service';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { URN } from '@nx-platform-application/platform-types';
import { Contact } from '@nx-platform-application/contacts-types';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ContactsFacadeService', () => {
  let service: ContactsFacadeService;
  let state: ContactsStateService;

  const mockUrn = URN.parse('urn:contacts:user:alice');
  const mockGroupUrn = URN.parse('urn:messenger:group:team');

  // A "Heavy" contact with private fields
  const mockContact = {
    id: mockUrn,
    alias: 'Alice',
    email: 'alice@wonderland.img',
    emailAddresses: ['private@email.com'], // 🔒 Should be stripped
    phoneNumbers: ['+123456789'], // 🔒 Should be stripped
    serviceContacts: {},
  } as Contact;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ContactsFacadeService,
        MockProvider(ContactsStateService, {
          // We mock the State methods that the Facade *actually* calls
          getGroupParticipants: vi.fn(),
          isTrusted: vi.fn(),
          getContactSnapshot: vi.fn(),
        }),
      ],
    });

    service = TestBed.inject(ContactsFacadeService);
    state = TestBed.inject(ContactsStateService);
  });

  describe('Data Sanitization (Security)', () => {
    it('should STRIP private fields (email/phone) when mapping group participants', async () => {
      // Arrange
      vi.mocked(state.getGroupParticipants).mockResolvedValue([mockContact]);

      // Act
      const result = await service.getGroupParticipants(mockGroupUrn);

      // Assert
      expect(result[0].alias).toBe('Alice');
      // Critical Check: Ensure private data did NOT leak
      expect((result[0] as any).emailAddresses).toBeUndefined();
      expect((result[0] as any).phoneNumbers).toBeUndefined();
    });
  });

  describe('Logic Inversion', () => {
    it('should invert isTrusted result to return isBlocked', async () => {
      // Arrange: State says "Trusted = false"
      vi.mocked(state.isTrusted).mockResolvedValue(false);

      // Act
      const isBlocked = await service.isBlocked(mockUrn, 'messenger');

      // Assert: API returns "Blocked = true"
      expect(isBlocked).toBe(true);
      expect(state.isTrusted).toHaveBeenCalledWith(mockUrn, 'messenger');
    });
  });
});
