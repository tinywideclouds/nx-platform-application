import { Component, inject, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common'; // ✅ Need Common for @if
import { URN } from '@nx-platform-application/platform-types';
import { AppState } from '@nx-platform-application/messenger-state-app';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';

// UI Imports
import { ContactDetailComponent } from '@nx-platform-application/contacts-ui';
import { ChatGroupDetailComponent } from '../chat-group-detail/chat-group-detail.component';
import { ChatShareContactFooterComponent } from '../chat-share-contact-footer/chat-share-contact-footer.component';
import { ContactShareData } from '@nx-platform-application/messenger-domain-message-content';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'messenger-chat-contact-detail-wrapper',
  standalone: true,
  imports: [
    CommonModule,
    ContactDetailComponent,
    ChatGroupDetailComponent,
    ChatShareContactFooterComponent,
    MatIconModule,
  ],
  templateUrl: './chat-detail-wrapper.component.html',
  styleUrl: './chat-detail-wrapper.component.scss',
})
export class ChatContactDetailWrapperComponent {
  contactId = input.required<URN>();

  private appState = inject(AppState);
  private contactsService = inject(ContactsStorageService);
  private logger = inject(Logger);

  isKeyMissing = this.appState.isRecipientKeyMissing;

  // ✅ Polymorphic Check
  isGroup = computed(() => this.contactId().entityType === 'group');

  async onShare(recipientUrn: URN): Promise<void> {
    const sharedContactUrn = this.contactId();

    // Prevent sharing Groups for now
    if (this.isGroup()) return;

    const contact = await this.contactsService.getContact(sharedContactUrn);
    if (!contact) return;

    let shareUrnString = '';

    if (contact.email) {
      const lookupUrn = URN.create('email', contact.email, 'lookup');
      shareUrnString = lookupUrn.toString();
    } else {
      const identities =
        await this.contactsService.getLinkedIdentities(sharedContactUrn);
      if (identities.length > 0) {
        shareUrnString = identities[0].toString();
      }
    }

    if (!shareUrnString) {
      this.logger.warn(
        'Cannot share contact: No email or linked identity found.',
      );
      return;
    }

    this.logger.info(
      `Sharing ${shareUrnString} (Alias: ${contact.alias}) with ${recipientUrn}`,
    );

    const payload: ContactShareData = {
      urn: shareUrnString,
      alias: contact.alias,
      avatarUrl: contact.serviceContacts['messenger']?.profilePictureUrl,
      text: 'Shared via Messenger',
    };

    await this.appState.sendContactShare(recipientUrn, payload);
  }
}
