import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ListFilterComponent } from './list-filter.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';

describe('ListFilterComponent', () => {
  let component: ListFilterComponent;
  let fixture: ComponentFixture<ListFilterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListFilterComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ListFilterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be closed by default', () => {
    expect(component.isOpen()).toBe(false);
    const input = fixture.debugElement.query(By.css('input'));
    expect(input).toBeNull();
  });

  it('should reveal input when toggled open and focus it', () => {
    // 1. Setup Vitest fake timers to catch the setTimeout
    vi.useFakeTimers();

    // 2. Click toggle button
    const toggleBtn = fixture.debugElement.query(
      By.css('button[mat-icon-button]')
    );
    toggleBtn.nativeElement.click();
    fixture.detectChanges();

    // 3. Verify state matches (isOpen = true)
    expect(component.isOpen()).toBe(true);

    // 4. Fast-forward time to trigger the setTimeout callback
    vi.advanceTimersByTime(0);

    const input = fixture.debugElement.query(By.css('input'));
    expect(input).toBeTruthy();

    // 5. check focus
    expect(document.activeElement).toBe(input.nativeElement);

    // 6. Cleanup
    vi.useRealTimers();
  });

  it('should update the query model when typing', () => {
    // Manually set state to open
    component.isOpen.set(true);
    fixture.detectChanges();

    const input = fixture.debugElement.query(By.css('input'));

    // Simulate user typing
    input.nativeElement.value = 'test';
    input.nativeElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.query()).toBe('test');
  });

  it('should clear query when toggled closed', () => {
    // Setup state: Open with text
    component.isOpen.set(true);
    component.query.set('searching...');
    fixture.detectChanges();

    // Click toggle button to close (it's the main button on the right)
    const buttons = fixture.debugElement.queryAll(
      By.css('button[mat-icon-button]')
    );
    const mainToggle = buttons[buttons.length - 1];

    mainToggle.nativeElement.click();
    fixture.detectChanges();

    expect(component.isOpen()).toBe(false);
    expect(component.query()).toBe('');
  });
});
