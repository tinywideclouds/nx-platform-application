// libs/messenger/chat-ui/src/lib/contact-share-card/contact-share-card.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

// REFACTOR: Import from the logic lib
import { ContactShareData } from '@nx-platform-application/messenger-domain-message-content';

@Component({
  selector: 'chat-contact-share-card',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './contact-share-card.component.html',
  styleUrl: './contact-share-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactShareCardComponent {
  data = input.required<ContactShareData>();

  action = output<string>();

  get initials(): string {
    return this.data().alias.slice(0, 2).toUpperCase();
  }

  onAction(): void {
    this.action.emit(this.data().urn);
  }
}
