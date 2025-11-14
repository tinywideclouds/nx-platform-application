// libs/contacts/contacts-ui/src/lib/components/contacts-page/contacts-page.component.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { Subject } from 'rxjs';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { Signal } from '@angular/core';

import { ContactsPageComponent } from './contacts-page.component';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { ContactListItemComponent } from '../contact-list-item/contact-list-item.component';
import { ISODateTimeString } from '@nx-platform-application/platform-types';
import { Router, RouterLink } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';

import { MatTabsModule } from '@angular/material/tabs';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ContactGroupListComponent } from '../contact-group-list/contact-group-list.component';

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
    serviceContacts: {},
  } as Contact,
];

const MOCK_GROUPS: ContactGroup[] = [
  { id: 'grp-1', name: 'Family', contactIds: [] },
];

// --- Mock Service ---
const { mockContactsService } = vi.hoisted(() => {
  return {
    mockContactsService: {
      contacts$: null as Subject<Contact[]> | null,
      groups$: null as Subject<ContactGroup[]> | null,
    },
  };
});

describe('ContactsPageComponent', () => {
  let fixture: ComponentFixture<ContactsPageComponent>;
  let component: ContactsPageComponent; // Add component
  let router: Router;

  beforeEach(async () => {
    mockContactsService.contacts$ = new Subject<Contact[]>();
    mockContactsService.groups$ = new Subject<ContactGroup[]>();

    await TestBed.configureTestingModule({
      imports: [
        ContactsPageComponent,
        ContactListComponent,
        ContactListItemComponent,
        ContactGroupListComponent,
        RouterTestingModule.withRoutes([]),
        MatTabsModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsPageComponent);
    component = fixture.componentInstance; // Add component
    router = TestBed.inject(Router);
  });

  it('should create', () => {
    mockContactsService.contacts$!.next([]);
    mockContactsService.groups$!.next([]);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should have a strongly-typed contacts signal', () => {
    mockContactsService.contacts$!.next([]);
    mockContactsService.groups$!.next([]);
    fixture.detectChanges();

    const contactsSignal: Signal<Contact[]> = component.contacts;
    expect(contactsSignal).toBeDefined(); // Check signal itself
    expect(component.contacts()).toEqual([]); // Check signal value
  });

  it('should have a strongly-typed groups signal', () => {
    mockContactsService.contacts$!.next([]);
    mockContactsService.groups$!.next([]);
    fixture.detectChanges();

    const groupsSignal: Signal<ContactGroup[]> = component.groups;
    expect(groupsSignal).toBeDefined();
    expect(component.groups()).toEqual([]);
  });

  it('should get contacts from the service and pass them to the list', async () => {
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    mockContactsService.groups$!.next([]);
    fixture.detectChanges();
    await fixture.whenStable(); 

    expect(component.contacts()).toEqual(MOCK_CONTACTS);

    const contactListInstance = fixture.debugElement.query(
      By.css('lib-contact-list')
    )?.componentInstance as ContactListComponent; 

    expect(contactListInstance).toBeTruthy();
    expect(contactListInstance.contacts).toEqual(MOCK_CONTACTS);
  });

  it('should render the correct number of items in the list', async () => {
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    mockContactsService.groups$!.next([]);
    fixture.detectChanges();
    await fixture.whenStable();

    const items = fixture.debugElement.queryAll(
      By.css('lib-contact-list-item') // Query for list item
    );
    expect(items.length).toBe(MOCK_CONTACTS.length);
  });

  it('should have a "New Contact" link pointing to "new"', () => {
    mockContactsService.contacts$!.next([]);
    mockContactsService.groups$!.next([]);
    fixture.detectChanges();

    const newContactLink = fixture.debugElement.query(
      By.css('a[routerLink="new"]')
    );

    expect(newContactLink).toBeTruthy();
    expect(newContactLink.nativeElement.textContent).toContain('New Contact');
  });

  it('should navigate to edit page on (contactSelected) event', async () => {
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    mockContactsService.groups$!.next([]);
    fixture.detectChanges();
    await fixture.whenStable();

    const routerSpy = vi.spyOn(router, 'navigate');
    const contactListEl = fixture.debugElement.query(
      By.css('lib-contact-list')
    );

    expect(contactListEl).toBeTruthy();
    contactListEl.triggerEventHandler('contactSelected', MOCK_CONTACTS[0]);

    expect(routerSpy).toHaveBeenCalledWith([
      '/contacts/edit',
      MOCK_CONTACTS[0].id,
    ]);
  });

  it('should render the empty message if service returns no contacts', async () => {
    mockContactsService.contacts$!.next([]);
    mockContactsService.groups$!.next([]);
    fixture.detectChanges();
    await fixture.whenStable();

    const emptyMessage = fixture.debugElement.query(
      By.css('[data-testid="empty-list"]') // Use correct test-id
    );
    expect(emptyMessage).toBeTruthy();
  });

  // --- THIS IS THE FIXED TEST ---
  it('should navigate to group edit page on (groupSelected) event', async () => {
    mockContactsService.contacts$!.next([]);
    mockContactsService.groups$!.next(MOCK_GROUPS);
    fixture.detectChanges(); // Initial render
    
    // 1. ADD THIS: Wait for Material to render the tab headers
    await fixture.whenStable();

    // 2. Use the robust ARIA role selector [role="tab"]
    const tabLabels = fixture.debugElement.queryAll(By.css('[role="tab"]'));

    // 3. Assert that we found the tabs
    expect(tabLabels.length).toBe(2); // Make sure we found both

    const groupTabLabel = tabLabels[1]?.nativeElement as HTMLElement;
    expect(groupTabLabel).toBeTruthy(); // This should now pass
    groupTabLabel.click();
    fixture.detectChanges();
    await fixture.whenStable(); // Wait for tab *content* to render

    const routerSpy = vi.spyOn(router, 'navigate');
    const groupListEl = fixture.debugElement.query(
      By.css('lib-contact-group-list')
    );

    expect(groupListEl).toBeTruthy();
    groupListEl.triggerEventHandler('groupSelected', MOCK_GROUPS[0]);

    expect(routerSpy).toHaveBeenCalledWith([
      '/contacts/group-edit',
      MOCK_GROUPS[0].id,
    ]);
  });
});