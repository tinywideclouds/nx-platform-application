import { Injectable, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { OutboundService } from '@nx-platform-application/messenger-domain-sending';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { Temporal } from '@js-temporal/polyfill';

// APIs
import {
  AddressBookApi,
  AddressBookManagementApi,
  ContactsQueryApi,
} from '@nx-platform-application/contacts-api';

// Content Types
import {
  GroupInvitationData,
  GroupJoinData,
  GroupParticipantSnapshot,
  MessageGroupInvite,
  MessageGroupInviteResponse,
} from '@nx-platform-application/messenger-domain-message-content';
import { MessageContentParser } from '@nx-platform-application/messenger-domain-message-content';

@Injectable({ providedIn: 'root' })
export class GroupProtocolService {
  private outbound = inject(OutboundService);
  private parser = inject(MessageContentParser);
  private logger = inject(Logger);

  // ✅ Inject APIs for State Management
  private addressBook = inject(AddressBookApi);
  private addressBookManager = inject(AddressBookManagementApi);
  private contactsQuery = inject(ContactsQueryApi);

  /**
   * Upgrades a Local Group (Address Book) to a Network Group (Messenger).
   * 1. Creates the Network Group locally.
   * 2. Broadcasts the Invite to all members.
   */
  async upgradeGroup(
    localGroupUrn: URN,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<URN> {
    this.logger.info(
      `[GroupProtocol] Upgrading ${localGroupUrn.toString()}...`,
    );

    // 1. Fetch Source Data
    const localGroup = await this.addressBook.getGroup(localGroupUrn);
    if (!localGroup) throw new Error('Local group not found');

    const participants =
      await this.contactsQuery.getGroupParticipants(localGroupUrn);
    if (participants.length === 0)
      throw new Error('Cannot upgrade empty group');

    // 2. Mint Network Identity
    const networkId = crypto.randomUUID();
    const networkGroupUrn = URN.create('group', networkId, 'messenger');

    // 3. Create & Persist Network Group (So Strategy works)
    // We map the Local Participants -> Network Members (Status: Invited)
    // We set ourselves as 'joined'
    const newGroup: ContactGroup = {
      id: networkGroupUrn,
      scope: 'messenger',
      name: localGroup.name,
      members: [
        { contactId: myUrn, status: 'joined' },
        ...participants.map((p) => ({
          contactId: p.id,
          status: 'invited' as const,
        })),
      ],
      // Link back to local parent for UI grouping
      parentId: localGroupUrn,
    };

    await this.addressBookManager.saveGroup(newGroup);

    // 4. Construct Invite Payload
    const snapshot: GroupParticipantSnapshot[] = participants.map((p) => ({
      urn: p.id.toString(),
      alias: p.alias,
    }));

    // Add myself to snapshot
    // (We need to resolve my own alias, or send "You")
    // For now, let's trust the receiver resolves 'inviterUrn' to a name.

    const invitePayload: GroupInvitationData = {
      groupUrn: networkGroupUrn.toString(),
      name: localGroup.name,
      description: `Upgraded from ${localGroup.name}`,
      participants: snapshot,
      createdAt: Temporal.Now.instant().toString(),
    };

    const bytes = new TextEncoder().encode(JSON.stringify(invitePayload));

    // 5. Broadcast Invite
    // We send to the GROUP URN.
    // The NetworkGroupStrategy will read the group we just saved in step #3,
    // and fan-out to all the 'invited' members.
    await this.outbound.sendMessage(
      myKeys,
      myUrn,
      networkGroupUrn,
      MessageGroupInvite,
      bytes,
    );

    this.logger.info(
      `[GroupProtocol] Upgrade Complete. New URN: ${networkGroupUrn}`,
    );
    return networkGroupUrn;
  }

  async acceptInvite(
    inviteMsg: ChatMessage,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    return this.respond(inviteMsg, myKeys, myUrn, 'joined');
  }

  async rejectInvite(
    inviteMsg: ChatMessage,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    return this.respond(inviteMsg, myKeys, myUrn, 'declined');
  }

  private async respond(
    inviteMsg: ChatMessage,
    myKeys: PrivateKeys,
    myUrn: URN,
    status: 'joined' | 'declined',
  ): Promise<void> {
    const parsed = this.parser.parse(
      inviteMsg.typeId,
      inviteMsg.payloadBytes || new Uint8Array([]),
    );

    if (parsed.kind !== 'content' || parsed.payload.kind !== 'group-invite') {
      this.logger.error(
        `[GroupProtocol] Msg ${inviteMsg.id} is not a valid Group Invite.`,
      );
      return;
    }

    const inviteData = parsed.payload.data;
    const groupUrn = URN.parse(inviteData.groupUrn);

    // ✅ UPDATE: Use Correct Content Type
    const responseData: GroupJoinData = {
      groupUrn: inviteData.groupUrn,
      status: status,
      timestamp: Temporal.Now.instant().toString(),
    };

    const bytes = new TextEncoder().encode(JSON.stringify(responseData));

    await this.outbound.sendMessage(
      myKeys,
      myUrn,
      groupUrn,
      MessageGroupInviteResponse,
      bytes,
    );
  }
}
