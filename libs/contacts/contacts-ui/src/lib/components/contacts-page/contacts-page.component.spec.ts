// libs/contacts/contacts-ui/src/lib/contacts-page/contacts-page.component.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { Subject } from 'rxjs';
import {
  ContactsStorageService,
  Contact,
} from '@nx-platform-application/contacts-data-access';
import { Signal } from '@angular/core';

import { ContactsPageComponent } from './contacts-page.component';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { ContactListItemComponent } from '../contact-list-item/contact-list-item.component';
import { ISODateTimeString } from '@nx-platform-application/platform-types';
import { Router, RouterLink } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing'; // 1. We'll configure this

// --- Mock Data ---
const MOCK_CONTACTS: Contact[] = [
  {
    id: 'user-123',
    alias: 'johndoe',
    email: 'john@example.com',
    firstName: 'John',
    surname: 'Doe',
    phoneNumbers: ['+15550199'],
    emailAddresses: ['john@example.com'],
    isFavorite: false,
    serviceContacts: {
      messenger: {
        id: 'msg-uuid-1',
        alias: 'jd_messenger',
        lastSeen: '2023-01-01T12:00:00Z' as ISODateTimeString,
        profilePictureUrl: 'http://messenger.com/img.png',
      },
    },
  } as Contact,
  {
    id: 'user-456',
    alias: 'janedoe',
    email: 'jane@example.com',
    firstName: 'Jane',
    surname: 'Doe',
    phoneNumbers: ['+15550188'],
    emailAddresses: ['jane@example.com'],
    isFavorite: true,
    serviceContacts: {
      messenger: {
        id: 'msg-uuid-2',
        alias: 'jane_messenger',
        lastSeen: '2023-01-01T12:00:00Z' as ISODateTimeString,
        profilePictureUrl: 'http://messenger.com/img2.png',
      },
    },
  } as Contact,
];

// --- Mock Service ---
const { mockContactsService } = vi.hoisted(() => {
  return {
    mockContactsService: {
      contacts$: null as Subject<Contact[]> | null,
    },
  };
});

// 2. We no longer need the manual mockRouter
// const mockRouter = { ... };

describe('ContactsPageComponent', () => {
  let fixture: ComponentFixture<ContactsPageComponent>;
  let component: ContactsPageComponent;
  let router: Router; // 3. We'll store the real router here

  beforeEach(async () => {
    mockContactsService.contacts$ = new Subject<Contact[]>();
    // mockRouter.navigate.mockReset(); // 4. No longer needed

    await TestBed.configureTestingModule({
      imports: [
        ContactsPageComponent,
        ContactListComponent,
        ContactListItemComponent,
        RouterTestingModule.withRoutes([]), // 5. CONFIGURE RouterTestingModule
      ],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
        // 6. REMOVE the mock router provider
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router); // 7. Inject the router from the TestBed
  });

  it('should create', () => {
    mockContactsService.contacts$!.next([]);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should have a strongly-typed contacts signal', () => {
    mockContactsService.contacts$!.next([]);
    fixture.detectChanges();

    const contactsSignal: Signal<Contact[]> = component.contacts;
    expect(contactsSignal).toBeDefined();
  });

  it('should get contacts from the service and pass them to the list', () => {
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    fixture.detectChanges();

    expect(component.contacts()).toEqual(MOCK_CONTACTS);

    const contactListInstance = fixture.debugElement.query(
      By.css('lib-contact-list')
    ).componentInstance as ContactListComponent;

    expect(contactListInstance.contacts).toEqual(MOCK_CONTACTS);
  });

  it('should render the correct number of items in the list', () => {
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    fixture.detectChanges();

    const items = fixture.debugElement.queryAll(
      By.css('lib-contact-list-item')
    );
    expect(items.length).toBe(MOCK_CONTACTS.length);
  });

  it('should have a "New Contact" link pointing to "new"', () => {
    mockContactsService.contacts$!.next([]);
    fixture.detectChanges();

    const newContactLink = fixture.debugElement.query(
      By.css('a[routerLink="new"]')
    );

    expect(newContactLink).toBeTruthy();
    expect(newContactLink.nativeElement.textContent).toContain('New Contact');
  });

  // --- UPDATED TEST ---
  it('should navigate to edit page on (contactSelected) event', () => {
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    fixture.detectChanges();

    // 8. Spy on the INJECTED router, not the mock
    const routerSpy = vi.spyOn(router, 'navigate');

    const contactListEl = fixture.debugElement.query(
      By.css('lib-contact-list')
    );

    contactListEl.triggerEventHandler('contactSelected', MOCK_CONTACTS[0]);

    expect(routerSpy).toHaveBeenCalledWith([
      '/contacts/edit',
      MOCK_CONTACTS[0].id,
    ]);
  });

  it('should render the empty message if service returns no contacts', () => {
    mockContactsService.contacts$!.next([]);
    fixture.detectChanges();

    const emptyMessage = fixture.debugElement.query(
      By.css('[data-testid="empty-list"]')
    );
    expect(emptyMessage).toBeTruthy();
  });
});