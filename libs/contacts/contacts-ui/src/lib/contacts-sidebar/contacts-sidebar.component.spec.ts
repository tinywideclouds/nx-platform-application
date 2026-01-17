import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsSidebarComponent } from './contacts-sidebar.component';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { signal } from '@angular/core';
import { MockComponent, MockProvider, ngMocks } from 'ng-mocks';
import { provideRouter } from '@angular/router';
import { URN } from '@nx-platform-application/platform-types';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ContactListComponent } from '../contact-list/contact-list.component';
import { ContactGroupListComponent } from '../contact-group-list/contact-group-list.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

// --- MOCK DATA ---
const MOCK_CONTACT = {
  id: URN.parse('urn:contacts:user:1'),
  alias: 'Alice',
  firstName: 'Alice',
  surname: 'Wonder',
  email: 'alice@test.com',
  serviceContacts: {},
} as Contact;

describe('ContactsSidebarComponent', () => {
  let fixture: ComponentFixture<ContactsSidebarComponent>;
  let component: ContactsSidebarComponent;

  // Signals to drive the test
  const contactsSignal = signal<Contact[]>([MOCK_CONTACT]);
  const groupsSignal = signal<ContactGroup[]>([]);

  beforeEach(async () => {
    contactsSignal.set([MOCK_CONTACT]);
    groupsSignal.set([]);

    await TestBed.configureTestingModule({
      imports: [
        ContactsSidebarComponent,
        MockComponent(ContactListComponent),
        MockComponent(ContactGroupListComponent),
        MockComponent(ContactsPageToolbarComponent),
      ],
      providers: [
        provideRouter([]),
        // Mock State
        MockProvider(ContactsStateService, {
          contacts: contactsSignal,
          groups: groupsSignal,
          deleteContact: vitest.fn().mockResolvedValue(undefined),
        }),
        // Mock Dialog (Required for onDeleteContact)
        MockProvider(MatDialog),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsSidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onDeleteContact', () => {
    it('should delete contact when confirmed', async () => {
      // 1. Setup Dialog Mock to return TRUE
      const dialog = TestBed.inject(MatDialog);
      const afterClosedSpy = vitest.fn().mockReturnValue(of(true));
      vitest.spyOn(dialog, 'open').mockReturnValue({
        afterClosed: afterClosedSpy,
      } as any);

      // 2. Spy on State
      const state = TestBed.inject(ContactsStateService);
      const deleteSpy = vitest.spyOn(state, 'deleteContact');

      // 3. Act
      await component.onDeleteContact(MOCK_CONTACT);

      // 4. Assert
      expect(deleteSpy).toHaveBeenCalledWith(MOCK_CONTACT.id);
    });

    it('should reset list items (and NOT delete) when cancelled', async () => {
      // 1. Setup Dialog Mock to return FALSE
      const dialog = TestBed.inject(MatDialog);
      const afterClosedSpy = vitest.fn().mockReturnValue(of(false));
      vitest.spyOn(dialog, 'open').mockReturnValue({
        afterClosed: afterClosedSpy,
      } as any);

      // 2. Spy on State and List Component
      const state = TestBed.inject(ContactsStateService);
      const deleteSpy = vitest.spyOn(state, 'deleteContact');

      // Get the mocked ContactListComponent instance
      const listComponent = ngMocks.find(
        fixture,
        ContactListComponent,
      ).componentInstance;
      // Note: ng-mocks auto-mocks methods, but we can verify it's a spy or add one
      listComponent.resetOpenItems = vitest.fn();

      // 3. Act
      await component.onDeleteContact(MOCK_CONTACT);

      // 4. Assert
      expect(deleteSpy).not.toHaveBeenCalled();
      expect(listComponent.resetOpenItems).toHaveBeenCalled();
    });
  });
});
