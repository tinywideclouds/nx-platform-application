import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageRequestReviewComponent } from './message-request-review.component';
import { URN } from '@nx-platform-application/platform-types';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';

// ✅ FIX: Simple URNs
const urn1 = URN.parse('urn:contacts:user:stranger1');
const urn2 = URN.parse('urn:contacts:user:stranger2');

describe('MessageRequestReviewComponent', () => {
  let component: MessageRequestReviewComponent;
  let fixture: ComponentFixture<MessageRequestReviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageRequestReviewComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageRequestReviewComponent);
    component = fixture.componentInstance;

    // Initialize required input
    fixture.componentRef.setInput('requests', []);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Interactions', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('requests', [urn1]);
      fixture.detectChanges();
    });

    it('should emit accept event', () => {
      let emitted: URN | undefined;
      component.accept.subscribe((urn) => (emitted = urn));

      // Open Panel
      const panelHeader = fixture.debugElement.query(
        By.css('mat-expansion-panel-header'),
      );
      panelHeader.nativeElement.click();
      fixture.detectChanges();

      const btn = fixture.debugElement.query(By.css('button[color="primary"]'));
      btn.nativeElement.click();

      expect(emitted?.toString()).toBe(urn1.toString());
    });

    it('should emit block event', () => {
      let emitted: { urn: URN; scope: string } | undefined;
      component.block.subscribe((e) => (emitted = e));

      const panelHeader = fixture.debugElement.query(
        By.css('mat-expansion-panel-header'),
      );
      panelHeader.nativeElement.click();
      fixture.detectChanges();

      const btn = fixture.debugElement.queryAll(
        By.css('button[color="warn"]'),
      )[1];
      btn.nativeElement.click();

      expect(emitted?.scope).toBe('messenger');
      expect(emitted?.urn.toString()).toBe(urn1.toString());
    });

    it('should emit dismiss event', () => {
      let emitted: URN | undefined;
      component.dismiss.subscribe((urn) => (emitted = urn));

      const panelHeader = fixture.debugElement.query(
        By.css('mat-expansion-panel-header'),
      );
      panelHeader.nativeElement.click();
      fixture.detectChanges();

      const btns = fixture.debugElement.queryAll(By.css('button'));
      const dismissBtn = btns.find((b) =>
        b.nativeElement.textContent.includes('Dismiss'),
      );
      dismissBtn?.nativeElement.click();

      expect(emitted?.toString()).toBe(urn1.toString());
    });
  });

  describe('Empty State', () => {
    it('should show empty state message when requests are empty', () => {
      fixture.componentRef.setInput('requests', []);
      fixture.detectChanges();

      const emptyMsg = fixture.debugElement.query(By.css('.text-gray-400'));
      expect(emptyMsg).toBeTruthy();
      expect(emptyMsg.nativeElement.textContent).toContain(
        'No pending requests',
      );
    });
  });
});
