import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageRequestReviewComponent } from './message-request-review.component';
import { PendingIdentity } from '@nx-platform-application/contacts-storage';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';

// Mock Data - Fixed URN format (4 parts)
const req1: PendingIdentity = {
  urn: URN.parse('urn:contacts:user:stranger1'),
  firstSeenAt: '2023-01-01T10:00:00Z' as ISODateTimeString,
};
const req2: PendingIdentity = {
  urn: URN.parse('urn:contacts:user:stranger2'),
  firstSeenAt: '2023-01-01T11:00:00Z' as ISODateTimeString,
};

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
      fixture.componentRef.setInput('requests', [req1]);
      fixture.detectChanges();
    });

    it('should emit accept event', () => {
      let emitted: URN | undefined;
      component.accept.subscribe((urn) => (emitted = urn));

      // Open Panel
      const panelHeader = fixture.debugElement.query(
        By.css('mat-expansion-panel-header')
      );
      panelHeader.nativeElement.click();
      fixture.detectChanges();

      const btn = fixture.debugElement.query(By.css('button[color="primary"]')); // Accept is primary
      btn.nativeElement.click();

      expect(emitted?.toString()).toBe(req1.urn.toString());
    });

    it('should emit block event', () => {
      let emitted: { urn: URN; scope: string } | undefined;
      component.block.subscribe((e) => (emitted = e));

      const panelHeader = fixture.debugElement.query(
        By.css('mat-expansion-panel-header')
      );
      panelHeader.nativeElement.click();
      fixture.detectChanges();

      // Block is warn stroked button (2nd warn button, 1st is header blockAll)
      const btn = fixture.debugElement.queryAll(
        By.css('button[color="warn"]')
      )[1];
      btn.nativeElement.click();

      expect(emitted?.scope).toBe('messenger');
      expect(emitted?.urn.toString()).toBe(req1.urn.toString());
    });

    it('should emit dismiss event', () => {
      let emitted: URN | undefined;
      component.dismiss.subscribe((urn) => (emitted = urn));

      const panelHeader = fixture.debugElement.query(
        By.css('mat-expansion-panel-header')
      );
      panelHeader.nativeElement.click();
      fixture.detectChanges();

      // Find Dismiss button by text content
      const btns = fixture.debugElement.queryAll(By.css('button'));
      const dismissBtn = btns.find((b) =>
        b.nativeElement.textContent.includes('Dismiss')
      );
      dismissBtn?.nativeElement.click();

      expect(emitted?.toString()).toBe(req1.urn.toString());
    });
  });

  describe('Empty State', () => {
    it('should show empty state message when requests are empty', () => {
      fixture.componentRef.setInput('requests', []);
      fixture.detectChanges();

      const emptyMsg = fixture.debugElement.query(By.css('.text-gray-400'));
      expect(emptyMsg).toBeTruthy();
      expect(emptyMsg.nativeElement.textContent).toContain(
        'No pending requests'
      );
    });
  });
});
