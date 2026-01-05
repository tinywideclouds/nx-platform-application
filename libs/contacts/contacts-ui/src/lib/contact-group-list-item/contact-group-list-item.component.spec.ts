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
    />
  `,
})
class TestHostComponent {
  group = MOCK_GROUP;
  resolver: GroupBadgeResolver | undefined = undefined;

  @ViewChild(ContactGroupListItemComponent)
  child!: ContactGroupListItemComponent;

  onSelected(group: ContactGroup) {}
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
    // Don't call detectChanges here yet, let individual tests drive the initial data
  });

  describe('Rendering', () => {
    it('should render the group name', () => {
      fixture.detectChanges(); // First render
      const el = fixture.debugElement.query(
        By.css('contacts-group-list-item'),
      ).nativeElement;
      expect(el.textContent).toContain('Family');
    });

    it('should render badges when resolver returns them', async () => {
      const mockResolver: GroupBadgeResolver = () => [
        { icon: 'hub', tooltip: 'Network', color: 'primary' },
      ];

      // ✅ FIX: Set input BEFORE first detectChanges to prevent NG0100
      hostComponent.resolver = mockResolver;
      fixture.detectChanges();
      await fixture.whenStable();

      const badgesEl = fixture.debugElement.query(
        By.css('[data-testid="group-badges"]'),
      );
      expect(badgesEl).toBeTruthy();
      expect(badgesEl.nativeElement.textContent).toContain('hub');
    });

    it('should NOT render badges section if resolver returns empty', async () => {
      const mockResolver: GroupBadgeResolver = () => [];

      // ✅ FIX: Set input BEFORE first detectChanges
      hostComponent.resolver = mockResolver;
      fixture.detectChanges();
      await fixture.whenStable();

      const badgesEl = fixture.debugElement.query(
        By.css('[data-testid="group-badges"]'),
      );
      expect(badgesEl).toBeFalsy();
    });
  });

  describe('Events', () => {
    it('should emit (select) with the group when clicked', () => {
      fixture.detectChanges(); // Standard init
      const selectSpy = vi.spyOn(hostComponent, 'onSelected');
      const componentEl = fixture.debugElement.query(
        By.css('contacts-group-list-item'),
      );

      componentEl.triggerEventHandler('click');
      fixture.detectChanges();

      expect(selectSpy).toHaveBeenCalledWith(MOCK_GROUP);
    });
  });
});
