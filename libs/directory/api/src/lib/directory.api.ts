import { URN } from '@nx-platform-application/platform-types';
import {
  DirectoryEntity,
  DirectoryGroup,
  GroupMemberStatus,
} from '@nx-platform-application/directory-types';

/**
 * PORT: Directory Query (Read Access)
 * Consumed by: Contacts UI, Messenger Routing, Gatekeeper
 */
export abstract class DirectoryQueryApi {
  /**
   * The fundamental lookup.
   * "Who is this?" (User, Bot, or Group Identity)
   */
  abstract getEntity(urn: URN): Promise<DirectoryEntity | undefined>;

  /**
   * Bulk lookup for performance.
   * Used when rendering a contact list or chat roster.
   */
  abstract getEntities(urns: URN[]): Promise<DirectoryEntity[]>;

  /**
   * Resolves a Group's Roster.
   * "Who is in this group right now?"
   */
  abstract getGroup(urn: URN): Promise<DirectoryGroup | undefined>;

  abstract getGroupMetadata(urn: URN): Promise<{ memberCount: number }>;
}

/**
 * PORT: Directory Mutation (Write Access)
 */
export abstract class DirectoryMutationApi {
  /**
   * Ingests a discovered entity (e.g., from an incoming message header).
   * "I just heard from Bob, here are his keys."
   */
  abstract saveEntity(entity: DirectoryEntity): Promise<void>;

  /**
   * Updates a group's roster or state.
   */
  abstract saveGroup(group: DirectoryGroup): Promise<void>;

  /**
   * Atomic update for protocol consensus.
   * "Bob just sent a 'Left' packet for Group X."
   */
  abstract updateMemberStatus(
    groupUrn: URN,
    memberUrn: URN,
    status: GroupMemberStatus,
  ): Promise<void>;
}
