import { Injectable, inject, computed, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { URN } from '@nx-platform-application/platform-types';
import {
  Contact,
  IdentityLink,
  GroupNotFoundError,
  EmptyGroupError,
} from '@nx-platform-application/contacts-types';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';

@Injectable({ providedIn: 'root' })
export class ContactsStateService {
  private storage = inject(ContactsStorageService);

  readonly contacts = toSignal(this.storage.contacts$, { initialValue: [] });
  readonly favorites = toSignal(this.storage.favorites$, { initialValue: [] });
  readonly groups = toSignal(this.storage.groups$, { initialValue: [] });
  readonly blocked = toSignal(this.storage.blocked$, { initialValue: [] });

  private readonly contactMap = computed(() => {
    const map = new Map<string, Contact>();
    for (const c of this.contacts()) {
      map.set(c.id.toString(), c);
    }
    return map;
  });

  // --- Trust & Security API ---

  /**
   * Determines if a URN is "Trusted" for a specific application scope.
   * A Trusted user must be:
   * 1. Present in the Address Book (Contact Map).
   * 2. NOT blocked for the requested scope.
   *
   * @param urn The sender's URN.
   * @param scope The application scope (e.g., 'messenger').
   */
  async isTrusted(urn: URN, scope: string = 'messenger'): Promise<boolean> {
    const idStr = urn.toString();

    // 1. Contact Check: Must be in our address book
    // (Future: We might add an "Allow Unknowns" setting here)
    const isInContacts = this.contactMap().has(idStr);

    if (!isInContacts) {
      return false;
    }

    // 2. Block Check: Must not be blocked for this specific scope
    // We check the synchronous blocked signal for instant results.
    const allBlocked = this.blocked();
    const isBlockedForScope = allBlocked.some(
      (b) =>
        b.urn.toString() === idStr &&
        (b.scopes.includes('all') || b.scopes.includes(scope)),
    );

    return !isBlockedForScope;
  }

  /**
   * Returns a Computed Signal containing a Set of URN strings filtered by scope.
   * This allows "Apps" to register their interest in specific block categories.
   * @param scope The specific application scope (e.g., 'messenger')
   */
  getFilteredBlockedSet(scope: string): Signal<Set<string>> {
    return computed(() => {
      const filteredSet = new Set<string>();
      const allBlocked = this.blocked();

      for (const b of allBlocked) {
        if (b.scopes.includes('all') || b.scopes.includes(scope)) {
          filteredSet.add(b.urn.toString());
        }
      }
      return filteredSet;
    });
  }

  resolveContactName(urn: URN | string | null | undefined): Signal<string> {
    return computed(() => {
      if (!urn) return 'Unknown';

      const idStr = urn.toString();
      const contact = this.contactMap().get(idStr);

      if (contact) {
        return contact.alias || contact.firstName || 'Unknown Contact';
      }

      return this.formatUnknownUrn(idStr);
    });
  }

  resolveContact(
    urn: URN | string | null | undefined,
  ): Signal<Contact | undefined> {
    return computed(() => {
      if (!urn) return undefined;
      return this.contactMap().get(urn.toString());
    });
  }

  /**
   * Resolves a Group URN into a list of individual participant contacts.
   * Used by the OutboxWorker for group fan-out.
   */
  async getGroupParticipants(groupUrn: URN): Promise<Contact[]> {
    const group = await this.storage.getGroup(groupUrn);

    if (!group) {
      throw new GroupNotFoundError(groupUrn.toString());
    }

    const participants = await this.storage.getContactsForGroup(groupUrn);

    if (participants.length === 0) {
      // This distinguishes a valid group that happens to be empty from a missing one
      throw new EmptyGroupError(groupUrn.toString());
    }

    return participants;
  }

  // --- Wrapper Methods (The Facade) ---

  /**
   * Blocks an identity across specific scopes and removes them from the pending list.
   * @param urn The identity to block.
   * @param scopes The application scopes (defaults to 'all').
   */
  async blockIdentity(urn: URN, scopes: string[] = ['all']): Promise<void> {
    // 1. Record the block in storage [cite: 37]
    await this.storage.blockIdentity(urn, scopes);

    // 2. Cleanup: If they were in the "Pending" list, they shouldn't be anymore [cite: 37]
    await this.storage.deletePending(urn);
  }

  async unblockIdentity(urn: URN): Promise<void> {
    await this.storage.unblockIdentity(urn);
  }

  async deletePending(urn: URN): Promise<void> {
    await this.storage.deletePending(urn);
  }

  /**
   * Used by ChatService to refresh the identity mapping in memory.
   */
  async getAllIdentityLinks(): Promise<IdentityLink[]> {
    return this.storage.getAllIdentityLinks();
  }

  /**
   * Used during Logout/Full Device Wipe.
   * This is the "Nuclear Option" that clears everything, including blocked users.
   */
  async clearDatabase(): Promise<void> {
    await this.storage.clearDatabase();
  }

  /**
   * Triggers a granular wipe of local contact data via the storage service.
   * UI will automatically update via liveQuery signals.
   */
  async performContactsWipe(): Promise<void> {
    await this.storage.clearAllContacts();
  }

  private formatUnknownUrn(str: string): string {
    const id = str.includes(':') ? str.split(':').pop()! : str;

    if (id.length === 36 && id.includes('-')) {
      return `User ${id.slice(-4).toUpperCase()}`;
    }

    return id;
  }
}
