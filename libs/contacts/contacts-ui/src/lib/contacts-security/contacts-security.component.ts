import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

// ✅ CORRECT: Internal UI uses Internal State Service
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { PendingIdentity } from '@nx-platform-application/contacts-types';

import { PendingListComponent } from '../pending-list/pending-list.component';

@Component({
  selector: 'contacts-security',
  standalone: true,
  imports: [MatCardModule, MatIconModule, PendingListComponent],
  templateUrl: './contacts-security.component.html',
  styleUrl: './contacts-security.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactsSecurityComponent {
  private state = inject(ContactsStateService);

  // ✅ Signal exposed directly from State
  pending = this.state.pending;

  async approveIdentity(pending: PendingIdentity) {
    // "Approve" removes it from the pending list (Quarantine)
    await this.state.deletePending(pending.urn);
  }

  async blockPending(pending: PendingIdentity) {
    // State orchestration handles blocking AND removing from pending
    await this.state.blockIdentity(pending.urn, ['messenger']);
  }
}
