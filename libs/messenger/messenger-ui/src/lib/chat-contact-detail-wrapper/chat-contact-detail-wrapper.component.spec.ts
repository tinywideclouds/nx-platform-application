// libs/messenger/messenger-ui/src/lib/chat-contact-detail-wrapper/chat-contact-detail-wrapper.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatContactDetailWrapperComponent } from './chat-contact-detail-wrapper.component';
import { ChatService } from '@nx-platform-application/chat-state';
import { ContactsStorageService, Contact } from '@nx-platform-application/contacts-data-access';
import { Logger } from '@nx-platform-application/console-logger';
import { URN } from '@nx-platform-application/platform-types';
import { vi } from 'vitest';
import { signal } from '@angular/core';

// Child Mocks
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'contacts-detail',
  standalone: true,
  template: ''
})
class MockDetail {
  @Input() contactId: any;
}

@Component({
  selector: 'messenger-share-contact-footer',
  standalone: true,
  template: ''
})
class MockFooter {
  @Input() contactToShare: any;
  @Output() share = new EventEmitter<any>();
}

// Fixtures
const contactId = URN.parse('urn:sm:user:shared-contact');
const recipientId = URN.parse('urn:sm:user:recipient');

const mockContact: Contact = {
  id: contactId,
  alias: 'Alice',
  email: 'alice@test.com',
  firstName: 'Alice',
  surname: 'Test',
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: {
    messenger: { profilePictureUrl: 'http://img.com/alice.png' } as any
  }
};

// Service Mocks
const mockChatService = {
  sendContactShare: vi.fn().mockResolvedValue(undefined),
  isRecipientKeyMissing: signal(false)
};

const mockContactsService = {
  getContact: vi.fn().mockResolvedValue(mockContact)
};

const mockLogger = { info: vi.fn(), error: vi.fn() };

describe('ChatContactDetailWrapperComponent', () => {
  let component: ChatContactDetailWrapperComponent;
  let fixture: ComponentFixture<ChatContactDetailWrapperComponent>;

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [ChatContactDetailWrapperComponent],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: Logger, useValue: mockLogger }
      ]
    })
    .overrideComponent(ChatContactDetailWrapperComponent, {
      remove: { imports: [ /* Real imports if present */ ] },
      add: { imports: [MockDetail, MockFooter] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatContactDetailWrapperComponent);
    component = fixture.componentInstance;
    
    fixture.componentRef.setInput('contactId', contactId);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch contact and call sendContactShare on share action', async () => {
    await component.onShare(recipientId);

    // 1. Verify Contact Fetch
    expect(mockContactsService.getContact).toHaveBeenCalledWith(contactId);

    // 2. Verify Send Call
    expect(mockChatService.sendContactShare).toHaveBeenCalledWith(
      recipientId,
      expect.objectContaining({
        urn: contactId.toString(),
        alias: 'Alice',
        avatarUrl: 'http://img.com/alice.png',
        text: 'Shared via Messenger'
      })
    );
  });

  it('should log error if contact is not found', async () => {
    mockContactsService.getContact.mockResolvedValueOnce(undefined);

    await component.onShare(recipientId);

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('not found'));
    expect(mockChatService.sendContactShare).not.toHaveBeenCalled();
  });
});