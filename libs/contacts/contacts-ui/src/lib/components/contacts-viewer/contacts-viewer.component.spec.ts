// libs/contacts/contacts-ui/src/lib/components/contacts-page/contacts-page.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { Subject, of } from 'rxjs';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { Signal } from '@angular/core';
import { Router, ActivatedRoute, ParamMap, RouterLink } from '@angular/router'; // 1. FIX: Use RouterLink
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button'; // 2. FIX: Import MatButtonModule
import { MatIconModule } from '@angular/material/icon'; // 3. FIX: Import MatIconModule

import { ContactsViewerComponent } from './contacts-viewer.component';
import { ContactListComponent } from '../contact-list/contact-list.component';
import { ContactListItemComponent } from '../contact-list-item/contact-list-item.component';
import { ContactGroupListComponent } from '../contact-group-list/contact-group-list.component';
import { ContactGroupListItemComponent } from '../contact-group-list-item/contact-group-list-item.component';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component'; // Import dependency

// --- Mock Data ---
// This mock must satisfy the Contact interface to prevent
// errors in the child ContactListItemComponent.
const MOCK_CONTACTS: Contact[] = [
  {
    id: 'user-123',
    alias: 'johndoe',
    firstName: 'John',
    surname: 'Doe',
    email: 'john@example.com',
    serviceContacts: {}, // <-- Required
    phoneNumbers: [], // <-- Required
    emailAddresses: [], // <-- Required
  } as Contact,
];

const MOCK_GROUPS: ContactGroup[] = [
  { id: 'grp-123', name: 'Family', contactIds: ['user-123'] },
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

// Mock query params
const mockQueryParamMap = new Subject<ParamMap>();
const mockActivatedRoute = {
  queryParamMap: mockQueryParamMap.asObservable(),
  snapshot: {},
};

describe('ContactsPageComponent', () => {
  let fixture: ComponentFixture<ContactsViewerComponent>;
  let component: ContactsViewerComponent;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockContactsService.contacts$ = new Subject<Contact[]>();
    mockContactsService.groups$ = new Subject<ContactGroup[]>();

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([]), // Provides the real test router
        NoopAnimationsModule,
        MatTabsModule,
        MatButtonModule, // 4. FIX: Add MatButtonModule
        MatIconModule, // 5. FIX: Add MatIconModule
        ContactsViewerComponent,
        ContactListComponent,
        ContactListItemComponent,
        ContactGroupListComponent,
        ContactGroupListItemComponent,
        ContactAvatarComponent, // Add dependency
      ],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        // We DO NOT mock the Router, RouterTestingModule provides it.
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsViewerComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router); // Inject the real test router
  });

  // Helper function to initialize component
  function initializeComponent(params: ParamMap) {
    mockQueryParamMap.next(params);
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    mockContactsService.groups$!.next(MOCK_GROUPS);
    fixture.detectChanges();
  }

  it('should create', () => {
    initializeComponent(new Map() as ParamMap);
    expect(component).toBeTruthy();
  });

  it('should have a "New Contact" link pointing to "new"', () => {
    initializeComponent(new Map() as ParamMap);
    const newContactLinkEl = fixture.debugElement.query(
      By.css('[data-testid="new-contact-button"]')
    );
    expect(newContactLinkEl).toBeTruthy();

    // 6. FIX: Query for RouterLink, not RouterLinkWithHref
    const routerLinkInstance = newContactLinkEl.injector.get(RouterLink);
    expect(routerLinkInstance.routerLink).toBe('new');
  });

  it('should have a "New Group" link pointing to "group-new"', () => {
    initializeComponent(new Map() as ParamMap);
    const newGroupLinkEl = fixture.debugElement.query(
      By.css('[data-testid="new-group-button"]')
    );
    expect(newGroupLinkEl).toBeTruthy();

    // 7. FIX: Query for RouterLink, not RouterLinkWithHref
    const routerLinkInstance = newGroupLinkEl.injector.get(RouterLink);
    expect(routerLinkInstance.routerLink).toBe('group-new');
  });

  it('should default to the "Contacts" tab (index 0)', () => {
    initializeComponent(new Map() as ParamMap);
    expect(component.tabIndex()).toBe(0);
  });

  it('should select "Groups" tab (index 1) when ?tab=groups', () => {
    initializeComponent(new Map([['tab', 'groups']]) as ParamMap);
    expect(component.tabIndex()).toBe(1);
  });

  it('should navigate to edit page on (contactSelected)', () => {
    const routerSpy = vi.spyOn(router, 'navigate');
    initializeComponent(new Map() as ParamMap);

    const contactListEl = fixture.debugElement.query(
      By.css('lib-contact-list')
    );
    contactListEl.triggerEventHandler('contactSelected', MOCK_CONTACTS[0]);

    expect(routerSpy).toHaveBeenCalledWith(['../edit', MOCK_CONTACTS[0].id], {
      relativeTo: mockActivatedRoute,
    });
  });

  it('should navigate to group edit page on (groupSelected)', async () => {
    const routerSpy = vi.spyOn(router, 'navigate');
    initializeComponent(new Map([['tab', 'groups']]) as ParamMap);
    fixture.detectChanges();
    await fixture.whenStable();

    const groupListEl = fixture.debugElement.query(
      By.css('lib-contact-group-list')
    );
    groupListEl.triggerEventHandler('groupSelected', MOCK_GROUPS[0]);

    expect(routerSpy).toHaveBeenCalledWith(
      ['../group-edit', MOCK_GROUPS[0].id],
      { relativeTo: mockActivatedRoute }
    );
  });

  it('should update query params when tab is changed', async () => {
    const routerSpy = vi.spyOn(router, 'navigate');
    initializeComponent(new Map() as ParamMap);
    await fixture.whenStable();

    const tabLabels = fixture.debugElement.queryAll(By.css('[role="tab"]'));
    const groupTabLabel = tabLabels[1]?.nativeElement as HTMLElement;

    groupTabLabel.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(routerSpy).toHaveBeenCalledWith([], {
      relativeTo: mockActivatedRoute,
      queryParams: { tab: 'groups' },
      queryParamsHandling: 'merge',
    });
  });
});