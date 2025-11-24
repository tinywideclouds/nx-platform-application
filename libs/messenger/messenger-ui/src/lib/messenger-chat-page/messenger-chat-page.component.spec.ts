import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessengerChatPageComponent } from './messenger-chat-page.component';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ChatService } from '@nx-platform-application/chat-state';
import { ContactsStorageService } from '@nx-platform-application/contacts-access';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';

// Mocks
const mockChatService = {
  activeConversations: signal([]),
  selectedConversation: signal(null)
};

const mockContactsService = {
  contacts$: of([])
};

describe('MessengerChatPageComponent', () => {
  let component: MessengerChatPageComponent;
  let fixture: ComponentFixture<MessengerChatPageComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessengerChatPageComponent, RouterTestingModule, NoopAnimationsModule],
      providers: [
        { provide: ChatService, useValue: mockChatService },
        { provide: ContactsStorageService, useValue: mockContactsService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MessengerChatPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    
    vi.spyOn(router, 'navigate');
    
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should navigate to absolute path on conversation select', () => {
    const urn = URN.parse('urn:sm:user:bob');
    component.onConversationSelected(urn);
    
    expect(router.navigate).toHaveBeenCalledWith(
      ['/messenger', 'conversations', urn.toString()]
    );
  });
});