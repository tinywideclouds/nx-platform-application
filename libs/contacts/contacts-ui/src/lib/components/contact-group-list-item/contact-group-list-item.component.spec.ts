// libs/contacts/contacts-ui/src/lib/components/contact-group-list-item/contact-group-list-item.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component } from '@angular/core';
import { ContactGroup } from '@nx-platform-application/contacts-data-access';
import { vi } from 'vitest';
// --- 1. Import URN ---
import { URN } from '@nx-platform-application/platform-types';

import { ContactGroupListItemComponent } from './contact-group-list-item.component';

// --- 2. Update Mock Fixture to use URNs ---
const MOCK_GROUP: ContactGroup = {
  id: URN.parse('urn:sm:group:grp-123'),
  name: 'Family',
  contactIds: [
    URN.parse('urn:sm:user:user-1'),
    URN.parse('urn:sm:user:user-2'),
  ],
};
// --- END CHANGES ---

describe('ContactGroupListItemComponent (Rendering)', () => {
  let fixture: ComponentFixture<ContactGroupListItemComponent>;
  let component: ContactGroupListItemComponent;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactGroupListItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactGroupListItemComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
  });

  it('should render the group name', () => {
    component.group = MOCK_GROUP;
    fixture.detectChanges();

    const nameEl = el.querySelector('[data-testid="group-name"]');
    expect(nameEl).toBeTruthy();
    expect(nameEl?.textContent).toContain('Family');
  });

  it('should render the correct member count (plural)', () => {
    component.group = MOCK_GROUP;
    fixture.detectChanges();

    const countEl = el.querySelector('.text-sm.text-gray-500');
    expect(countEl).toBeTruthy();
    expect(countEl?.textContent?.trim()).toBe('2 members');
  });

  it('should render the correct member count (singular)', () => {
    component.group = {
      ...MOCK_GROUP,
      // --- 3. Use URN in this mock too ---
      contactIds: [URN.parse('urn:sm:user:user-1')],
    };
    fixture.detectChanges();

    const countEl = el.querySelector('.text-sm.text-gray-500');
    expect(countEl).toBeTruthy();
    expect(countEl?.textContent?.trim()).toBe('1 member');
  });

  it('should render the correct member count (zero)', () => {
    component.group = {
      ...MOCK_GROUP,
      contactIds: [],
    };
    fixture.detectChanges();

    const countEl = el.querySelector('.text-sm.text-gray-500');
    expect(countEl).toBeTruthy();
    expect(countEl?.textContent?.trim()).toBe('0 members');
  });
});

describe('ContactGroupListItemComponent (Events)', () => {
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
    group = MOCK_GROUP; // <-- This now uses the URN-based mock
    selectedGroup?: ContactGroup;
    onSelected(group: ContactGroup) {
      this.selectedGroup = group;
    }
  }

  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should emit (select) with the group when clicked', () => {
    const selectSpy = vi.spyOn(hostComponent, 'onSelected');
    const componentEl = fixture.debugElement.query(
      By.css('contacts-group-list-item')
    );
    componentEl.triggerEventHandler('click');
    fixture.detectChanges();
    expect(selectSpy).toHaveBeenCalledWith(MOCK_GROUP);
    expect(hostComponent.selectedGroup).toBe(MOCK_GROUP);
  });
});