import {
  Component,
  inject,
  input,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';

// UI Imports
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';
// ✅ REUSE: The form component from contacts-ui
import { ContactGroupFormComponent } from '@nx-platform-application/contacts-ui';

@Component({
  selector: 'messenger-chat-group-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressBarModule,
    MatButtonModule,
    ContactGroupFormComponent, // ✅ Imported
  ],
  templateUrl: './chat-group-detail.component.html',
  styleUrl: './chat-group-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatGroupDetailComponent {
  groupId = input.required<URN>();

  private contactsService = inject(ContactsStorageService);

  // --- Data Loading ---

  private group$ = toObservable(this.groupId).pipe(
    switchMap((id) => this.contactsService.getGroup(id)),
  );
  group = toSignal(this.group$);

  // The Form Component needs the full contact list to resolve member IDs
  // In a real app with 10k contacts, we'd optimize this, but for now it matches the ContactPage pattern
  private allContacts$ = this.contactsService.contacts$;
  allContacts = toSignal(this.allContacts$, { initialValue: [] as Contact[] });

  // --- Computed State ---

  isNetworkGroup = computed(() => {
    const g = this.group();
    if (!g) return false;
    return g.scope === 'messenger' || g.id.namespace.startsWith('messenger');
  });

  stats = computed(() => {
    const g = this.group();
    if (!g) return { total: 0, joined: 0, pending: 0, progress: 0 };

    const total = g.members.length;
    const joined = g.members.filter((m) => m.status === 'joined').length;
    const pending = g.members.filter(
      (m) => m.status === 'invited' || m.status === 'added',
    ).length;

    const progress = total > 0 ? (joined / total) * 100 : 0;

    return { total, joined, pending, progress };
  });

  // --- Actions ---

  // Since this is just a "Detail View" inside the chat, we disable editing here.
  // We could add an "Edit" button that navigates to the full Contacts section if needed.
  onSave(group: ContactGroup): void {
    // Read-only view in this context
    console.warn('Editing disabled in Chat Detail view');
  }
}
