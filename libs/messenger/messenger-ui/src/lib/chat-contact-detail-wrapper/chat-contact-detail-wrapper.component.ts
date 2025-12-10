// libs/messenger/messenger-ui/src/lib/chat-contact-detail-wrapper/chat-contact-detail-wrapper.component.ts

import { Component, inject, input } from '@angular/core';

import { URN } from '@nx-platform-application/platform-types';
import { ChatService } from '@nx-platform-application/chat-state';
import { Logger } from '@nx-platform-application/console-logger';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';

// UI Imports
import { ContactDetailComponent } from '@nx-platform-application/contacts-ui';
import { ChatShareContactFooterComponent } from '../chat-share-contact-footer/chat-share-contact-footer.component';
import { ContactShareData } from '@nx-platform-application/message-content';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'messenger-chat-contact-detail-wrapper',
  standalone: true,
  imports: [
    ContactDetailComponent,
    ChatShareContactFooterComponent,
    MatIconModule,
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

    const contact = await this.contactsService.getContact(sharedContactUrn);
    if (!contact) return;

    // CHANGED STRATEGY: Share the Email Lookup URN
    // This is the most robust "Public Address" for a user.
    // We don't need to find a linked identity anymore; we construct the address
    // that the target user *should* have keys for (if they onboarded correctly).

    let shareUrnString = '';

    if (contact.email) {
      // Construct: urn:lookup:email:bob@gmail.com
      const lookupUrn = URN.create('email', contact.email, 'lookup');
      shareUrnString = lookupUrn.toString();
    } else {
      // Fallback: Try to find a linked Identity URN if no email
      const identities = await this.contactsService.getLinkedIdentities(
        sharedContactUrn
      );
      if (identities.length > 0) {
        shareUrnString = identities[0].toString();
      }
    }

    if (!shareUrnString) {
      this.logger.warn(
        'Cannot share contact: No email or linked identity found.'
      );
      return;
    }

    this.logger.info(
      `Sharing ${shareUrnString} (Alias: ${contact.alias}) with ${recipientUrn}`
    );

    const payload: ContactShareData = {
      urn: shareUrnString,
      alias: contact.alias,
      avatarUrl: contact.serviceContacts['messenger']?.profilePictureUrl,
      text: 'Shared via Messenger',
    };

    await this.chatService.sendContactShare(recipientUrn, payload);
  }
}
