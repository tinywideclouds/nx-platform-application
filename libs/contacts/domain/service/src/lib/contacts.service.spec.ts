import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ContactsDomainService } from './contacts.service';
import {
  ContactsStorageService,
  GatekeeperStorage,
} from '@nx-platform-application/contacts-infrastructure-storage';
import { URN } from '@nx-platform-application/platform-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { ContactGroup } from '@nx-platform-application/contacts-types';

// Mock Data
const mockMemberUrn = URN.parse('urn:contacts:user:bob');

// Mocks
const mockLocalStore = {
  saveGroup: vi.fn(),
  getGroup: vi.fn(),
  deleteGroup: vi.fn(),
  getGroupsByParent: vi.fn(),
  getContact: vi.fn(),
  saveContact: vi.fn(),
  linkIdentityToContact: vi.fn(),
  contacts$: { subscribe: vi.fn() },
  groups$: { subscribe: vi.fn() },
  links$: { subscribe: vi.fn() },
};

const mockGatekeeper = {
  blocked$: { subscribe: vi.fn() },
  pending$: { subscribe: vi.fn() },
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

describe('ContactsDomainService', () => {
  let service: ContactsDomainService;
  const fixedUUID = '123e4567-e89b-12d3-a456-426614174000';
  let randomUUIDSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    randomUUIDSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValue(fixedUUID);

    TestBed.configureTestingModule({
      providers: [
        ContactsDomainService,
        { provide: ContactsStorageService, useValue: mockLocalStore },
        { provide: GatekeeperStorage, useValue: mockGatekeeper },
        { provide: Logger, useValue: mockLogger },
      ],
    });
    service = TestBed.inject(ContactsDomainService);
  });

  afterEach(() => {
    randomUUIDSpy.mockRestore();
  });

  describe('Group Operations', () => {
    it('createGroup should save to local storage', async () => {
      // Act
      await service.createGroup('My Group', 'Desc', [mockMemberUrn]);

      const expectedLocalId = `urn:contacts:group:${fixedUUID}`;

      // Assert: Capture the argument to check Value Objects safely
      const [savedGroup] = mockLocalStore.saveGroup.mock.calls[0];

      expect(savedGroup.name).toBe('My Group');
      expect(savedGroup.description).toBe('Desc');
      expect(savedGroup.id.toString()).toBe(expectedLocalId);
      expect(savedGroup.memberUrns).toEqual([mockMemberUrn]);
    });

    it('saveGroup should update local storage', async () => {
      const group = {
        id: URN.parse('urn:contacts:group:1'),
        name: 'Updated',
      } as ContactGroup;

      await service.saveGroup(group);

      expect(mockLocalStore.saveGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated',
          // Should update timestamp
          lastModified: expect.any(String),
        }),
      );
    });

    it('getGroupsByParent should delegate to storage', async () => {
      const parent = URN.parse('urn:contacts:group:p1');
      await service.getGroupsByParent(parent);
      expect(mockLocalStore.getGroupsByParent).toHaveBeenCalledWith(parent);
    });
  });

  describe('Contact Operations', () => {
    it('createContact should create contact and optional link', async () => {
      const alias = 'Alice';
      const networkUrn = URN.parse('urn:messenger:user:123');
      const expectedId = `urn:contacts:user:${fixedUUID}`;

      const res = await service.createContact(alias, {
        urn: networkUrn,
        scope: 'messenger',
      });

      expect(res.toString()).toBe(expectedId);

      // Verify Save: Capture arguments
      const [savedContact] = mockLocalStore.saveContact.mock.calls[0];
      expect(savedContact.alias).toBe('Alice');
      expect(savedContact.id.toString()).toBe(expectedId);

      // Verify Link
      expect(mockLocalStore.linkIdentityToContact).toHaveBeenCalledWith(
        expect.anything(), // ID verified above
        networkUrn,
        'messenger',
      );
    });
  });
});
