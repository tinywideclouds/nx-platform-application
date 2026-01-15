import { TestBed } from '@angular/core/testing';
import { GroupProtocolService } from './group-protocol.service';
import { OutboundService } from '@nx-platform-application/messenger-domain-sending';
import { URN } from '@nx-platform-application/platform-types';
import {
  AddressBookApi,
  AddressBookManagementApi,
  ContactsQueryApi,
} from '@nx-platform-application/contacts-api';
import {
  MessageContentParser,
  MessageGroupInvite,
  MessageGroupInviteResponse,
} from '@nx-platform-application/messenger-domain-message-content';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { MockProvider } from 'ng-mocks';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChatMessage } from '@nx-platform-application/messenger-types';

describe('GroupProtocolService', () => {
  let service: GroupProtocolService;
  let outbound: OutboundService;
  let abApi: AddressBookApi;
  let abManager: AddressBookManagementApi;
  let queryApi: ContactsQueryApi;
  let parser: MessageContentParser;

  const myUrn = URN.parse('urn:contacts:user:me');
  const myKeys = {} as PrivateKeys;
  const localGroupUrn = URN.parse('urn:contacts:group:weekend-trip');
  const alice = URN.parse('urn:contacts:user:alice');

  const mockLocalGroup = {
    id: localGroupUrn,
    name: 'Weekend Trip',
    scope: 'local',
  };

  const mockParticipants = [
    { id: alice, alias: 'Alice' },
    { id: myUrn, alias: 'Me' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        GroupProtocolService,
        MockProvider(OutboundService, {
          sendMessage: vi.fn().mockResolvedValue({ message: { id: 'm1' } }),
        }),
        MockProvider(AddressBookApi, {
          getGroup: vi.fn().mockResolvedValue(mockLocalGroup),
        }),
        MockProvider(AddressBookManagementApi, {
          saveGroup: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(ContactsQueryApi, {
          getGroupParticipants: vi.fn().mockResolvedValue(mockParticipants),
        }),
        MockProvider(MessageContentParser, {
          parse: vi.fn(),
        }),
      ],
    });

    service = TestBed.inject(GroupProtocolService);
    outbound = TestBed.inject(OutboundService);
    abApi = TestBed.inject(AddressBookApi);
    abManager = TestBed.inject(AddressBookManagementApi);
    queryApi = TestBed.inject(ContactsQueryApi);
    parser = TestBed.inject(MessageContentParser);
  });

  describe('upgradeGroup', () => {
    it('should MINT a network group, SAVE it locally, and BROADCAST invite', async () => {
      const resultUrn = await service.upgradeGroup(
        localGroupUrn,
        myKeys,
        myUrn,
      );

      // 1. Verify Identity Generation
      expect(resultUrn.entityType).toBe('group');
      expect(resultUrn.namespace).toBe('messenger');

      // 2. Verify Local State Transition
      expect(abManager.saveGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          id: resultUrn,
          scope: 'messenger',
          parentId: localGroupUrn,
          members: expect.arrayContaining([
            { contactId: myUrn, status: 'joined' },
            { contactId: alice, status: 'invited' },
          ]),
        }),
      );

      // 3. Verify Network Broadcast (Use Capture Strategy)
      expect(outbound.sendMessage).toHaveBeenCalled();
      const calls = vi.mocked(outbound.sendMessage).mock.calls;
      const args = calls[0];

      // Arg 2: Target (The new Group URN)
      expect(args[2].toString()).toBe(resultUrn.toString());

      // Arg 3: Type (Group Invite)
      expect(args[3].toString()).toBe(MessageGroupInvite.toString());

      // Arg 4: Payload (Check content)
      const sentBytes = args[4] as Uint8Array;
      expect(sentBytes).toBeDefined();
      const payload = JSON.parse(new TextDecoder().decode(sentBytes));
      expect(payload.name).toBe('Weekend Trip');
      expect(payload.groupUrn).toBe(resultUrn.toString());
    });

    it('should throw if local group is empty', async () => {
      vi.mocked(queryApi.getGroupParticipants).mockResolvedValue([]);
      await expect(
        service.upgradeGroup(localGroupUrn, myKeys, myUrn),
      ).rejects.toThrow('Cannot upgrade empty group');
    });
  });

  describe('acceptInvite', () => {
    it('should send a JOINED response', async () => {
      const groupUrn = URN.parse('urn:messenger:group:net-1');
      const inviteMsg = {
        id: 'msg-1',
        typeId: MessageGroupInvite,
        payloadBytes: new Uint8Array([]),
      } as ChatMessage;

      // Mock Parser to return valid invite data
      vi.mocked(parser.parse).mockReturnValue({
        kind: 'content',
        payload: {
          kind: 'group-invite',
          data: { groupUrn: groupUrn.toString() },
        } as any,
      } as any);

      await service.acceptInvite(inviteMsg, myKeys, myUrn);

      // Verify with Capture Strategy
      expect(outbound.sendMessage).toHaveBeenCalled();
      const calls = vi.mocked(outbound.sendMessage).mock.calls;
      const args = calls[0];

      // Arg 2: Target (The Group URN extracted from invite)
      expect(args[2].toString()).toBe(groupUrn.toString());

      // Arg 3: Type (Invite Response)
      expect(args[3].toString()).toBe(MessageGroupInviteResponse.toString());

      // Arg 4: Payload
      const sentBytes = args[4] as Uint8Array;
      const sentJson = new TextDecoder().decode(sentBytes);
      expect(sentJson).toContain('"status":"joined"');
      expect(sentJson).toContain(groupUrn.toString());
    });
  });
});
