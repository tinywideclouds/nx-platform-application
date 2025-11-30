import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import {
  ContactsStorageService,
  PendingIdentity,
} from '@nx-platform-application/contacts-storage';

import { PendingListComponent } from '../pending-list/pending-list.component';

@Component({
  selector: 'contacts-security',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, PendingListComponent],
  templateUrl: './contacts-security.component.html',
  styleUrl: './contacts-security.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsSecurityComponent {
  private contactsService = inject(ContactsStorageService);

  // Logic extracted from the original settings page
  pending = toSignal(this.contactsService.pending$, { initialValue: [] });

  async approveIdentity(pending: PendingIdentity) {
    await this.contactsService.deletePending(pending.urn);
  }

  async blockPending(pending: PendingIdentity) {
    await this.contactsService.deletePending(pending.urn);
  }
}
