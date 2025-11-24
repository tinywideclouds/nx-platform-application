// libs/messenger/chat-ui/src/lib/chat-conversation-list-item/chat-conversation-list-item.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';

import { ContactAvatarComponent } from '@nx-platform-application/contacts-ui';
import { ChatConversationListItemComponent } from './chat-conversation-list-item.component';

describe('ChatConversationListItemComponent', () => {
  let fixture: ComponentFixture<ChatConversationListItemComponent>;
  let component: ChatConversationListItemComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatConversationListItemComponent, ContactAvatarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatConversationListItemComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  it('should render all inputs correctly', () => {
    // 1. Set Inputs via Signal API
    fixture.componentRef.setInput('name', 'Test User');
    fixture.componentRef.setInput('latestMessage', 'Hello there');
    fixture.componentRef.setInput('unreadCount', 2);
    fixture.componentRef.setInput('initials', 'TU');
    fixture.componentRef.setInput('timestamp', '2025-01-01T12:00:00Z');
    
    // 2. Detect Changes
    fixture.detectChanges();

    // 3. Assert
    const nameEl = el.querySelector('[data-testid="contact-name"]');
    const msgEl = el.querySelector('[data-testid="last-message"]');
    const countEl = el.querySelector('[data-testid="unread-count"]');

    expect(nameEl?.textContent).toContain('Test User');
    expect(msgEl?.textContent).toContain('Hello there');
    expect(countEl?.textContent?.trim()).toBe('2');
  });

  it('should hide the unread count when 0', () => {
    // Set required inputs to avoid errors, then set unreadCount to 0
    fixture.componentRef.setInput('name', 'Test User');
    fixture.componentRef.setInput('latestMessage', 'Hello there');
    fixture.componentRef.setInput('timestamp', '2025-01-01T12:00:00Z');
    fixture.componentRef.setInput('initials', 'TU');
    fixture.componentRef.setInput('unreadCount', 0);
    
    fixture.detectChanges();
    
    const countEl = el.querySelector('[data-testid="unread-count"]');
    expect(countEl).toBeFalsy();
  });
  
  it('should apply active styles when isActive is true', () => {
    // Set required inputs
    fixture.componentRef.setInput('name', 'Test User');
    fixture.componentRef.setInput('latestMessage', 'Hello there');
    fixture.componentRef.setInput('timestamp', '2025-01-01T12:00:00Z');
    fixture.componentRef.setInput('initials', 'TU');
    
    // Set Active
    fixture.componentRef.setInput('isActive', true);
    fixture.detectChanges();
    
    const div = fixture.debugElement.query(By.css('div')).nativeElement;
    expect(div.classList).toContain('bg-blue-100');
  });

  it('should emit (select) on click', () => {
    // Spy on the output signal
    const selectSpy = vi.spyOn(component.select, 'emit');
    
    // Set required inputs
    fixture.componentRef.setInput('name', 'Test');
    fixture.componentRef.setInput('latestMessage', 'Msg');
    fixture.componentRef.setInput('timestamp', 'Date');
    fixture.componentRef.setInput('initials', 'T');
    fixture.detectChanges();
    
    el.click(); // Click the host element
    fixture.detectChanges();
    
    expect(selectSpy).toHaveBeenCalled();
  });
});