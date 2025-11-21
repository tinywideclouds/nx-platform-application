// libs/contacts/contacts-ui/src/lib/components/blocked-list/blocked-list.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { BlockedIdentity } from '@nx-platform-application/contacts-access';
import { URN } from '@nx-platform-application/platform-types';

@Component({
  selector: 'contacts-blocked-list',
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatExpansionModule,
  ],
  templateUrl: './blocked-list.component.html',
  styleUrl: './blocked-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockedListComponent {
  // Using signal inputs (modern Angular)
  blocked = input.required<BlockedIdentity[]>();

  unblock = output<BlockedIdentity>();

  // Helper to format URNs for display
  formatUrn(urn: URN): string {
    // urn:auth:provider:id -> provider:id
    const parts = urn.toString().split(':');
    return parts.length > 2 ? `${parts[2]}:${parts[3]}` : urn.toString();
  }

  onUnblock(item: BlockedIdentity): void {
    this.unblock.emit(item);
  }

  trackByUrn(index: number, item: BlockedIdentity): string {
    return item.urn.toString();
  }
}
