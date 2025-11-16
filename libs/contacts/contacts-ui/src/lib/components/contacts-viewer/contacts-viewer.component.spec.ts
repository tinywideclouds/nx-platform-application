// libs/contacts/contacts-ui/src/lib/components/contacts-viewer/contacts-viewer.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { Subject, of } from 'rxjs';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { URN } from '@nx-platform-application/platform-types';
import { Signal } from '@angular/core';
import { Router, ActivatedRoute, ParamMap, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { ContactsViewerComponent } from './contacts-viewer.component';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { ContactListItemComponent } from '../contact-list-item/contact-list-item.component';
import { ContactGroupListComponent } from '../contact-group-list/contact-group-list.component';
import { ContactGroupListItemComponent } from '../contact-group-list-item/contact-group-list-item.component';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

// --- Mock Data (Updated to use URNs) ---
const MOCK_CONTACTS: Contact[] = [
  {
    id: URN.parse('urn:sm:user:user-123'),
    alias: 'johndoe',
    firstName: 'John',
    surname: 'Doe',
    email: 'john@example.com',
    serviceContacts: {},
    phoneNumbers: [],
    emailAddresses: [],
  } as Contact,
];

const MOCK_GROUPS: ContactGroup[] = [
  {
    id: URN.parse('urn:sm:group:grp-123'),
    name: 'Family',
    contactIds: [URN.parse('urn:sm:user:user-123')],
  },
];

// --- Mocks ---
const { mockContactsService } = vi.hoisted(() => {
  return {
    mockContactsService: {
      contacts$: null as Subject<Contact[]> | null,
      groups$: null as Subject<ContactGroup[]> | null,
    },
  };
});

const mockQueryParamMap = new Subject<ParamMap>();
const mockActivatedRoute = {
  queryParamMap: mockQueryParamMap.asObservable(),
  snapshot: {},
};

describe('ContactsViewerComponent', () => {
  let fixture: ComponentFixture<ContactsViewerComponent>;
  let component: ContactsViewerComponent;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockContactsService.contacts$ = new Subject<Contact[]>();
    mockContactsService.groups$ = new Subject<ContactGroup[]>();

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([]),
        NoopAnimationsModule,
        MatTabsModule,
        MatButtonModule,
        MatIconModule,
        ContactsViewerComponent,
        ContactListComponent,
        ContactListItemComponent,
        ContactGroupListComponent,
        ContactGroupListItemComponent,
        ContactAvatarComponent,
        ContactsPageToolbarComponent,
      ],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsViewerComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
  });

  // Helper function to initialize component
  function initializeComponent(params: ParamMap) {
    mockQueryParamMap.next(params);
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    mockContactsService.groups$!.next(MOCK_GROUPS);
    fixture.detectChanges();
  }

  it('should create', () => {
    initializeComponent(convertToParamMap({}));
    expect(component).toBeTruthy();
  });

  it('should have a "New Contact" link pointing to "new"', () => {
    initializeComponent(convertToParamMap({}));
    const newContactLinkEl = fixture.debugElement.query(
      By.css('[data-testid="new-contact-button"]')
    );
    expect(newContactLinkEl).toBeTruthy();
    expect(newContactLinkEl.attributes['routerLink']).toBe('new');
  });

  it('should have a "New Group" link pointing to "group-new"', () => {
    initializeComponent(convertToParamMap({}));
    const newGroupLinkEl = fixture.debugElement.query(
      By.css('[data-testid="new-group-button"]')
    );
    expect(newGroupLinkEl).toBeTruthy();
    expect(newGroupLinkEl.attributes['routerLink']).toBe('group-new');
  });

  it('should default to the "Contacts" tab (index 0)', () => {
    initializeComponent(convertToParamMap({}));
    expect(component.tabIndex()).toBe(0);
  });

  it('should select "Groups" tab (index 1) when ?tab=groups', () => {
    initializeComponent(convertToParamMap({ tab: 'groups' }));
    expect(component.tabIndex()).toBe(1);
  });

  // --- THIS TEST IS UPDATED ---
  it('should navigate to edit page on (contactSelected)', () => {
    initializeComponent(convertToParamMap({}));

    const contactListEl = fixture.debugElement.query(
      By.css('contacts-list')
    );
    contactListEl.triggerEventHandler('contactSelected', MOCK_CONTACTS[0]);

    // Assert the navigation is called with the STRING version of the URN
    expect(router.navigate).toHaveBeenCalledWith(
      ['edit', MOCK_CONTACTS[0].id.toString()],
      {
        relativeTo: mockActivatedRoute,
      }
    );
  });

  // --- THIS TEST IS UPDATED ---
  it('should navigate to group edit page on (groupSelected)', async () => {
    initializeComponent(convertToParamMap({ tab: 'groups' }));
    fixture.detectChanges();
    await fixture.whenStable();

    const groupListEl = fixture.debugElement.query(
      By.css('contacts-group-list')
    );
    groupListEl.triggerEventHandler('groupSelected', MOCK_GROUPS[0]);

    // Assert the navigation is called with the STRING version of the URN
    expect(router.navigate).toHaveBeenCalledWith(
      ['group-edit', MOCK_GROUPS[0].id.toString()],
      { relativeTo: mockActivatedRoute }
    );
  });

  it('should update query params when tab is changed', async () => {
    initializeComponent(convertToParamMap({}));
    await fixture.whenStable();

    const tabLabels = fixture.debugElement.queryAll(By.css('[role="tab"]'));
    const groupTabLabel = tabLabels[1]?.nativeElement as HTMLElement;

    groupTabLabel.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.navigate).toHaveBeenCalledWith([], {
      relativeTo: mockActivatedRoute,
      queryParams: { tab: 'groups' },
      queryParamsHandling: 'merge',
    });
  });
});