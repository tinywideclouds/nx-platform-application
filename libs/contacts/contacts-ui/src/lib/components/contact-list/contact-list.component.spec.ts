// libs/contacts/contacts-ui/src/lib/contact-list/contact-list.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { Contact } from '@nx-platform-application/contacts-access';
// --- 1. Import URN and ISODateTimeString ---
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

import { ContactListComponent } from './contact-list.component';
import { ContactListItemComponent } from '../contact-list-item/contact-list-item.component';

// --- 2. Update Mock Contacts to use URNs ---
const MOCK_CONTACTS: Contact[] = [
  {
    id: URN.parse('urn:sm:user:user-123'),
    alias: 'johndoe',
    email: 'john@example.com',
    firstName: 'John',
    surname: 'Doe',
    phoneNumbers: ['+15550199'],
    emailAddresses: ['john@example.com'],
    serviceContacts: {
      messenger: {
        id: URN.parse('urn:sm:service:msg-uuid-1'),
        alias: 'jd_messenger',
        lastSeen: '2023-01-01T12:00:00Z' as ISODateTimeString,
      },
    },
  },
  {
    id: URN.parse('urn:sm:user:user-456'),
    alias: 'janedoe',
    email: 'jane@example.com',
    firstName: 'Jane',
    surname: 'Doe',
    phoneNumbers: ['+15550188'],
    emailAddresses: ['jane@example.com'],
    serviceContacts: {
      messenger: {
        id: URN.parse('urn:sm:service:msg-uuid-2'),
        alias: 'jane_messenger',
        lastSeen: '2023-01-01T12:00:00Z' as ISODateTimeString,
      },
    },
  },
];
// Note: We're omitting properties like isFavorite for mock simplicity
// in a way that is compatible with the Contact (User) interface.

// --- Mock Host Component (for testing inputs/outputs) ---
@Component({
  standalone: true,
  imports: [ContactListComponent],
  template: `
    <contacts-list
      [contacts]="contacts"
      (contactSelected)="onSelected($event)"
    />
  `,
})
class TestHostComponent {
  contacts = MOCK_CONTACTS; // <-- This now uses the URN-based mock
  selectedContact?: Contact;
  onSelected(contact: Contact) {
    this.selectedContact = contact;
  }
}

describe('ContactListComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Import all components used in the test chain
      imports: [
        TestHostComponent,
        ContactListComponent,
        ContactListItemComponent,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;

    // DO NOT call fixture.detectChanges() here
  });

  it('should render the correct number of list items', () => {
    // 1. Set component state
    hostComponent.contacts = MOCK_CONTACTS;

    // 2. Run change detection
    fixture.detectChanges();

    // 3. Assert
    const items = fixture.debugElement.queryAll(By.css('contacts-list-item'));
    expect(items.length).toBe(MOCK_CONTACTS.length);
  });

  it('should emit contactSelected when a child item emits (select)', () => {
    // 1. Set component state
    hostComponent.contacts = MOCK_CONTACTS;

    // 2. Run change detection
    fixture.detectChanges();

    // 3. Find the child element
    const firstItemEl = fixture.debugElement.query(
      By.css('contacts-list-item')
    );

    // 4. Trigger the child's output event
    firstItemEl.triggerEventHandler('select', MOCK_CONTACTS[0]);
    fixture.detectChanges();

    // 5. Assert that the host's handler was called
    expect(hostComponent.selectedContact).toBe(MOCK_CONTACTS[0]);
  });

  it('should display an empty message when no contacts are provided', () => {
    // 1. Set component state
    hostComponent.contacts = [];

    // 2. Run change detection
    fixture.detectChanges();

    // 3. Assert
    const items = fixture.debugElement.queryAll(By.css('contacts-list-item'));
    const emptyMessage = fixture.debugElement.query(
      By.css('[data-testid="empty-list"]')
    );

    expect(items.length).toBe(0);
    expect(emptyMessage).toBeTruthy();
    expect(emptyMessage.nativeElement.textContent).toContain(
      'No contacts found'
    );
  });
});
