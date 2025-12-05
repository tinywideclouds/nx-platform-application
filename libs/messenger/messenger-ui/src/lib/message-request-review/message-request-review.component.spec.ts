import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageRequestReviewComponent } from './message-request-review.component';
import { PendingIdentity } from '@nx-platform-application/contacts-storage';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';

// Mock Data
const req1: PendingIdentity = {
  urn: URN.parse('urn:user:stranger1'),
  firstSeenAt: '2023-01-01T10:00:00Z' as ISODateTimeString,
};
const req2: PendingIdentity = {
  urn: URN.parse('urn:user:stranger2'),
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

  describe('Selection Logic', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('requests', [req1, req2]);
      fixture.detectChanges();
    });

    it('should toggle selection of a single item', () => {
      // Act: Toggle first item
      component.toggleOne(req1.urn, true);
      fixture.detectChanges();

      // Assert
      expect(component.selectedUrns().has(req1.urn.toString())).toBe(true);
      expect(component.selectedUrns().has(req2.urn.toString())).toBe(false);

      // Computed states
      expect(component.allSelected()).toBe(false);
      expect(component.indeterminate()).toBe(true);
    });

    it('should toggle all items', () => {
      // Act: Toggle All
      component.toggleAll(true);
      fixture.detectChanges();

      // Assert
      expect(component.selectedUrns().size).toBe(2);
      expect(component.allSelected()).toBe(true);
      expect(component.indeterminate()).toBe(false);

      // Act: Toggle Off
      component.toggleAll(false);
      fixture.detectChanges();
      expect(component.selectedUrns().size).toBe(0);
    });
  });

  describe('Actions', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('requests', [req1]);
      fixture.detectChanges();
      component.toggleAll(true); // Select the item
    });

    it('should emit accept event with selected URNs', () => {
      let emitted: URN[] | undefined;
      component.accept.subscribe((urns) => (emitted = urns));

      component.onAcceptSelected();

      expect(emitted).toHaveLength(1);
      expect(emitted![0].toString()).toBe(req1.urn.toString());
      // Should clear selection after action
      expect(component.selectedUrns().size).toBe(0);
    });

    it('should emit block event with scope', () => {
      let emitted: { urns: URN[]; scope: string } | undefined;
      component.block.subscribe((e) => (emitted = e));

      component.onBlockSelected('messenger');

      expect(emitted?.scope).toBe('messenger');
      expect(emitted?.urns[0].toString()).toBe(req1.urn.toString());
    });

    it('should emit dismiss event', () => {
      let emitted: URN[] | undefined;
      component.dismiss.subscribe((urns) => (emitted = urns));

      component.onDismissSelected();

      expect(emitted).toHaveLength(1);
    });
  });

  describe('Empty State', () => {
    it('should show empty state message when requests are empty', () => {
      fixture.componentRef.setInput('requests', []);
      fixture.detectChanges();

      const emptyMsg = fixture.debugElement.query(By.css('.text-gray-400'));
      expect(emptyMsg).toBeTruthy();
      expect(emptyMsg.nativeElement.textContent).toContain(
        'No pending message requests'
      );
    });
  });
});
