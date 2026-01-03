import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component } from '@angular/core';
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

describe('ContactGroupListItemComponent', () => {
  let fixture: ComponentFixture<ContactGroupListItemComponent>;
  let component: ContactGroupListItemComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactGroupListItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactGroupListItemComponent);
    component = fixture.componentInstance;
  });

  describe('Rendering', () => {
    it('should render the group name', () => {
      fixture.componentRef.setInput('group', MOCK_GROUP);
      fixture.detectChanges();
      const el = fixture.nativeElement;
      expect(el.textContent).toContain('Family');
    });

    it('should render badges when resolver returns them', () => {
      const mockResolver: GroupBadgeResolver = () => [
        { icon: 'hub', tooltip: 'Network', color: 'primary' },
      ];

      fixture.componentRef.setInput('group', MOCK_GROUP);
      fixture.componentRef.setInput('badgeResolver', mockResolver);
      fixture.detectChanges();

      const badgesEl = fixture.debugElement.query(
        By.css('[data-testid="group-badges"]'),
      );
      expect(badgesEl).toBeTruthy();

      const icon = badgesEl.query(By.css('mat-icon'));
      expect(icon.nativeElement.textContent).toContain('hub');
    });

    it('should NOT render badges section if resolver returns empty', () => {
      const mockResolver: GroupBadgeResolver = () => [];

      fixture.componentRef.setInput('group', MOCK_GROUP);
      fixture.componentRef.setInput('badgeResolver', mockResolver);
      fixture.detectChanges();

      const badgesEl = fixture.debugElement.query(
        By.css('[data-testid="group-badges"]'),
      );
      expect(badgesEl).toBeFalsy();
    });
  });

  describe('Events', () => {
    @Component({
      standalone: true,
      imports: [ContactGroupListItemComponent],
      template: `
        <contacts-group-list-item
          [group]="group"
          (select)="onSelected($event)"
        />
      `,
    })
    class TestHostComponent {
      group = MOCK_GROUP;
      selectedGroup?: ContactGroup;
      onSelected(group: ContactGroup) {
        this.selectedGroup = group;
      }
    }

    let hostFixture: ComponentFixture<TestHostComponent>;
    let hostComponent: TestHostComponent;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TestHostComponent],
      }).compileComponents();

      hostFixture = TestBed.createComponent(TestHostComponent);
      hostComponent = hostFixture.componentInstance;
      hostFixture.detectChanges();
    });

    it('should emit (select) with the group when clicked', () => {
      const selectSpy = vi.spyOn(hostComponent, 'onSelected');
      const componentEl = hostFixture.debugElement.query(
        By.css('contacts-group-list-item'),
      );
      componentEl.triggerEventHandler('click');
      hostFixture.detectChanges();
      expect(selectSpy).toHaveBeenCalledWith(MOCK_GROUP);
    });
  });
});
