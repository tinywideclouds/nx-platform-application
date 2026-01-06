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
    >
      <div data-testid="projected-content">Hello World</div>
    </chat-message-bubble>
  `,
})
class TestHostComponent {
  direction: 'inbound' | 'outbound' = 'outbound';
  // ✅ FIX: Use a valid ISO string that DatePipe can parse
  timestamp = '2024-01-01T12:00:00Z';
  isBroadcast = false;
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
    // Don't detectChanges yet, let tests drive inputs
  });

  // --- Existing Tests ---

  it('should project content correctly', () => {
    fixture.detectChanges();
    const projected = fixture.debugElement.query(
      By.css('[data-testid="projected-content"]'),
    );
    expect(projected).toBeTruthy();
    expect(projected.nativeElement.textContent).toContain('Hello World');
  });

  it('should apply outbound styles', () => {
    hostComponent.direction = 'outbound';
    fixture.detectChanges();

    const bubble = fixture.debugElement.query(
      By.css('[data-testid="chat-bubble"]'),
    );
    expect(bubble.nativeElement.classList).toContain('bg-blue-600');
  });

  it('should apply inbound styles', () => {
    hostComponent.direction = 'inbound';
    fixture.detectChanges();

    const bubble = fixture.debugElement.query(
      By.css('[data-testid="chat-bubble"]'),
    );
    expect(bubble.nativeElement.classList).toContain('bg-white');
  });

  // --- New Tests (Additive) ---

  it('should NOT show broadcast icon by default', () => {
    fixture.detectChanges();
    const icon = fixture.debugElement.query(
      By.css('[data-testid="broadcast-icon"]'),
    );
    expect(icon).toBeNull();
  });

  it('should SHOW broadcast icon when isBroadcast is true', async () => {
    hostComponent.isBroadcast = true;
    fixture.detectChanges();
    await fixture.whenStable(); // Wait for signal update

    const icon = fixture.debugElement.query(
      By.css('[data-testid="broadcast-icon"]'),
    );
    expect(icon).toBeTruthy();
    expect(icon.nativeElement.textContent).toContain('campaign');
  });
});
