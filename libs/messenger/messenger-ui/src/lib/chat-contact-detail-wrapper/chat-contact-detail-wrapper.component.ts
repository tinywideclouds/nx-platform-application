// libs/messenger/messenger-ui/src/lib/chat-contact-detail-wrapper/chat-contact-detail-wrapper.component.ts

import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { URN } from '@nx-platform-application/platform-types';
import { ChatService } from '@nx-platform-application/chat-state';
import { Logger } from '@nx-platform-application/console-logger';
import { ContactsStorageService } from '@nx-platform-application/contacts-data-access';

// UI Imports
import { ContactDetailComponent } from '@nx-platform-application/contacts-ui';
import { ChatShareContactFooterComponent } from '../chat-share-contact-footer/chat-share-contact-footer.component';
import { ContactSharePayload } from '@nx-platform-application/message-content';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'messenger-chat-contact-detail-wrapper',
  standalone: true,
  imports: [
    CommonModule,
    ContactDetailComponent,
    ChatShareContactFooterComponent,
    MatIconModule
  ],
  templateUrl: './chat-contact-detail-wrapper.component.html',
  styleUrl: './chat-contact-detail-wrapper.component.scss',
})
export class ChatContactDetailWrapperComponent {
  // Input binding from Router
  contactId = input.required<URN>();

  private chatService = inject(ChatService);
  private contactsService = inject(ContactsStorageService);
  private logger = inject(Logger);

  // Access the signal for the UI warning
  isKeyMissing = this.chatService.isRecipientKeyMissing;

  async onShare(recipientUrn: URN): Promise<void> {
    const sharedContactUrn = this.contactId();
    
    // 1. Fetch details of the contact we are sharing
    // (We need the alias and avatar to populate the snapshot)
    const contact = await this.contactsService.getContact(sharedContactUrn);
    
    if (!contact) {
      this.logger.error('Cannot share contact: Contact not found');
      return;
    }

    this.logger.info(`Sharing contact ${contact.alias} with ${recipientUrn}`);

    // 2. Construct Payload (JSON Schema)
    const payload: ContactSharePayload = {
      urn: contact.id.toString(),
      alias: contact.alias,
      // Optional: grab avatar from 'messenger' service profile if exists
      avatarUrl: contact.serviceContacts['messenger']?.profilePictureUrl,
      text: 'Shared via Messenger'
    };

    // 3. Send Rich Message
    await this.chatService.sendContactShare(recipientUrn, payload);
  }
}