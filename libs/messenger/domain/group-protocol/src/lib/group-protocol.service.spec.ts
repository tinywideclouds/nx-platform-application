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
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import {
  ChatMessage,
  EntityTypeUser,
} from '@nx-platform-application/messenger-types';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('GroupProtocolService', () => {
  let service: GroupProtocolService;
  let outbound: OutboundService;
  let dirMutation: DirectoryMutationApi;
  let contactsQuery: ContactsQueryApi;
  let parser: MessageContentParser;
  let identityResolver: IdentityResolver;

  const myUrn = URN.parse('urn:contacts:user:me');
  const myNetworkUrn = URN.parse('urn:identity:google:me');
  const myKeys = {} as PrivateKeys;
  const localGroupUrn = URN.parse('urn:contacts:group:weekend-trip');

  const aliceLocal = URN.parse('urn:contacts:user:alice');
  const aliceNetwork = URN.parse('urn:identity:google:alice');

  // Mock bytes for parser.serialize
  const mockSerializedBytes = new Uint8Array([1, 2, 3]);

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        GroupProtocolService,
        MockProvider(OutboundService, { sendMessage: vi.fn() }),
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
        myKeys,
        myUrn,
      );

      // 3. Verify Directory Persistence (Capture Args)
      const saveGroupCall = vi.mocked(dirMutation.saveGroup).mock.calls[0];
      const savedGroup = saveGroupCall[0];

      expect(savedGroup.id).toEqual(result);
      expect(savedGroup.memberState[myNetworkUrn.toString()]).toBe('joined');
      expect(savedGroup.memberState[aliceNetwork.toString()]).toBe('invited');

      // Check Entity Types
      const meEntity = savedGroup.members.find((m) =>
        m.id.equals(myNetworkUrn),
      );
      const aliceEntity = savedGroup.members.find((m) =>
        m.id.equals(aliceNetwork),
      );

      expect(meEntity?.type).toEqual(EntityTypeUser);
      expect(aliceEntity?.type).toEqual(EntityTypeUser);

      // 4. Verify Outbound Fan-Out
      expect(outbound.sendMessage).toHaveBeenCalledWith(
        myKeys,
        myUrn,
        aliceNetwork,
        MessageGroupInvite,
        mockSerializedBytes,
      );
    });
  });

  describe('processIncomingInvite', () => {
    it('should seed Directory Entities and save Directory Group', async () => {
      const inviterAuth = URN.parse('urn:identity:google:inviter');
      const bobAuth = URN.parse('urn:identity:google:bob');
      const groupUrnStr = 'urn:messenger:group:net-1';

      const inviteData: GroupInvitePayload = {
        groupUrn: groupUrnStr,
        name: 'Project X',
        inviterUrn: inviterAuth.toString(),
        participants: [{ urn: bobAuth.toString(), alias: 'Bob' }],
      };

      await service.processIncomingInvite(inviteData);

      // Verify Entity Seeding (Capture Args)
      const saveEntityCalls = vi.mocked(dirMutation.saveEntity).mock.calls;
      expect(saveEntityCalls.length).toBeGreaterThan(0);

      const savedEntity = saveEntityCalls[0][0];
      expect(savedEntity.id.toString()).toBe(bobAuth.toString());
      expect(savedEntity.type).toEqual(EntityTypeUser);

      // Verify Group Save
      const saveGroupCalls = vi.mocked(dirMutation.saveGroup).mock.calls;
      const savedGroup = saveGroupCalls[0][0];

      expect(savedGroup.id.toString()).toBe(groupUrnStr);
      expect(savedGroup.memberState[bobAuth.toString()]).toBe('invited');
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

      await service.acceptInvite(inviteMsg, myKeys, myUrn);

      // 1. Verify Directory Update
      expect(dirMutation.updateMemberStatus).toHaveBeenCalledWith(
        groupUrn,
        myNetworkUrn,
        'joined',
      );

      // 2. Verify Broadcast (Capture Args)
      const sendCalls = vi.mocked(outbound.sendMessage).mock.calls;
      const [keysArg, senderArg, recipientArg, typeIdArg] = sendCalls[0];

      expect(recipientArg.toString()).toBe(groupUrn.toString());
      expect(typeIdArg).toEqual(MessageGroupInviteResponse);
    });
  });
});
