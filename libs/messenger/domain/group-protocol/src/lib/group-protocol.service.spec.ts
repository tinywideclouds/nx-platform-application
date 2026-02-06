import { TestBed } from '@angular/core/testing';
import { GroupProtocolService } from './group-protocol.service';
import { OutboundService } from '@nx-platform-application/messenger-domain-sending';
import { URN } from '@nx-platform-application/platform-types';
import { ContactsQueryApi } from '@nx-platform-application/contacts-api';
import {
  DirectoryMutationApi,
  DirectoryQueryApi,
} from '@nx-platform-application/directory-api';
import {
  MessageContentParser,
  MessageGroupInvite,
  MessageGroupInviteResponse,
  GroupInvitePayload,
} from '@nx-platform-application/messenger-domain-message-content';
import { WebCryptoKeys } from '@nx-platform-application/messenger-infrastructure-private-keys';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { ConversationService } from '@nx-platform-application/messenger-domain-conversation';
import { SessionService } from '@nx-platform-application/messenger-domain-session';

describe('GroupProtocolService', () => {
  let service: GroupProtocolService;
  let outbound: OutboundService;
  let dirMutation: DirectoryMutationApi;
  let contactsQuery: ContactsQueryApi;
  let parser: MessageContentParser;
  let identityResolver: IdentityResolver;

  const myUrn = URN.parse('urn:contacts:user:me');
  const myNetworkUrn = URN.parse('urn:identity:google:me');

  const myKeys = {} as WebCryptoKeys;

  const localGroupUrn = URN.parse('urn:contacts:group:weekend-trip');
  const aliceLocal = URN.parse('urn:contacts:user:alice');
  const aliceNetwork = URN.parse('urn:identity:google:alice');

  const mockSerializedBytes = new Uint8Array([1, 2, 3]);

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        GroupProtocolService,
        MockProvider(OutboundService, {
          broadcast: vi.fn(),
          sendFromConversation: vi.fn(),
        }),
        MockProvider(DirectoryMutationApi, {
          saveGroup: vi.fn(),
          saveEntity: vi.fn(),
          updateMemberStatus: vi.fn(),
        }),
        MockProvider(DirectoryQueryApi),
        MockProvider(ContactsQueryApi, {
          getGroupParticipants: vi.fn(),
        }),
        MockProvider(MessageContentParser, {
          parse: vi.fn(),
          serialize: vi.fn().mockReturnValue(mockSerializedBytes),
        }),
        MockProvider(IdentityResolver, {
          resolveToHandle: vi.fn(),
        }),
        MockProvider(ConversationService, {
          startNewConversation: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(SessionService, {
          snapshot: { networkUrn: myNetworkUrn } as any,
        }),
      ],
    });

    service = TestBed.inject(GroupProtocolService);
    outbound = TestBed.inject(OutboundService);
    dirMutation = TestBed.inject(DirectoryMutationApi);
    contactsQuery = TestBed.inject(ContactsQueryApi);
    parser = TestBed.inject(MessageContentParser);
    identityResolver = TestBed.inject(IdentityResolver);
  });

  describe('provisionNetworkGroup', () => {
    it('should save to Directory using EntityTypeUser and fan-out invites', async () => {
      // 1. Setup Data
      vi.mocked(contactsQuery.getGroupParticipants).mockResolvedValue([
        { id: aliceLocal, alias: 'Alice' },
      ] as any);

      vi.mocked(identityResolver.resolveToHandle).mockImplementation(
        async (urn) => {
          if (urn.equals(myUrn)) return myNetworkUrn;
          if (urn.equals(aliceLocal)) return aliceNetwork;
          return urn;
        },
      );

      // 2. Execute
      const result = await service.provisionNetworkGroup(
        localGroupUrn,
        'new group',
      );

      // 3. Verify Directory Persistence
      const saveGroupCall = vi.mocked(dirMutation.saveGroup).mock.calls[0];
      const savedGroup = saveGroupCall[0];

      expect(savedGroup.id).toEqual(result);
      expect(savedGroup.memberState[myNetworkUrn.toString()]).toBe('joined');
      expect(savedGroup.memberState[aliceNetwork.toString()]).toBe('invited');

      // 4. Verify Outbound Broadcast
      expect(outbound.broadcast).toHaveBeenCalledWith(
        [aliceNetwork], // Invitees
        result, // Context
        MessageGroupInvite, // Type
        mockSerializedBytes, // Payload
        expect.objectContaining({ shouldPersist: true }),
      );
    });
  });

  describe('processIncomingInvite', () => {
    it('should seed Directory but exclude SELF from the Roster', async () => {
      const inviterAuth = URN.parse('urn:identity:google:inviter');
      const bobAuth = URN.parse('urn:identity:google:bob');
      const groupUrnStr = 'urn:messenger:group:net-1';

      const inviteData: GroupInvitePayload = {
        groupUrn: groupUrnStr,
        name: 'Project X',
        inviterUrn: inviterAuth.toString(),
        participants: [
          { urn: bobAuth.toString(), alias: 'Bob' },
          { urn: myNetworkUrn.toString(), alias: 'Me' }, // 👈 I am in the list
        ],
      };

      await service.processIncomingInvite(inviteData);

      expect(dirMutation.saveEntity).toHaveBeenCalled();
      const saveGroupCalls = vi.mocked(dirMutation.saveGroup).mock.calls;
      const savedGroup = saveGroupCalls[0][0];

      expect(savedGroup.id.toString()).toBe(groupUrnStr);
      // Bob should be there
      expect(savedGroup.memberState[bobAuth.toString()]).toBe('invited');
      // 🛑 I should NOT be there (Self-Exclusion)
      expect(savedGroup.memberState[myNetworkUrn.toString()]).toBeUndefined();
    });
  });

  describe('acceptInvite', () => {
    it('should update Directory Status and Broadcast response', async () => {
      const groupUrn = URN.parse('urn:messenger:group:net-1');
      const inviteMsg = {
        id: 'msg-1',
        typeId: MessageGroupInvite,
        payloadBytes: new Uint8Array([]),
      } as ChatMessage;

      vi.mocked(parser.parse).mockReturnValue({
        kind: 'content',
        payload: {
          kind: 'group-invite',
          data: { groupUrn: groupUrn.toString() },
        } as any,
      } as any);

      vi.mocked(identityResolver.resolveToHandle).mockResolvedValue(
        myNetworkUrn,
      );

      await service.acceptInvite(inviteMsg);

      expect(dirMutation.updateMemberStatus).toHaveBeenCalledWith(
        groupUrn,
        myNetworkUrn,
        'joined',
      );

      expect(outbound.sendFromConversation).toHaveBeenCalledWith(
        groupUrn,
        MessageGroupInviteResponse,
        mockSerializedBytes,
      );
    });
  });
});
