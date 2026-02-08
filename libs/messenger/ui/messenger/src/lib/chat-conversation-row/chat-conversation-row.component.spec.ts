import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatConversationRowComponent } from './chat-conversation-row.component';
import { ChatMessageBubbleComponent } from '@nx-platform-application/messenger-ui-chat';
import { MessageRendererComponent } from '../message-renderer/message-renderer.component';
import { ContactNamePipe } from '@nx-platform-application/contacts-ui';
import { ChatMessage } from '@nx-platform-application/messenger-types';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { MockComponent, MockPipe } from 'ng-mocks';
import { By } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';

// --- Test Data ---
const mockUrn = URN.parse('urn:messenger:message:123');
const mockSender = URN.parse('urn:contacts:user:alice');
const mockSystemType = URN.parse('urn:messenger:message-type:system-notice');
const mockTextType = URN.parse('urn:messenger:message-type:text');

const mockMessage: ChatMessage = {
  id: 'msg-1',
  conversationUrn: URN.parse('urn:messenger:group:1'),
  senderId: mockSender,
  sentTimestamp: '2026-01-01T12:00:00Z' as ISODateTimeString,
  typeId: mockTextType,
  status: 'delivered',
  payloadBytes: new Uint8Array([]), // Dummy
};

describe('ChatConversationRowComponent', () => {
  let component: ChatConversationRowComponent;
  let fixture: ComponentFixture<ChatConversationRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatConversationRowComponent],
      providers: [provideZonelessChangeDetection()],
    })
      .overrideComponent(ChatConversationRowComponent, {
        remove: {
          imports: [
            ChatMessageBubbleComponent,
            MessageRendererComponent,
            ContactNamePipe,
          ],
        },
        add: {
          imports: [
            MockComponent(ChatMessageBubbleComponent),
            MockComponent(MessageRendererComponent),
            MockPipe(ContactNamePipe, (val) => `Mapped: ${val}`),
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ChatConversationRowComponent);
    component = fixture.componentInstance;
  });

  describe('Layout Logic', () => {
    it('should align RIGHT for my messages', () => {
      fixture.componentRef.setInput('message', mockMessage);
      fixture.componentRef.setInput('isMine', true);
      fixture.detectChanges();

      const container = fixture.debugElement.query(
        By.css('.flex.w-full'),
      ).nativeElement;
      expect(container.classList).toContain('justify-end');
    });

    it('should align LEFT for their messages', () => {
      fixture.componentRef.setInput('message', mockMessage);
      fixture.componentRef.setInput('isMine', false);
      fixture.detectChanges();

      const container = fixture.debugElement.query(
        By.css('.flex.w-full'),
      ).nativeElement;
      expect(container.classList).toContain('justify-start');
    });

    it('should align CENTER for system messages', () => {
      const systemMsg = { ...mockMessage, typeId: mockSystemType };
      fixture.componentRef.setInput('message', systemMsg);
      fixture.componentRef.setInput('isMine', false); // Even if not mine
      fixture.detectChanges();

      const container = fixture.debugElement.query(
        By.css('.flex.w-full'),
      ).nativeElement;
      expect(container.classList).toContain('justify-center');
    });
  });

  describe('Bubble Interaction (Child Props)', () => {
    it('should pass correct direction to bubble', () => {
      fixture.componentRef.setInput('message', mockMessage);
      fixture.componentRef.setInput('isMine', true);
      fixture.detectChanges();

      const bubble = fixture.debugElement.query(
        By.directive(ChatMessageBubbleComponent),
      ).componentInstance;
      expect(bubble.direction).toBe('outbound');
    });

    it('should force "inbound" direction for system messages', () => {
      const systemMsg = { ...mockMessage, typeId: mockSystemType };
      fixture.componentRef.setInput('message', systemMsg);
      fixture.componentRef.setInput('isMine', true); // Technically system messages aren't "mine", but testing logic
      fixture.detectChanges();

      const bubble = fixture.debugElement.query(
        By.directive(ChatMessageBubbleComponent),
      ).componentInstance;
      expect(bubble.direction).toBe('inbound');
    });
  });

  describe('Read Cursors', () => {
    it('should render read cursors when present', () => {
      const readers = [
        URN.parse('urn:contacts:user:bob'),
        URN.parse('urn:contacts:user:charlie'),
      ];

      fixture.componentRef.setInput('message', mockMessage);
      fixture.componentRef.setInput('isMine', true);
      fixture.componentRef.setInput('readCursors', readers);
      fixture.detectChanges();

      const cursors = fixture.debugElement.queryAll(By.css('.cursor-avatar'));
      expect(cursors.length).toBe(2);
      // Check tooltip via Pipe Mock
      expect(cursors[0].nativeElement.getAttribute('ng-reflect-message')).toBe(
        'Mapped: urn:contacts:user:bob',
      );
    });

    it('should position cursors on the correct side', () => {
      fixture.componentRef.setInput('message', mockMessage);
      fixture.componentRef.setInput('isMine', true); // Right aligned
      fixture.componentRef.setInput('readCursors', [mockSender]);
      fixture.detectChanges();

      const container = fixture.debugElement.query(By.css('.cursor-container'));
      expect(container.classes['right-full']).toBe(true);
      expect(container.classes['mr-2']).toBe(true);
    });
  });

  describe('Output Propagation', () => {
    it('should re-emit actions from the renderer', () => {
      let emittedAction: string | undefined;
      component.action.subscribe((val) => (emittedAction = val));

      fixture.componentRef.setInput('message', mockMessage);
      fixture.componentRef.setInput('isMine', true);
      fixture.detectChanges();

      // Trigger Child Output
      const renderer = fixture.debugElement.query(
        By.directive(MessageRendererComponent),
      );
      renderer.triggerEventHandler('action', 'open-profile');

      expect(emittedAction).toBe('open-profile');
    });
  });
});
