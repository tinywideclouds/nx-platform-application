import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactListItemComponent } from './contact-list-item.component';
import { Contact } from '@nx-platform-application/contacts-storage';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { By } from '@angular/platform-browser';
import { Component } from '@angular/core';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';

// --- Mock Data ---
const MOCK_CONTACT: Contact = {
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
      profilePictureUrl: 'http://messenger.com/img.png',
    },
  },
};

// --- Test Host ---
@Component({
  standalone: true,
  imports: [ContactListItemComponent],
  template: `
    <contacts-list-item [contact]="contact" (select)="onSelected($event)" />
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
  // --- Test 1: Isolated Component Test (Rendering) ---
  it('should display the contact alias and avatar', async () => {
    await TestBed.configureTestingModule({
      imports: [ContactListItemComponent, ContactAvatarComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(ContactListItemComponent);
    const component = fixture.componentInstance;

    // FIX: Use setInput for Signal Inputs
    fixture.componentRef.setInput('contact', MOCK_CONTACT);

    // Trigger change detection to update computed signals and template
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;

    // Check Avatar presence
    const avatar = el.querySelector('contacts-avatar');
    expect(avatar).toBeTruthy();

    // Check Alias text
    const alias = el.querySelector('[data-testid="alias"]');
    expect(alias?.textContent).toContain('johndoe');

    // Check Logic: Call computed signals directly
    expect(component.initials()).toBe('JD');
    expect(component.profilePictureUrl()).toBe('http://messenger.com/img.png');
  });

  // --- Test 2: Integration Test (Events) ---
  it('should emit the contact when clicked', async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    const hostComponent = fixture.componentInstance;

    // Initial render
    fixture.detectChanges();

    const listItem = fixture.debugElement.query(By.css('contacts-list-item'));

    // Simulate User Click
    listItem.triggerEventHandler('click', null);

    // Check Output
    expect(hostComponent.selectedContact).toBe(MOCK_CONTACT);
  });
});
