import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatContactDetailWrapperComponent } from './chat-detail-wrapper.component';
import { ChatService } from '@nx-platform-application/messenger-state-app';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Contact } from '@nx-platform-application/contacts-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { of } from 'rxjs';

import { MockComponent, MockProvider } from 'ng-mocks';
// Real imports to remove via override
import { ContactDetailComponent } from '@nx-platform-application/contacts-ui';
import { ChatShareContactFooterComponent } from '../chat-share-contact-footer/chat-share-contact-footer.component';

const contactId = URN.parse('urn:contacts:user:shared-contact');
const recipientId = URN.parse('urn:contacts:user:recipient');

const mockContact: Contact = {
  id: contactId,
  alias: 'Alice',
  email: 'alice@test.com',
  firstName: 'Alice',
  surname: 'Test',
  lastModified: '' as ISODateTimeString,
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: {
    messenger: { profilePictureUrl: 'http://img.com/alice.png' } as any,
  },
};

describe('ChatContactDetailWrapperComponent', () => {
  let component: ChatContactDetailWrapperComponent;
  let fixture: ComponentFixture<ChatContactDetailWrapperComponent>;
  let chatService: ChatService;
  let contactsService: ContactsStorageService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChatContactDetailWrapperComponent,
        // NOTE: We do NOT import MockComponents here because we use overrideComponent below
      ],
      providers: [
        MockProvider(ChatService, {
          sendContactShare: vi.fn().mockResolvedValue(undefined),
          isRecipientKeyMissing: signal(false),
        }),
        MockProvider(ContactsStorageService, {
          // Fix 1: Return a Promise so 'onShare' (which calls this) doesn't crash
          getContact: vi.fn().mockResolvedValue(mockContact),
          getLinkedIdentities: vi.fn().mockResolvedValue([]),
          contacts$: of([]),
        }),
        MockProvider(Logger),
      ],
    })
      // Fix 2: Explicitly override the standalone component imports
      .overrideComponent(ChatContactDetailWrapperComponent, {
        remove: {
          imports: [ContactDetailComponent, ChatShareContactFooterComponent],
        },
        add: {
          imports: [
            MockComponent(ContactDetailComponent),
            MockComponent(ChatShareContactFooterComponent),
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ChatContactDetailWrapperComponent);
    component = fixture.componentInstance;
    chatService = TestBed.inject(ChatService);
    contactsService = TestBed.inject(ContactsStorageService);

    fixture.componentRef.setInput('contactId', contactId);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch contact and call sendContactShare on share action', async () => {
    await component.onShare(recipientId);

    expect(contactsService.getContact).toHaveBeenCalledWith(contactId);

    expect(chatService.sendContactShare).toHaveBeenCalledWith(
      recipientId,
      expect.objectContaining({
        urn: 'urn:lookup:email:alice@test.com',
        alias: 'Alice',
        text: 'Shared via Messenger',
      }),
    );
  });
});
