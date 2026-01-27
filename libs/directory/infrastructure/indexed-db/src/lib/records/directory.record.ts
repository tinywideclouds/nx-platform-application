// libs/directory/infrastructure/indexed-db/src/lib/records/directory.record.ts

import { ISODateTimeString } from '@nx-platform-application/platform-types';
import { GroupMemberStatus } from '@nx-platform-application/directory-types';

/**
 * DB Table: 'entities'
 *
 * Represents the "Atom" of the directory.
 * Stores minimal metadata required to prove an entity exists.
 */
export interface StorableDirectoryEntity {
  /** Primary Key: The strict URN of the entity */
  urn: string;
  /** Indexed: Allows querying by type (e.g. 'Give me all users') */
  type: string;
  lastAccessed: string;
}

/**
 * DB Table: 'groups'
 *
 * Represents the storage format for a Directory Group.
 * Note the intentional data duplication between `memberState` and `memberUrns`
 * to support IndexedDB specific indexing capabilities.
 */
export interface StorableGroup {
  /** Primary Key */
  urn: string;

  /**
   * The Source of Truth for membership status.
   * Stored as a JSON object (Map) for O(1) lookups during hydration.
   * Not searchable directly in IndexedDB.
   */
  memberState: Record<string, GroupMemberStatus>;

  /**
   * INDEX ONLY: Flattened list of URNs.
   *
   * This field exists solely to power the MultiEntry Index (`*memberUrns`).
   * It allows efficient "Reverse Lookup" queries:
   * "Find all groups where User X is a member."
   */
  memberUrns: string[];

  lastUpdated: string;
}
