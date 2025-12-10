// libs/messenger/chat-ui/src/lib/chat-message-bubble/chat-message-bubble.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatMessageBubbleComponent } from './chat-message-bubble.component';
import { By } from '@angular/platform-browser';
import { Component } from '@angular/core';

@Component({
  standalone: true,
  imports: [ChatMessageBubbleComponent],
  template: `
    <chat-message-bubble [direction]="direction">
      <div data-testid="projected-content">Hello World</div>
    </chat-message-bubble>
  `,
})
class TestHostComponent {
  direction: 'inbound' | 'outbound' = 'outbound';
}

describe('ChatMessageBubbleComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, ChatMessageBubbleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    // FIX: Do NOT call fixture.detectChanges() here.
    // Let each test set the inputs first.
  });

  it('should project content correctly', () => {
    // Initial render
    fixture.detectChanges();

    const projected = fixture.debugElement.query(
      By.css('[data-testid="projected-content"]')
    );
    expect(projected).toBeTruthy();
    expect(projected.nativeElement.textContent).toContain('Hello World');
  });

  it('should apply outbound styles', () => {
    hostComponent.direction = 'outbound';
    fixture.detectChanges(); // First render with outbound

    const bubble = fixture.debugElement.query(
      By.css('[data-testid="chat-bubble"]')
    );
    expect(bubble.nativeElement.classList).toContain('bg-blue-600');
  });

  it('should apply inbound styles', () => {
    hostComponent.direction = 'inbound';
    fixture.detectChanges(); // First render with inbound

    const bubble = fixture.debugElement.query(
      By.css('[data-testid="chat-bubble"]')
    );
    expect(bubble.nativeElement.classList).toContain('bg-white');
  });
});
