import { Injectable, inject, computed, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { URN } from '@nx-platform-application/platform-types';
import { Contact } from '@nx-platform-application/contacts-types';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';

@Injectable({ providedIn: 'root' })
export class ContactsStateService {
  private storage = inject(ContactsStorageService);

  // --- 1. The Source of Truth (Signals) ---

  // Live stream from DB -> Signal. Defaults to empty array to prevent null checks in UI.
  readonly contacts = toSignal(this.storage.contacts$, { initialValue: [] });

  readonly favorites = toSignal(this.storage.favorites$, { initialValue: [] });

  readonly groups = toSignal(this.storage.groups$, { initialValue: [] });

  readonly blocked = toSignal(this.storage.blocked$, { initialValue: [] });

  // --- 2. Derived State (Indexes for O(1) Lookup) ---

  // A fast lookup map: URN String -> Contact
  private readonly contactMap = computed(() => {
    const map = new Map<string, Contact>();
    for (const c of this.contacts()) {
      map.set(c.id.toString(), c);
    }
    return map;
  });

  // --- 3. The Resolver API (The Fix) ---

  /**
   * Returns a Signal that ALWAYS resolves to a display name.
   * Usage in template: {{ nameSignal() }}
   * * @param urn The URN to look up (can be null/undefined/string)
   */
  resolveContactName(urn: URN | string | null | undefined): Signal<string> {
    return computed(() => {
      if (!urn) return 'Unknown';

      const idStr = urn.toString();
      const contact = this.contactMap().get(idStr);

      if (contact) {
        // Preference: Alias -> First Name -> Fallback
        return contact.alias || contact.firstName || 'Unknown Contact';
      }

      // Fallback for unknown URNs (Fixes the ugly UUID display)
      return this.formatUnknownUrn(idStr);
    });
  }

  /**
   * Returns a Signal for the full contact object.
   */
  resolveContact(
    urn: URN | string | null | undefined,
  ): Signal<Contact | undefined> {
    return computed(() => {
      if (!urn) return undefined;
      return this.contactMap().get(urn.toString());
    });
  }

  // --- 4. Actions (Write Operations) ---
  // Delegate strictly to storage. State updates automatically via the live stream.

  async blockIdentity(urn: URN): Promise<void> {
    await this.storage.blockIdentity(urn);
  }

  async unblockIdentity(urn: URN): Promise<void> {
    await this.storage.unblockIdentity(urn);
  }

  // --- Helpers ---

  private formatUnknownUrn(str: string): string {
    // Strip "urn:*:*:" prefix
    const id = str.includes(':') ? str.split(':').pop()! : str;

    // If UUID-like, show short code
    if (id.length === 36 && id.includes('-')) {
      return `User ${id.slice(-4).toUpperCase()}`;
    }

    return id;
  }
}
