import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component, ViewChild } from '@angular/core';
import { ContactGroup } from '@nx-platform-application/contacts-types';
import { vi } from 'vitest';
import { URN } from '@nx-platform-application/platform-types';

import { ContactGroupListItemComponent } from './contact-group-list-item.component';
import { GroupBadgeResolver } from './../models/group-badge.model';

const MOCK_GROUP: ContactGroup = {
  id: URN.parse('urn:contacts:group:grp-123'),
  name: 'Family',
  description: 'My Family',
  scope: 'local',
  members: [
    { contactId: URN.parse('urn:contacts:user:1'), status: 'joined' },
    { contactId: URN.parse('urn:contacts:user:2'), status: 'joined' },
  ],
};

@Component({
  standalone: true,
  imports: [ContactGroupListItemComponent],
  template: `
    <contacts-group-list-item
      [group]="group"
      [badgeResolver]="resolver"
      (select)="onSelected($event)"
      (delete)="onDeleted($event)"
    />
  `,
})
class TestHostComponent {
  group = MOCK_GROUP;
  resolver: GroupBadgeResolver | undefined = undefined;

  @ViewChild(ContactGroupListItemComponent)
  child!: ContactGroupListItemComponent;

  onSelected(group: ContactGroup) {}
  onDeleted(group: ContactGroup) {}
}

describe('ContactGroupListItemComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
  });

  describe('Rendering', () => {
    it('should render the group name', () => {
      fixture.detectChanges();
      const el = fixture.debugElement.query(
        By.css('contacts-group-list-item'),
      ).nativeElement;
      expect(el.textContent).toContain('Family');
    });

    it('should render badges when resolver returns them', async () => {
      const mockResolver: GroupBadgeResolver = () => [
        { icon: 'hub', tooltip: 'Network', color: 'primary' },
      ];
      hostComponent.resolver = mockResolver;
      fixture.detectChanges();
      await fixture.whenStable();

      const badgesEl = fixture.debugElement.query(
        By.css('[data-testid="group-badges"]'),
      );
      expect(badgesEl).toBeTruthy();
    });
  });

  describe('Interactions', () => {
    it('should emit (select) when content is clicked', () => {
      fixture.detectChanges();
      const selectSpy = vi.spyOn(hostComponent, 'onSelected');

      // Click the inner content wrapper, not the host
      const contentEl = fixture.debugElement.query(By.css('.content-wrapper'));
      contentEl.triggerEventHandler('click');

      expect(selectSpy).toHaveBeenCalledWith(MOCK_GROUP);
    });

    it('should hard reset (scrollLeft=0) when reset(false) is called', async () => {
      fixture.detectChanges();
      const component = hostComponent.child;
      const container = fixture.nativeElement.querySelector('.swipe-container');

      // Simulate dirty state
      container.scrollLeft = 100;

      await component.reset(false);

      expect(container.scrollLeft).toBe(0);
    });

    it('should emit (delete) when delete button is clicked', () => {
      fixture.detectChanges();
      const deleteSpy = vi.spyOn(hostComponent, 'onDeleted');

      // Find the delete button in the action wrapper
      const btn = fixture.debugElement.query(By.css('.action-wrapper button'));
      btn.triggerEventHandler('click', new Event('click'));

      expect(deleteSpy).toHaveBeenCalledWith(MOCK_GROUP);
    });
  });
});
