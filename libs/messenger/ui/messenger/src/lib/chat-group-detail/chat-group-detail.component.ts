import {
  Component,
  inject,
  input,
  computed,
  signal,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop'; // ✅ Required for template signal call
import { URN } from '@nx-platform-application/platform-types';

import {
  AddressBookApi,
  AddressBookManagementApi,
  ContactsQueryApi,
  ContactSummary,
} from '@nx-platform-application/contacts-api';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { DirectoryQueryApi } from '@nx-platform-application/directory-api';

// UI Imports
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { ContactGroupFormComponent } from '@nx-platform-application/contacts-ui';

interface RosterMember extends ContactSummary {
  isSaved: boolean;
  memberStatus?: string; // ✅ Optional: Only for Network Groups
}

@Component({
  selector: 'messenger-chat-group-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatTooltipModule,
    MatProgressBarModule,
    ContactGroupFormComponent,
  ],
  templateUrl: './chat-group-detail.component.html',
  styleUrl: './chat-group-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatGroupDetailComponent {
  groupId = input.required<URN>();

  private addressBook = inject(AddressBookApi);
  private contactsQuery = inject(ContactsQueryApi);
  private addressBookManager = inject(AddressBookManagementApi);
  private directory = inject(DirectoryQueryApi);

  group = signal<ContactGroup | null>(null);
  roster = signal<RosterMember[]>([]);
  isLoading = signal<boolean>(true);

  // ✅ FIX: Converted to Signal for Template Usage
  allContacts = toSignal(this.addressBook.contacts$, {
    initialValue: [] as Contact[],
  });

  constructor() {
    effect(() => {
      const id = this.groupId();
      this.loadData(id);
    });
  }

  private async loadData(id: URN): Promise<void> {
    this.isLoading.set(true);
    try {
      const groupData = await this.addressBook.getGroup(id);
      this.group.set(groupData ?? null);

      if (groupData) {
        const summaries = await this.contactsQuery.getGroupParticipants(id);

        let memberState: Record<string, string> = {};

        // Only fetch state for Network Groups
        if (this.isNetworkGroup(groupData)) {
          const dirGroup = await this.directory.getGroup(id);
          if (dirGroup) {
            memberState = dirGroup.memberState;
          }
        }

        const enriched: RosterMember[] = await Promise.all(
          summaries.map(async (s) => {
            const status = memberState[s.id.toString()]; // Undefined for local
            const saved = await this.addressBook.getContact(s.id);
            return {
              ...s,
              memberStatus: status, // ✅ Optional
              isSaved: !!saved,
            };
          }),
        );

        this.roster.set(enriched);
      }
    } catch (err) {
      console.error('Failed to load group details', err);
      this.group.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  private isNetworkGroup(g: ContactGroup): boolean {
    return (
      (g as any).scope === 'messenger' || g.id.namespace.startsWith('messenger')
    );
  }

  isNetworkGroupSig = computed(() => {
    const g = this.group();
    return g ? this.isNetworkGroup(g) : false;
  });

  stats = computed(() => {
    // Stats are irrelevant for Local Groups (always 100%)
    if (!this.isNetworkGroupSig()) return null;

    const members = this.roster();
    const total = members.length;
    const joined = members.filter((m) => m.memberStatus === 'joined').length;
    const pending = members.filter((m) => m.memberStatus === 'invited').length;

    const progress = total > 0 ? (joined / total) * 100 : 0;
    return { total, joined, pending, progress };
  });

  async promote(urn: URN): Promise<void> {
    try {
      await this.addressBookManager.linkIdentity(
        URN.parse(`urn:contacts:user:${crypto.randomUUID()}`),
        { directoryUrn: urn },
      );

      this.roster.update((list) =>
        list.map((m) => (m.id.equals(urn) ? { ...m, isSaved: true } : m)),
      );
    } catch (err) {
      console.error('Failed to promote contact', err);
    }
  }

  onSave(group: ContactGroup): void {
    this.addressBookManager.saveGroup(group);
  }
}
