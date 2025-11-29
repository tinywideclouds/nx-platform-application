// libs/shared/ui/src/lib/auto-scroll.directive.spec.ts
import { Component, signal, ViewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AutoScrollDirective } from './auto-scroll.directive';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';

// --- Test Host ---
@Component({
  standalone: true,
  imports: [AutoScrollDirective],
  template: `
    <div
      style="height: 50px; overflow-y: scroll;"
      [appAutoScroll]="messages()"
      (alertVisibility)="onAlert($event)"
    >
      @for (msg of messages(); track msg) {
      <div style="height: 20px;">{{ msg }}</div>
      }
    </div>
  `,
})
class TestHostComponent {
  messages = signal<string[]>([]);
  alertVisible = false;

  @ViewChild(AutoScrollDirective) directive!: AutoScrollDirective;

  onAlert(isVisible: boolean) {
    this.alertVisible = isVisible;
  }
}

describe('AutoScrollDirective (Zoneless)', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  let scrollContainer: HTMLElement;

  beforeEach(async () => {
    // 1. Enable Fake Timers to control the 1000ms scroll lock
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    scrollContainer = fixture.debugElement.query(
      By.directive(AutoScrollDirective)
    ).nativeElement;

    // 2. Mock scrollTo to prevent JSDOM crash
    scrollContainer.scrollTo = vi.fn();

    // 3. Mock Layout Properties
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      value: 100,
      writable: true,
    });
    Object.defineProperty(scrollContainer, 'clientHeight', {
      value: 50,
      writable: true,
    });
    Object.defineProperty(scrollContainer, 'scrollTop', {
      value: 50,
      writable: true,
    });

    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    // 4. Restore real timers to avoid leaking into other tests
    vi.useRealTimers();
  });

  it('should scroll to bottom on initial load', () => {
    // Arrange
    const items = ['A', 'B', 'C', 'D', 'E'];
    const scrollSpy = vi.spyOn(host.directive, 'scrollToBottom');

    // Act
    host.messages.set(items);
    fixture.detectChanges();

    // Fast-forward time to trigger requestAnimationFrame logic (approx 2 frames)
    vi.advanceTimersByTime(50);

    // Assert
    expect(scrollSpy).toHaveBeenCalledWith('auto');
  });

  it('should trigger scroll when new items are added', () => {
    // Arrange: Initial load
    host.messages.set(['A', 'B', 'C']);
    fixture.detectChanges();
    vi.advanceTimersByTime(50);

    // Clear the spy history
    const scrollSpy = vi.spyOn(host.directive, 'scrollToBottom');
    scrollSpy.mockClear();

    // Act: Add item
    host.messages.update((m) => [...m, 'New Item']);
    fixture.detectChanges();
    vi.advanceTimersByTime(50);

    // Assert
    expect(scrollSpy).toHaveBeenCalledWith('smooth');
    expect(host.alertVisible).toBe(false);
  });

  it('should emit alertVisibility=true if user is scrolled up and forcescroll is false', () => {
    // Arrange: Setup initial state
    host.messages.set(['A', 'B', 'C', 'D', 'E']);
    fixture.detectChanges();
    vi.advanceTimersByTime(50); // Finish RAFs

    // *** CRITICAL FIX ***
    // The directive locks auto-scrolling for 1000ms. We must fast-forward
    // past this lock so the directive knows the USER is now in control.
    vi.advanceTimersByTime(1000);

    // Mock "Scrolled Up" State (High height, low scrollTop)
    Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000 });
    Object.defineProperty(scrollContainer, 'scrollTop', { value: 0 }); // Top

    // Act: Add item while scrolled up
    host.messages.update((m) => [...m, 'F']);
    fixture.detectChanges();
    vi.advanceTimersByTime(50); // Finish RAFs

    // Assert
    expect(host.alertVisible).toBe(true);
  });
});
