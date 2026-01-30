import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { URN } from '@nx-platform-application/platform-types';
import { ChatConversationListItemComponent } from './chat-conversation-list-item.component';
import { ContactAvatarComponent } from '@nx-platform-application/contacts-ui';
import { MockComponent } from 'ng-mocks';

describe('ChatConversationListItemComponent', () => {
  let fixture: ComponentFixture<ChatConversationListItemComponent>;
  let component: ChatConversationListItemComponent;
  let el: HTMLElement;

  const mockItem = {
    id: URN.parse('urn:contacts:user:123'),
    name: 'Test User',
    snippet: 'Hello there',
    timestamp: '2025-01-01T12:00:00Z',
    initials: 'TU',
    unreadCount: 2,
    isActive: false,
    pictureUrl: undefined,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ChatConversationListItemComponent,
        MockComponent(ContactAvatarComponent),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatConversationListItemComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  it('should render item details correctly', () => {
    // Single Input Set
    fixture.componentRef.setInput('item', mockItem);
    fixture.detectChanges();

    const nameEl = el.querySelector('[data-testid="contact-name"]');
    const msgEl = el.querySelector('[data-testid="snippet"]');

    expect(nameEl?.textContent).toContain('Test User');
    expect(msgEl?.textContent).toContain('Hello there');
  });
});
