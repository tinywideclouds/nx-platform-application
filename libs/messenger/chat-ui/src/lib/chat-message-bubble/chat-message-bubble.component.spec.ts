// libs/messenger/chat-ui/src/lib/chat-message-bubble/chat-message-bubble.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatMessageBubbleComponent } from './chat-message-bubble.component';
import { By } from '@angular/platform-browser';

describe('ChatMessageBubbleComponent', () => {
  let fixture: ComponentFixture<ChatMessageBubbleComponent>;
  let component: ChatMessageBubbleComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatMessageBubbleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatMessageBubbleComponent);
    component = fixture.componentInstance;
  });

  it('should render an outbound message', () => {
    component.message = 'Hello world';
    component.direction = 'outbound';
    fixture.detectChanges();

    const bubble = fixture.debugElement.query(
      By.css('[data-testid="chat-bubble"]')
    ).nativeElement as HTMLElement;

    expect(bubble.textContent).toContain('Hello world');
    expect(bubble.classList).toContain('bg-blue-600');
    expect(bubble.classList).not.toContain('bg-gray-200');
  });

  it('should render an inbound message', () => {
    component.message = 'Hi back';
    component.direction = 'inbound';
    fixture.detectChanges();

    const bubble = fixture.debugElement.query(
      By.css('[data-testid="chat-bubble"]')
    ).nativeElement as HTMLElement;

    expect(bubble.textContent).toContain('Hi back');
    expect(bubble.classList).toContain('bg-gray-200');
    expect(bubble.classList).not.toContain('bg-blue-600');
  });
});