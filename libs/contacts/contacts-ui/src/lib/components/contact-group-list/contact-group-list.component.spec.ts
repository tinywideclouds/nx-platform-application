// libs/contacts/contacts-ui/src/lib/components/contact-group-list/contact-group-list.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ContactGroup } from '@nx-platform-application/contacts-data-access';
// --- 1. Import URN ---
import { URN } from '@nx-platform-application/platform-types';
import { vi } from 'vitest';

import { ContactGroupListComponent } from './contact-group-list.component';
import { ContactGroupListItemComponent } from '../contact-group-list-item/contact-group-list-item.component';

// --- 2. Update Mock Groups to use URNs ---
const MOCK_GROUPS: ContactGroup[] = [
  {
    id: URN.parse('urn:sm:group:grp-123'),
    name: 'Family',
    contactIds: [
      URN.parse('urn:sm:user:user-1'),
      URN.parse('urn:sm:user:user-2'),
    ],
  },
  {
    id: URN.parse('urn:sm:group:grp-456'),
    name: 'Work',
    contactIds: [URN.parse('urn:sm:user:user-3')],
  },
];

// --- Mock Host Component (for testing inputs/outputs) ---
@Component({
  standalone: true,
  imports: [ContactGroupListComponent], // Host imports the component it tests
  template: `
    <contacts-group-list
      [groups]="groups"
      (groupSelected)="onSelected($event)"
    />
  `,
})
class TestHostComponent {
  groups: ContactGroup[] = [];
  selectedGroup?: ContactGroup;
  onSelected(group: ContactGroup) {
    this.selectedGroup = group;
  }
}

describe('ContactGroupListComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Import all components used in the test chain
      imports: [
        TestHostComponent,
        ContactGroupListComponent,
        ContactGroupListItemComponent,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    // We call detectChanges in each test to set the state *before* the render
  });

  it('should render the correct number of list items', () => {
    // 1. Set component state
    hostComponent.groups = MOCK_GROUPS;

    // 2. Run change detection
    fixture.detectChanges();

    // 3. Assert
    const items = fixture.debugElement.queryAll(
      By.css('contacts-group-list-item')
    );
    expect(items.length).toBe(MOCK_GROUPS.length);
  });

  it('should emit groupSelected when a child item emits (select)', () => {
    // 1. Set component state
    hostComponent.groups = MOCK_GROUPS;

    // 2. Run change detection
    fixture.detectChanges();

    // 3. Find the child element
    const firstItemEl = fixture.debugElement.query(
      By.css('contacts-group-list-item')
    );

    // 4. Trigger the child's output event
    firstItemEl.triggerEventHandler('select', MOCK_GROUPS[0]);
    fixture.detectChanges();

    // 5. Assert that the host's handler was called
    expect(hostComponent.selectedGroup).toBe(MOCK_GROUPS[0]);
  });

  it('should display an empty message when no groups are provided', () => {
    // 1. Set component state (default is empty array)
    hostComponent.groups = [];

    // 2. Run change detection
    fixture.detectChanges();

    // 3. Assert
    const items = fixture.debugElement.queryAll(
      By.css('contacts-group-list-item')
    );
    const emptyMessage = fixture.debugElement.query(
      By.css('[data-testid="empty-group-list"]')
    );

    expect(items.length).toBe(0);
    expect(emptyMessage).toBeTruthy();
    expect(emptyMessage.nativeElement.textContent).toContain('No groups found');
  });
});