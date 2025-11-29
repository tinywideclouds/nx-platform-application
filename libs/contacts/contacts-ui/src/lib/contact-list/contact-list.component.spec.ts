// libs/contacts/contacts-ui/src/lib/components/contact-list/contact-list.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { Contact } from '@nx-platform-application/contacts-storage';
import { URN } from '@nx-platform-application/platform-types';

import { ContactListComponent } from './contact-list.component';
import { ContactListItemComponent } from '../contact-list-item/contact-list-item.component';

const MOCK_CONTACTS: Contact[] = [
  {
    id: URN.parse('urn:contacts:user:user-123'),
    alias: 'johndoe',
    email: 'john@example.com',
    firstName: 'John',
    surname: 'Doe',
    phoneNumbers: [],
    emailAddresses: [],
    serviceContacts: {},
  },
  {
    id: URN.parse('urn:contacts:user:user-456'),
    alias: 'janedoe',
    email: 'jane@example.com',
    firstName: 'Jane',
    surname: 'Doe',
    phoneNumbers: [],
    emailAddresses: [],
    serviceContacts: {},
  },
];

@Component({
  standalone: true,
  imports: [ContactListComponent],
  template: `
    <contacts-list
      [contacts]="contacts"
      [selectedId]="selectedId"
      (contactSelected)="onSelected($event)"
    />
  `,
})
class TestHostComponent {
  contacts = MOCK_CONTACTS;
  selectedId: string | undefined = undefined;
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
      imports: [
        TestHostComponent,
        ContactListComponent,
        ContactListItemComponent,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
  });

  it('should render correct number of items', () => {
    fixture.detectChanges();
    const items = fixture.debugElement.queryAll(By.css('contacts-list-item'));
    expect(items.length).toBe(2);
  });

  it('should highlight the selected contact based on input', () => {
    // Select the first contact
    hostComponent.selectedId = 'urn:contacts:user:user-123';
    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(By.css('contacts-list-item'));

    // Check classes on the first item
    expect(items[0].nativeElement.classList).toContain('bg-blue-50');
    expect(items[0].nativeElement.classList).toContain('border-l-4');

    // Check classes on the second item (should NOT have them)
    expect(items[1].nativeElement.classList).not.toContain('bg-blue-50');
  });
});
