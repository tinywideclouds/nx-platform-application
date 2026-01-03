import { ContactGroup } from '@nx-platform-application/contacts-types';

export interface GroupBadge {
  icon: string; // Material Icon Name (e.g., 'hub', 'lock', 'campaign')
  color?: 'primary' | 'accent' | 'warn';
  tooltip?: string;
  count?: number; // e.g. Unread count or pending members
}

/**
 * The Adapter Contract.
 * The consuming app (Messenger) implements this logic to tell Contacts UI what to show.
 */
export type GroupBadgeResolver = (group: ContactGroup) => GroupBadge[];
