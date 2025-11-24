import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsPageToolbarComponent } from './contacts-page-toolbar.component';
import { vi } from 'vitest';

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(public callback: (entries: any[]) => void) {}
  
  triggerResize(width: number) {
    this.callback([{ contentRect: { width } }]);
  }
}

describe('ContactsPageToolbarComponent', () => {
  let component: ContactsPageToolbarComponent;
  let fixture: ComponentFixture<ContactsPageToolbarComponent>;
  let mockObserver: MockResizeObserver;

  beforeEach(async () => {
    // 1. Use Fake Timers to control requestAnimationFrame strictly
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] });

    // 2. Mock getComputedStyle
    vi.stubGlobal('getComputedStyle', () => ({ fontSize: '16px' }));
    
    // 3. Mock ResizeObserver
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    await TestBed.configureTestingModule({
      imports: [ContactsPageToolbarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsPageToolbarComponent);
    component = fixture.componentInstance;
    mockObserver = (component as any).resizeObserver;

    // 4. Initial Detect Changes
    // Safe now because RAF is paused by fake timers. 
    // This establishes the "Initial State" (width 0, mode undefined) cleanly.
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should switch to FULL mode when width > breakpoint', () => {
    // 1. Trigger Resize
    // This queues the RAF callback, but does NOT execute it yet.
    mockObserver.triggerResize(1024);
    
    // 2. Flush Timers
    // This executes the RAF callback, updating the signal to 1024.
    // The view is effectively "dirty" now, but stable.
    vi.runAllTimers(); 
    
    // 3. Detect Changes
    // Angular processes the dirty signal and updates the view from Empty -> Full.
    fixture.detectChanges(); 
    
    expect(component.mode()).toBe('full');
  });

  it('should switch to COMPACT mode when width < breakpoint', () => {
    mockObserver.triggerResize(300);
    vi.runAllTimers();
    fixture.detectChanges();
    
    expect(component.mode()).toBe('compact');
  });
});