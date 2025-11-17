import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsPageToolbarComponent } from './contacts-page-toolbar.component';
import { ElementRef } from '@angular/core';

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(public callback: (entries: any[]) => void) {}
  
  // Helper to simulate resize
  triggerResize(width: number) {
    this.callback([{ contentRect: { width } }]);
  }
}

describe('ContactsPageToolbarComponent', () => {
  let component: ContactsPageToolbarComponent;
  let fixture: ComponentFixture<ContactsPageToolbarComponent>;
  let mockObserver: MockResizeObserver;

  beforeEach(async () => {
    // !! ADD THIS MOCK !!
    // Mock getComputedStyle to ensure a consistent breakpoint
    // 24rem * 16px = 384px
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      fontSize: '16px',
    } as any); // Use 'as any' to avoid mocking all CSSStyleDeclaration properties

    // Stub the global ResizeObserver before component creation
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    await TestBed.configureTestingModule({
      imports: [ContactsPageToolbarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsPageToolbarComponent);
    component = fixture.componentInstance;

    // Grab the observer instance attached to the component
    mockObserver = (component as any).resizeObserver;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with undefined mode (not measuring 0 as compact)', () => {
    expect(component.mode()).toBeUndefined();
  });

  it('should switch to FULL mode when width > breakpoint', () => {
    // With the mock, breakpoint is 384px. 1024 is > 384.
    mockObserver.triggerResize(1024);
    fixture.detectChanges();
    expect(component.mode()).toBe('full');
  });

  it('should switch to COMPACT mode when width < breakpoint', () => {
    // With the mock, breakpoint is 384px. 300 is < 384.
    mockObserver.triggerResize(300);
    fixture.detectChanges();
    expect(component.mode()).toBe('compact'); // This will now pass
  });
});