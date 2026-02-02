import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';

import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { EntityTypeUser } from '@nx-platform-application/directory-types';
import {
  GroupPayloadFactory,
  MessageTypeSystem,
} from '@nx-platform-application/messenger-domain-message-content';
import { OutboundService } from '@nx-platform-application/messenger-domain-sending';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';

import { DirectoryMutationApi } from '@nx-platform-application/directory-api';

import { ContactsQueryApi } from '@nx-platform-application/contacts-api';

// ✅ NEW DEPENDENCY
import { ConversationService } from '@nx-platform-application/messenger-domain-conversation';

// ✅ DOMAIN TYPES & CONSTANTS
import {
  GroupInvitePayload,
  GroupSignalData,
  GroupParticipantSnapshot,
  MessageGroupInvite, // URN Constant
  MessageGroupInviteResponse, // URN Constant
  MessageContentParser,
} from '@nx-platform-application/messenger-domain-message-content';

import {
  DirectoryGroup,
  DirectoryEntity,
  GroupMemberStatus,
} from '@nx-platform-application/directory-types';

@Injectable({ providedIn: 'root' })
export class GroupProtocolService {
  private outbound = inject(OutboundService);
  private parser = inject(MessageContentParser);
  private logger = inject(Logger);
  private identityResolver = inject(IdentityResolver);

  // ✅ Inject the Domain Service
  private conversationService = inject(ConversationService);

  // ✅ Architecture Swap
  private contactsQuery = inject(ContactsQueryApi);
  private directoryMutation = inject(DirectoryMutationApi);

  /**
   * PROVISIONER: Creates a new Network Group from a Local Template.
   */
  async provisionNetworkGroup(
    localGroupUrn: URN,
    myKeys: PrivateKeys,
    myUrn: URN,
    name: string,
  ): Promise<URN> {
    this.logger.info(
      `[GroupProtocol] Provisioning '${name}' from ${localGroupUrn.toString()}`,
    );

    // 1. Fetch Source Participants (Local URNs)
    const participants =
      await this.contactsQuery.getGroupParticipants(localGroupUrn);

    if (participants.length === 0) {
      throw new Error('Cannot provision empty group');
    }

    // 2. Resolve Network Identities (Local -> Network)
    const roster: { networkId: URN; alias: string }[] = [];
    const invitees: URN[] = [];

    for (const p of participants) {
      const networkId = await this.identityResolver.resolveToHandle(p.id);
      // We only include people we can actually route to (Handle URNs)
      if (networkId.namespace !== 'contacts') {
        roster.push({ networkId, alias: p.alias });
        invitees.push(networkId);
      }
    }

    if (roster.length == 0) {
      throw new Error('No valid network participants found (need 2+)');
    }

    // Add Myself
    const myNetworkId = await this.identityResolver.resolveToHandle(myUrn);
    roster.push({ networkId: myNetworkId, alias: 'Me' });

    // 3. Mint Network Identity
    const uuid = crypto.randomUUID();
    const networkGroupUrn = URN.create('group', uuid, 'messenger');
    const now = Temporal.Now.instant().toString();

    await this.conversationService.startNewConversation(networkGroupUrn, name);

    // 4. Construct Directory Group State
    const memberState: Record<string, GroupMemberStatus> = {};
    const entities: DirectoryEntity[] = [];

    roster.forEach((p) => {
      const idStr = p.networkId.toString();
      // I am joined, everyone else is invited
      memberState[idStr] = p.networkId.equals(myNetworkId)
        ? 'joined'
        : 'invited';

      entities.push({
        id: p.networkId,
        type: EntityTypeUser,
      });
    });

    const newGroup: DirectoryGroup = {
      id: networkGroupUrn,
      members: entities,
      memberState,
      lastUpdated: now as any,
    };

    // 5. Persist to Directory (Corrected from AddressBook)
    await this.directoryMutation.saveGroup(newGroup);

    // 6. Construct Payload (With Snapshot)
    const snapshot: GroupParticipantSnapshot[] = roster.map((p) => ({
      urn: p.networkId.toString(),
      alias: p.alias,
    }));

    const content = GroupPayloadFactory.createGroupInvite(
      networkGroupUrn,
      myNetworkId,
      name,
      snapshot,
      `Invited by ${myUrn.entityId}`,
    );

    const inviteBytes = this.parser.serialize(content);

    // 7. Fan-Out (DM to each participant except me)
    // 6. Send Invites (✅ 1:1 Fan-Out)
    // We send individual messages to each participant's 1:1 conversation.
    // Note: We ideally want { shouldPersist: false } here to keep 1:1 history clean,
    // but we respect the existing OutboundService contract for now.
    await this.outbound.broadcast(
      myKeys,
      myUrn,
      invitees,
      networkGroupUrn,
      MessageGroupInvite,
      inviteBytes,
      {
        isEphemeral: false,
        shouldPersist: true, // Sender sees "You invited..." in Group Chat
      },
    );

    return networkGroupUrn;
  }

  /**
   * INGESTION: Process an incoming Group Invite.
   * Saves strangers to Directory, creates the Consensus Group.
   */
  async processIncomingInvite(groupInvite: GroupInvitePayload): Promise<void> {
    const groupUrn = URN.parse(groupInvite.groupUrn);
    const now = Temporal.Now.instant().toString();

    const entities: DirectoryEntity[] = [];
    const memberState: Record<string, GroupMemberStatus> = {};

    // 1. Process Roster from Payload
    if (groupInvite.participants) {
      for (const p of groupInvite.participants) {
        if (!p.urn) continue;
        const pUrn = URN.parse(p.urn);

        // Seed the Entity in Directory (Idempotent)
        const entity: DirectoryEntity = {
          id: pUrn,
          type: EntityTypeUser,
        };
        await this.directoryMutation.saveEntity(entity);
        entities.push(entity);

        // Set initial state
        if (p.urn === groupInvite.inviterUrn) {
          memberState[p.urn] = 'joined';
        } else {
          memberState[p.urn] = 'invited';
        }
      }
    }

    // 2. Persist the Consensus Group to Directory
    const group: DirectoryGroup = {
      id: groupUrn,
      members: entities,
      memberState,
      lastUpdated: now as any,
    };

    await this.directoryMutation.saveGroup(group);

    const displayName = groupInvite.name;
    await this.conversationService.startNewConversation(groupUrn, displayName);
  }

  /**
   * Processes an incoming Group Invite.
   * Sends a "Joined" signal back to the group.
   * Returns the Group URN for navigation.
   */
  public async acceptInvite(
    msg: ChatMessage,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<string> {
    return this.respond(msg, myKeys, myUrn, 'joined');
  }

  /**
   * Processes an incoming Group Invite.
   * Sends a "Declined" signal back to the group.
   */
  public async rejectInvite(
    msg: ChatMessage,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    await this.respond(msg, myKeys, myUrn, 'declined');
  }

  /**
   * ✅ NEW: Protocol Controller
   * Consumes a signal, updates state, and decides what history to create.
   */
  async processSignal(
    signal: GroupSignalData,
    senderUrn: URN,
    context: { messageId: string; sentAt: string }, // Context passed from Ingestion
  ): Promise<ChatMessage | null> {
    const groupUrn = URN.parse(signal.groupUrn);
    const status = signal.status === 'joined' ? 'joined' : 'declined';

    const networkHandle =
      await this.identityResolver.resolveToHandle(senderUrn);

    this.logger.info(
      `[GroupProtocol] Processing: ${networkHandle} -> ${status} for ${groupUrn}`,
    );

    // 1. Update State (Directory)
    await this.directoryMutation.updateMemberStatus(
      groupUrn,
      networkHandle,
      status,
    );

    // 2. Control Persistence
    // Logic: Only 'joined' warrants a visible bubble in the chat.
    if (status !== 'joined') {
      return null;
    }

    const content = GroupPayloadFactory.createJoinedSignal(groupUrn);

    // 3. Create the Persistent Message
    return {
      id: context.messageId,
      conversationUrn: groupUrn,
      senderId: senderUrn,
      sentTimestamp: context.sentAt as ISODateTimeString,
      status: 'read',
      typeId: MessageTypeSystem,
      payloadBytes: this.parser.serialize(content),
      tags: [URN.parse('urn:messenger:event:system-event')],
    };
  }

  private async respond(
    inviteMsg: ChatMessage,
    myKeys: PrivateKeys,
    myUrn: URN,
    status: 'joined' | 'declined',
  ): Promise<string> {
    const parsed = this.parser.parse(
      inviteMsg.typeId,
      inviteMsg.payloadBytes || new Uint8Array([]),
    );

    if (parsed.kind !== 'content' || parsed.payload.kind !== 'group-invite') {
      throw new Error(`Invalid Group Invite Message: ${inviteMsg.id}`);
    }

    const inviteData = parsed.payload.data;
    const groupUrn = URN.parse(inviteData.groupUrn);

    // 1. Update Directory locally if we are joining
    if (status === 'joined') {
      const identity = await this.identityResolver.resolveToHandle(myUrn);
      if (identity) {
        await this.directoryMutation.updateMemberStatus(
          groupUrn,
          identity,
          'joined',
        );
      }
    }

    // 2. Create Response Content
    const content =
      status === 'joined'
        ? GroupPayloadFactory.createJoinedSignal(groupUrn)
        : GroupPayloadFactory.createDeclinedSignal(groupUrn);

    const bytes = this.parser.serialize(content);

    // 3. Broadcast the Response
    await this.outbound.sendToConversation(
      myKeys,
      myUrn,
      groupUrn,
      MessageGroupInviteResponse,
      bytes,
    );

    return groupUrn.toString();
  }
}
