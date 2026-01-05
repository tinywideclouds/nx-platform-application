import { TestBed } from '@angular/core/testing';
import { GroupProtocolService } from './group-protocol.service';
import { OutboxStorage } from '@nx-platform-application/messenger-infrastructure-chat-storage';
import { URN } from '@nx-platform-application/platform-types';
import { ContactGroup } from '@nx-platform-application/contacts-types';
import {
  MessageGroupInvite,
  MessageGroupInviteResponse,
} from '@nx-platform-application/messenger-domain-message-content';

import {
  GroupNetworkStorageApi,
  ContactsFacadeService,
} from '@nx-platform-application/contacts-api';

import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('GroupProtocolService', () => {
  let service: GroupProtocolService;
  let contactsFacade: ContactsFacadeService;
  let networkStorage: GroupNetworkStorageApi;
  let outbox: any;

  const mockLocalGroupUrn = URN.parse('urn:contacts:group:local-1');
  const mockMemberUrn = URN.parse('urn:contacts:user:alice');

  const mockLocalGroup: ContactGroup = {
    id: mockLocalGroupUrn,
    name: 'Weekend Trip',
    description: 'Planning',
    scope: 'local',
    members: [{ contactId: mockMemberUrn, status: 'joined' }],
    contactIds: [mockMemberUrn],
  } as any;

  beforeEach(() => {
    outbox = {
      enqueue: vi.fn().mockResolvedValue('msg-id-123'),
    };

    TestBed.configureTestingModule({
      providers: [
        GroupProtocolService,
        // 1. Mock Facade (CRUD)
        MockProvider(ContactsFacadeService, {
          getGroup: vi.fn(),
          saveGroup: vi.fn().mockResolvedValue(undefined),
        }),
        // 2. Mock Network Storage (Consensus)
        MockProvider(GroupNetworkStorageApi, {
          updateGroupMemberStatus: vi.fn().mockResolvedValue(undefined),
        }),
        { provide: OutboxStorage, useValue: outbox },
      ],
    });

    service = TestBed.inject(GroupProtocolService);
    contactsFacade = TestBed.inject(ContactsFacadeService);
    networkStorage = TestBed.inject(GroupNetworkStorageApi);
  });

  describe('upgradeGroup', () => {
    it('should create a network group and enqueue invites', async () => {
      vi.mocked(contactsFacade.getGroup).mockResolvedValue(mockLocalGroup);

      const resultUrn = await service.upgradeGroup(mockLocalGroupUrn);

      expect(resultUrn.entityType).toBe('group');

      // Verify Facade usage
      expect(contactsFacade.saveGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: 'messenger',
          parentId: mockLocalGroupUrn,
          name: 'Weekend Trip',
        }),
      );

      expect(outbox.enqueue).toHaveBeenCalledTimes(1);
    });
  });

  describe('respondToInvite', () => {
    it('should reply to the sender (1:1 context)', async () => {
      const senderUrn = URN.parse('urn:contacts:user:bob');
      const groupUrn = URN.parse('urn:messenger:group:new-1');

      vi.mocked(contactsFacade.getGroup).mockResolvedValue(undefined);

      await service.respondToInvite(senderUrn, groupUrn, 'Party', 'accept');

      expect(outbox.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationUrn: senderUrn,
          typeId: MessageGroupInviteResponse,
        }),
      );
    });
  });
});
