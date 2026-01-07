import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatMessageBubbleComponent } from './chat-message-bubble.component';
import { By } from '@angular/platform-browser';
import { Component } from '@angular/core';

@Component({
  standalone: true,
  imports: [ChatMessageBubbleComponent],
  template: `
    <chat-message-bubble
      [direction]="direction"
      [timestamp]="timestamp"
      [isBroadcast]="isBroadcast"
      [statusTooltip]="tooltip"
    >
      <div data-testid="projected-content">Hello World</div>
    </chat-message-bubble>
  `,
})
class TestHostComponent {
  direction: 'inbound' | 'outbound' = 'outbound';
  timestamp = '2024-01-01T12:00:00Z';
  isBroadcast = false;
  tooltip = '';
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
  });

  it('should SHOW broadcast icon when isBroadcast is true', async () => {
    hostComponent.isBroadcast = true;
    fixture.detectChanges();
    await fixture.whenStable();

    const icon = fixture.debugElement.query(
      By.css('[data-testid="broadcast-icon"]'),
    );
    expect(icon).toBeTruthy();
    expect(icon.nativeElement.textContent).toContain('campaign');
  });

  it('should bind tooltip text to the status area', async () => {
    // Note: Angular Material Tooltip uses aria-label or internal descriptors
    // Testing specific MatTooltip internals is brittle, but we can verify the input binding works.
    hostComponent.tooltip = 'Read by 3/5';
    fixture.detectChanges();
    await fixture.whenStable();

    // We check that the component instance received the signal update
    const bubble = fixture.debugElement.query(
      By.directive(ChatMessageBubbleComponent),
    );
    expect(bubble.componentInstance.statusTooltip()).toBe('Read by 3/5');
  });
});
