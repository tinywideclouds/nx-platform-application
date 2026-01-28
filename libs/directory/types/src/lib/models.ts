import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

export const EntityTypeUser = URN.parse('urn:directory:type:user');
/**
 * 1. THE ATOM
 * Represents a unique network identity (User, Bot, etc).
 * Pure existence only.
 */
export interface DirectoryEntity {
  id: URN;
  type: URN; // e.g. urn:directory:type:user
}

/**
 * 2. THE STATUS
 * The relationship between an Entity and a Group.
 */
export type GroupMemberStatus = 'invited' | 'joined' | 'declined' | 'left';

/**
 * 3. THE AGGREGATE
 * The Group holds the Roster AND the Status of each member.
 */
export interface DirectoryGroup {
  id: URN;

  // The Resolved Entities (for convenience/rendering)
  members: DirectoryEntity[];

  // The Source of Truth for Membership State
  // Key: Entity URN string -> Value: Status
  memberState: Record<string, GroupMemberStatus>;

  lastUpdated: ISODateTimeString;
}
