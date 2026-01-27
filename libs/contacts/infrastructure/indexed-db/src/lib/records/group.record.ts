import { ISODateTimeString } from '@nx-platform-application/platform-types';

/**
 * DB Table: 'groups'
 *
 * Represents a user-defined collection of contacts (e.g., "Work Friends").
 *
 * ⚠️ V9 UPDATE (The Revert):
 * We have restored 'contactIds' to this record.
 * Contact Groups are strictly local and contain only Contact URNs.
 */
export interface StorableGroup {
  id: string;
  /**
   * Optional: If this local group is linked to a network directory group.
   */
  directoryId?: string;
  name: string;
  description: string;

  /**
   * INDEX: Flattened list of Contact URNs.
   * Allows high-performance reverse lookups: "Which groups contain Alice?"
   */
  contactIds: string[];

  lastModified: string;
}
