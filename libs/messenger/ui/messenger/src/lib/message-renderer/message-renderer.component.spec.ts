import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageRendererComponent } from './message-renderer.component';
import {
  ChatImageMessageComponent,
  ChatSystemMessageComponent,
  ChatTextRendererComponent,
  ChatInviteMessageComponent,
  DisplayMessage,
} from '@nx-platform-application/messenger-ui-chat';
import { MessageContentPipe } from '../message-content.pipe';
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
const mockMessage: ChatMessage = {
  id: 'msg-1',
  conversationUrn: URN.parse('urn:group:1'),
  senderId: URN.parse('urn:user:alice'),
  sentTimestamp: '2024-01-01T12:00:00Z' as ISODateTimeString,
  typeId: URN.parse('urn:message:type:text'),
  payloadBytes: new Uint8Array([]), // Dummy
  status: 'read',
};

describe('MessageRendererComponent', () => {
  let component: MessageRendererComponent;
  let fixture: ComponentFixture<MessageRendererComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageRendererComponent],
      providers: [provideZonelessChangeDetection()],
    })
      .overrideComponent(MessageRendererComponent, {
        remove: {
          imports: [
            ChatImageMessageComponent,
            ChatSystemMessageComponent,
            ChatTextRendererComponent,
            ChatInviteMessageComponent,
            MessageContentPipe,
            ContactNamePipe,
          ],
        },
        add: {
          imports: [
            MockComponent(ChatImageMessageComponent),
            MockComponent(ChatSystemMessageComponent),
            MockComponent(ChatTextRendererComponent),
            MockComponent(ChatInviteMessageComponent),
            // We mock the pipe to control the "DisplayMessage" output
            MockPipe(MessageContentPipe, (msg) => {
              // Simple mapping based on ID to simulate different types
              if (msg.id === 'msg-text')
                return {
                  kind: 'text',
                  id: 'msg-text',
                  parts: [{ type: 'text', content: 'Hello' }],
                } as DisplayMessage;
              if (msg.id === 'msg-image')
                return {
                  kind: 'image',
                  id: 'msg-image',
                  parts: [],
                  image: {
                    src: 'img.jpg',
                    width: 100,
                    height: 100,
                    assets: [],
                  },
                } as DisplayMessage;
              if (msg.id === 'msg-system')
                return {
                  kind: 'system',
                  id: 'msg-system',
                  parts: [],
                } as DisplayMessage;
              if (msg.id === 'msg-action')
                return {
                  kind: 'action',
                  id: 'msg-action',
                  parts: [],
                  action: {
                    type: 'group-invite',
                    actionMap: { groupName: 'Party', groupUrn: 'urn:g:1' },
                  },
                } as DisplayMessage;
              return null;
            }),
            MockPipe(ContactNamePipe, (val) => `Mapped: ${val}`),
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MessageRendererComponent);
    component = fixture.componentInstance;
  });

  describe('Rendering Logic', () => {
    it('should render TEXT component when pipe returns text', () => {
      const textMsg = { ...mockMessage, id: 'msg-text' };
      fixture.componentRef.setInput('message', textMsg);
      fixture.detectChanges();

      const textRenderer = fixture.debugElement.query(
        By.directive(ChatTextRendererComponent),
      );
      expect(textRenderer).toBeTruthy();
      expect(textRenderer.componentInstance.parts).toEqual([
        { type: 'text', content: 'Hello' },
      ]);
    });

    it('should render IMAGE component when pipe returns image', () => {
      const imgMsg = { ...mockMessage, id: 'msg-image' };
      fixture.componentRef.setInput('message', imgMsg);
      fixture.detectChanges();

      const imgRenderer = fixture.debugElement.query(
        By.directive(ChatImageMessageComponent),
      );
      expect(imgRenderer).toBeTruthy();
      // Check that the *DisplayMessage* was passed through
      expect(imgRenderer.componentInstance.message().id).toBe('msg-image');
    });

    it('should render SYSTEM component when pipe returns system', () => {
      const sysMsg = { ...mockMessage, id: 'msg-system' };
      fixture.componentRef.setInput('message', sysMsg);
      fixture.detectChanges();

      const sysRenderer = fixture.debugElement.query(
        By.directive(ChatSystemMessageComponent),
      );
      expect(sysRenderer).toBeTruthy();
    });

    it('should render INVITE component when pipe returns action', () => {
      const actionMsg = { ...mockMessage, id: 'msg-action' };
      fixture.componentRef.setInput('message', actionMsg);
      fixture.detectChanges();

      const inviteRenderer = fixture.debugElement.query(
        By.directive(ChatInviteMessageComponent),
      );
      expect(inviteRenderer).toBeTruthy();
      expect(inviteRenderer.componentInstance.payload).toEqual({
        groupName: 'Party',
        groupUrn: 'urn:g:1',
      });
    });
  });

  describe('Interactions', () => {
    it('should intercept <a> clicks and emit action if URN scheme is used', () => {
      // 1. Render text
      const textMsg = { ...mockMessage, id: 'msg-text' };
      fixture.componentRef.setInput('message', textMsg);
      fixture.detectChanges();

      // 2. Mock an Event with a URN Link
      let emittedAction: string | undefined;
      component.action.subscribe((val) => (emittedAction = val));

      const mockEvent = new MouseEvent('click', { bubbles: true });
      const mockLink = document.createElement('a');
      mockLink.setAttribute('href', 'urn:contacts:user:bob');
      // Simulate the structure: <div><a>...</a></div>
      const wrapper = document.createElement('div');
      wrapper.appendChild(mockLink);

      // Manually trigger the handler since we can't easily click inside the Mock Child
      component.onLinkClick({
        target: mockLink,
        preventDefault: vi.fn(),
      } as any);

      expect(emittedAction).toBe('urn:contacts:user:bob');
    });

    it('should ignore regular HTTP links', () => {
      let emittedAction: string | undefined;
      component.action.subscribe((val) => (emittedAction = val));

      const mockLink = document.createElement('a');
      mockLink.setAttribute('href', 'https://google.com');

      component.onLinkClick({
        target: mockLink,
        preventDefault: vi.fn(),
      } as any);

      expect(emittedAction).toBeUndefined();
    });
  });
});
