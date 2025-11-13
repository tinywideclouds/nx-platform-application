// libs/contacts/contacts-ui/src/lib/contact-list-item/contact-list-item.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactListItemComponent } from './contact-list-item.component';
import { Contact } from '@nx-platform-application/contacts-data-access';
import { ISODateTimeString } from '@nx-platform-application/platform-types';
import { By } from '@angular/platform-browser';
import { Component } from '@angular/core';

// Import the avatar component, as it's a dependency
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';

// --- Mock Contact ---
const MOCK_CONTACT: Contact = {
  id: 'user-123',
  alias: 'johndoe',
  email: 'john@example.com',
  firstName: 'John',
  surname: 'Doe',
  phoneNumbers: ['+15550199'],
  emailAddresses: ['john@example.com'],
  isFavorite: false,
  // We must provide the serviceContacts for the new getter to test
  serviceContacts: {
    messenger: {
      id: 'msg-uuid-1',
      alias: 'jd_messenger',
      lastSeen: '2023-01-01T12:00:00Z' as ISODateTimeString,
      profilePictureUrl: 'http://messenger.com/img.png',
    },
  },
};

// --- Mock Host Component (for testing click event) ---
@Component({
  standalone: true,
  // The host must also import the components
  imports: [ContactListItemComponent, ContactAvatarComponent],
  template: `
    <lib-contact-list-item
      [contact]="contact"
      (select)="onSelected($event)"
    />
  `,
})
class TestHostComponent {
  contact = MOCK_CONTACT;
  selectedContact?: Contact;
  onSelected(contact: Contact) {
    this.selectedContact = contact;
  }
}

describe('ContactListItemComponent', () => {
  it('should display the contact alias and avatar', async () => {
    // --- Simple Test (no host) for content checking ---
    await TestBed.configureTestingModule({
      // Import both components for this test
      imports: [ContactListItemComponent, ContactAvatarComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(ContactListItemComponent);
    const component = fixture.componentInstance;
    component.contact = MOCK_CONTACT;
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    // Check that the avatar is rendered
    const avatar = el.querySelector('lib-contact-avatar');
    expect(avatar).toBeTruthy();

    // Check that the alias is rendered
    const alias = el.querySelector('[data-testid="alias"]');
    expect(alias?.textContent).toContain('johndoe');

    // We can also test the component's internal logic
    expect(component.initials).toBe('JD');
    expect(component.profilePictureUrl).toBe('http://messenger.com/img.png');
  });

  it('should emit the contact when clicked', async () => {
    // --- Host Test for event checking ---
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    const hostComponent = fixture.componentInstance;
    fixture.detectChanges();

    const listItem = fixture.debugElement.query(
      By.css('lib-contact-list-item')
    );

    // Simulate the click (this test was already correct)
    listItem.triggerEventHandler('click', null);

    // Check if the host component received the event
    expect(hostComponent.selectedContact).toBe(MOCK_CONTACT);
  });
});