// libs/contacts/contacts-ui/src/lib/components/contact-group-list-item/contact-group-list-item.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component } from '@angular/core';
import { ContactGroup } from '@nx-platform-application/contacts-data-access';
import { vi } from 'vitest';

import { ContactGroupListItemComponent } from './contact-group-list-item.component';

// --- Mock Fixture ---
const MOCK_GROUP: ContactGroup = {
  id: 'grp-123',
  name: 'Family',
  contactIds: ['user-1', 'user-2'],
};

// ---
// NEW: Describe block for standalone rendering tests
// This follows the simpler, more reliable pattern from contact-avatar.component.spec.ts
// ---
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
    // 1. Set input
    component.group = MOCK_GROUP;
    // 2. Run change detection
    fixture.detectChanges();

    // 3. Assert
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
    // 1. Set input with new data
    component.group = {
      ...MOCK_GROUP,
      contactIds: ['user-1'],
    };
    // 2. Run change detection
    fixture.detectChanges();

    // 3. Assert
    const countEl = el.querySelector('.text-sm.text-gray-500');
    expect(countEl).toBeTruthy();
    expect(countEl?.textContent?.trim()).toBe('1 member');
  });

  it('should render the correct member count (zero)', () => {
    // 1. Set input with new data
    component.group = {
      ...MOCK_GROUP,
      contactIds: [],
    };
    // 2. Run change detection
    fixture.detectChanges();

    // 3. Assert
    const countEl = el.querySelector('.text-sm.text-gray-500');
    expect(countEl).toBeTruthy();
    expect(countEl?.textContent?.trim()).toBe('0 members');
  });
});

// ---
// EXISTING: Describe block for event/host tests
// This test was already passing and is correct.
// ---
describe('ContactGroupListItemComponent (Events)', () => {
  // --- Mock Host Component (for testing inputs/outputs) ---
  @Component({
    standalone: true,
    imports: [ContactGroupListItemComponent],
    template: `
      <lib-contact-group-list-item
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
    // Arrange
    const selectSpy = vi.spyOn(hostComponent, 'onSelected');
    const componentEl = fixture.debugElement.query(
      By.css('lib-contact-group-list-item')
    );

    // Act: Click the component
    componentEl.triggerEventHandler('click');
    fixture.detectChanges();

    // Assert
    expect(selectSpy).toHaveBeenCalledWith(MOCK_GROUP);
    expect(hostComponent.selectedGroup).toBe(MOCK_GROUP);
  });
});