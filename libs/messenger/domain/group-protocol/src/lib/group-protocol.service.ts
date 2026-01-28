import { Injectable, inject } from '@angular/core';
import { Temporal } from '@js-temporal/polyfill';

import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { URN } from '@nx-platform-application/platform-types';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { EntityTypeUser } from '@nx-platform-application/directory-types';
import { OutboundService } from '@nx-platform-application/messenger-domain-sending';
import { IdentityResolver } from '@nx-platform-application/messenger-domain-identity-adapter';
import { PrivateKeys } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';

import { DirectoryMutationApi } from '@nx-platform-application/directory-api';

import { ContactsQueryApi } from '@nx-platform-application/contacts-api';

// ✅ DOMAIN TYPES & CONSTANTS
import {
  GroupInvitePayload,
  GroupJoinData,
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
    name: string, // ✅ NEW ARGUMENT
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

    // Add Myself first
    const myNetworkId = await this.identityResolver.resolveToHandle(myUrn);
    roster.push({ networkId: myNetworkId, alias: 'Me' });

    for (const p of participants) {
      const networkId = await this.identityResolver.resolveToHandle(p.id);
      // We only include people we can actually route to (Handle URNs)
      if (networkId.namespace !== 'contacts') {
        roster.push({ networkId, alias: p.alias });
      }
    }

    if (roster.length < 2) {
      throw new Error('No valid network participants found (need 2+)');
    }

    // 3. Mint Network Identity
    const uuid = crypto.randomUUID();
    const networkGroupUrn = URN.create('group', uuid, 'messenger');
    const now = Temporal.Now.instant().toString();

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

    const invitePayload: GroupInvitePayload = {
      groupUrn: networkGroupUrn.toString(),
      name: name,
      description: `Invited by ${myUrn.entityId}`,
      inviterUrn: myNetworkId.toString(),
      participants: snapshot,
    };

    const bytes = this.parser.serialize({
      kind: 'group-invite',
      data: invitePayload,
    });

    // 7. Fan-Out (DM to each participant except me)
    const promises = roster
      .filter((p) => !p.networkId.equals(myNetworkId))
      .map(async (p) => {
        await this.outbound.sendMessage(
          myKeys,
          myUrn,
          p.networkId,
          MessageGroupInvite, // ✅ Uses Constant
          bytes,
        );
      });

    await Promise.all(promises);
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
  }

  async acceptInvite(
    inviteMsg: ChatMessage,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    // 1. Resolve Group ID
    const parsed = this.parser.parse(inviteMsg.typeId, inviteMsg.payloadBytes!);

    if (parsed.kind !== 'content' || parsed.payload.kind !== 'group-invite') {
      return;
    }

    const groupUrn = URN.parse(parsed.payload.data.groupUrn);
    const myNetworkId = await this.identityResolver.resolveToHandle(myUrn);

    // 2. UPDATE STATE: Mark myself as "Joined" in Directory
    await this.directoryMutation.updateMemberStatus(
      groupUrn,
      myNetworkId,
      'joined',
    );

    this.logger.info(
      `[GroupProtocol] Set status to JOINED for ${groupUrn.toString()}`,
    );

    // 3. RESPOND: Broadcast "Joined" to the group
    return this.respond(inviteMsg, myKeys, myUrn, 'joined');
  }

  async rejectInvite(
    inviteMsg: ChatMessage,
    myKeys: PrivateKeys,
    myUrn: URN,
  ): Promise<void> {
    const parsed = this.parser.parse(inviteMsg.typeId, inviteMsg.payloadBytes!);
    if (parsed.kind !== 'content' || parsed.payload.kind !== 'group-invite')
      return;

    const groupUrn = URN.parse(parsed.payload.data.groupUrn);
    const myNetworkId = await this.identityResolver.resolveToHandle(myUrn);

    // Update Directory
    await this.directoryMutation.updateMemberStatus(
      groupUrn,
      myNetworkId,
      'declined',
    );

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
      return;
    }

    const inviteData = parsed.payload.data;
    const groupUrn = URN.parse(inviteData.groupUrn);

    const responseData: GroupJoinData = {
      groupUrn: inviteData.groupUrn,
      status: status,
      timestamp: Temporal.Now.instant().toString(),
    };

    const bytes = this.parser.serialize({
      kind: 'group-system',
      data: responseData,
    });

    // Send to the Group URN
    // (NetworkGroupStrategy will fan-out based on Directory roster)
    await this.outbound.sendMessage(
      myKeys,
      myUrn,
      groupUrn,
      MessageGroupInviteResponse, // ✅ Uses Constant
      bytes,
    );
  }
}
