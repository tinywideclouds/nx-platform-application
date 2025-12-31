import { Injectable, inject, computed, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { URN } from '@nx-platform-application/platform-types';
import {
  Contact,
  ContactGroup,
  IdentityLink,
  GroupNotFoundError,
  EmptyGroupError,
  BlockedIdentity,
} from '@nx-platform-application/contacts-types';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';

@Injectable({ providedIn: 'root' })
export class ContactsStateService {
  private storage = inject(ContactsStorageService);

  readonly contacts = toSignal(this.storage.contacts$, {
    initialValue: [] as Contact[],
  });
  readonly favorites = toSignal(this.storage.favorites$, {
    initialValue: [] as Contact[],
  });
  readonly groups = toSignal(this.storage.groups$, {
    initialValue: [] as ContactGroup[],
  });
  readonly blocked = toSignal(this.storage.blocked$, {
    initialValue: [] as BlockedIdentity[],
  });

  private readonly contactMap = computed(() => {
    const map = new Map<string, Contact>();
    for (const c of this.contacts()) {
      map.set(c.id.toString(), c);
    }
    return map;
  });

  // --- API Support Methods (New) ---

  /**
   * Checks blocked status for a specific scope.
   * Required for the Contacts API Contract.
   */
  async isBlocked(urn: URN, scope: string): Promise<boolean> {
    const idStr = urn.toString();
    const allBlocked = this.blocked();
    return allBlocked.some(
      (b) =>
        b.urn.toString() === idStr &&
        (b.scopes.includes('all') || b.scopes.includes(scope)),
    );
  }

  /**
   * Resolves a URN to a Contact immediately (Non-Reactive).
   * Used by Facades/APIs for business logic (O(1) lookup).
   */
  getContactSnapshot(urn: URN): Contact | undefined {
    return this.contactMap().get(urn.toString());
  }

  // --- Existing Logic ---

  async isTrusted(urn: URN, scope: string = 'messenger'): Promise<boolean> {
    const idStr = urn.toString();
    const isInContacts = this.contactMap().has(idStr);

    if (!isInContacts) {
      return false;
    }

    const blocked = await this.isBlocked(urn, scope);
    return !blocked;
  }

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
   */
  async getGroupParticipants(groupUrn: URN): Promise<Contact[]> {
    const group = await this.storage.getGroup(groupUrn);

    if (!group) {
      throw new GroupNotFoundError(groupUrn.toString());
    }

    const participants = await this.storage.getContactsForGroup(groupUrn);

    if (participants.length === 0) {
      throw new EmptyGroupError(groupUrn.toString());
    }

    return participants;
  }

  // --- Wrapper Methods (The Facade) ---

  async blockIdentity(urn: URN, scopes: string[] = ['all']): Promise<void> {
    await this.storage.blockIdentity(urn, scopes);
    await this.storage.deletePending(urn);
  }

  async unblockIdentity(urn: URN): Promise<void> {
    await this.storage.unblockIdentity(urn);
  }

  async deletePending(urn: URN): Promise<void> {
    await this.storage.deletePending(urn);
  }

  async getAllIdentityLinks(): Promise<IdentityLink[]> {
    return this.storage.getAllIdentityLinks();
  }

  async clearDatabase(): Promise<void> {
    await this.storage.clearDatabase();
  }

  async performContactsWipe(): Promise<void> {
    await this.storage.clearAllContacts(); // Note: Changed from performContactsWipe to match Storage
  }

  private formatUnknownUrn(str: string): string {
    const id = str.includes(':') ? str.split(':').pop()! : str;

    if (id.length === 36 && id.includes('-')) {
      return `User ${id.slice(-4).toUpperCase()}`;
    }

    return id;
  }
}
