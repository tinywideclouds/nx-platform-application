// libs/contacts/contacts-ui/src/lib/components/pending-list/pending-list.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PendingIdentity } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';

@Component({
  selector: 'contacts-pending-list',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './pending-list.component.html',
  styleUrl: './pending-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingListComponent {
  pending = input.required<PendingIdentity[]>();

  approve = output<PendingIdentity>();
  block = output<PendingIdentity>();

  formatUrn(urn: URN): string {
    const parts = urn.toString().split(':');
    return parts.length > 2 ? `${parts[2]}:${parts[3]}` : urn.toString();
  }

  onApprove(item: PendingIdentity): void {
    this.approve.emit(item);
  }

  onBlock(item: PendingIdentity): void {
    this.block.emit(item);
  }

  trackByUrn(index: number, item: PendingIdentity): string {
    return item.urn.toString();
  }
}
