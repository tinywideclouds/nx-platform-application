// libs/messenger/message-content/src/lib/components/message-renderer/message-renderer.component.ts

import { 
  Component, 
  ChangeDetectionStrategy, 
  input, 
  inject, 
  computed 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import { MessageContentParser } from '../../services/message-content-parser.service';
import { ContactShareCardComponent } from '../contact-share-card/contact-share-card.component';
import { Router } from '@angular/router'; // To handle navigation

@Component({
  selector: 'messenger-message-renderer',
  standalone: true,
  imports: [CommonModule, ContactShareCardComponent],
  templateUrl: './message-renderer.component.html',
  styleUrl: './message-renderer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageRendererComponent {
  message = input.required<ChatMessage>();
  
  private parser = inject(MessageContentParser);
  private router = inject(Router);

  // Parse the content lazily when the message changes
  content = computed(() => {
    const msg = this.message();
    return this.parser.parse(msg.typeId, msg.payloadBytes);
  });

  /**
   * Handles actions from rich content (e.g., clicking "View Contact")
   */
  onViewContact(urnString: string): void {
    // Navigate to the Contact Details view within the chat
    // Logic: We are in /chat/:id. We want to go to /chat/:id/details?contactId=...
    // Actually, our route setup expects /chat/:id/details where :id IS the contact.
    // BUT wait, we might be viewing Bob, but Alice shared Charlie. 
    // If we click Charlie, do we leave the chat?
    
    // UX Decision: For now, let's navigate to the contacts app to view this person
    // to avoid confusing the Chat Shell state.
    // OR: We open a dialog.
    
    // Simplest for now: Navigate to global contacts edit/view page
    // This breaks out of the chat, which is safe.
    this.router.navigate(['/contacts/edit', urnString]);
  }
}