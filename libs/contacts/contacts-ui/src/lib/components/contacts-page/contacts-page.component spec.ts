// libs/contacts/contacts-ui/src/lib/contacts-page/contacts-page.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { of } from 'rxjs';
import {
  ContactsStorageService,
  Contact,
} from '@nx-platform-application/contacts-data-access';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

import { ContactsPageComponent } from './contacts-page.component';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { ContactListItemComponent } from '../contact-list-item/contact-list-item.component';

// --- Mock Data ---
const MOCK_CONTACTS: Contact[] = [
  {
    id: 'user-123',
    alias: 'johndoe',
    /*... other properties ...*/
  } as Contact, // Using 'as' for test brevity
  {
    id: 'user-456',
    alias: 'janedoe',
    /*... other properties ...*/
  } as Contact,
];

// --- Mock Service ---
const { mockContactsService } = vi.hoisted(() => {
  return {
    mockContactsService: {
      // We will control this observable in each test
      contacts$: of([]),
    },
  };
});

describe('ContactsPageComponent', () => {
  let fixture: ComponentFixture<ContactsPageComponent>;
  let component: ContactsPageComponent;

  beforeEach(async () => {
    // Set default mock behavior for most tests
    mockContactsService.contacts$ = of(MOCK_CONTACTS);

    await TestBed.configureTestingModule({
      // Import the component-under-test AND all "dumb" components
      // its template needs to render.
      imports: [
        ContactsPageComponent,
        ContactListComponent,
        ContactListItemComponent,
      ],
      providers: [
        // Provide the mock service
        { provide: ContactsStorageService, useValue: mockContactsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should have a strongly-typed contacts signal', () => {
    // This test proves the fix.
    // If the type from the service was `unknown`, this line
    // would fail to compile, as `Signal<unknown>` is not
    // assignable to `Signal<Contact[]>`.
    const contactsSignal: Signal<Contact[]> = component.contacts;
    
    // This assertion is almost redundant, the test is
    // that this file *compiles*.
    expect(contactsSignal).toBeDefined();
  });

  it('should get contacts from the service and pass them to the list', () => {
    // Run change detection to trigger `toSignal`
    fixture.detectChanges();

    // 1. Check the component's signal
    expect(component.contacts()).toEqual(MOCK_CONTACTS);

    // 2. Check the "dumb" component's @Input property
    const contactListInstance = fixture.debugElement.query(
      By.css('lib-contact-list')
    ).componentInstance as ContactListComponent;

    expect(contactListInstance.contacts).toEqual(MOCK_CONTACTS);
  });

  it('should render the correct number of items in the list', () => {
    // This test confirms the full component chain is rendering
    fixture.detectChanges();
    const items = fixture.debugElement.queryAll(
      By.css('lib-contact-list-item')
    );
    expect(items.length).toBe(MOCK_CONTACTS.length);
  });

  it('should handle the (contactSelected) event from the list', () => {
    fixture.detectChanges();
    const spy = vi.spyOn(component, 'onContactSelect');

    const contactListEl = fixture.debugElement.query(
      By.css('lib-contact-list')
    );
    
    // Simulate the "dumb" component emitting its event
    contactListEl.triggerEventHandler('contactSelected', MOCK_CONTACTS[0]);

    expect(spy).toHaveBeenCalledWith(MOCK_CONTACTS[0]);
  });

  it('should render the empty message if service returns no contacts', () => {
    // Override default mock for this specific test
    mockContactsService.contacts$ = of([]);
    fixture.detectChanges();

    const emptyMessage = fixture.debugElement.query(
      By.css('[data-testid="empty-list"]')
    );
    expect(emptyMessage).toBeTruthy();
  });
});