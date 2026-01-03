// src/lib/components/contact-group-page/contact-group-page.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { Subject } from 'rxjs';
import { By } from '@angular/platform-browser';

import { ContactGroupPageComponent } from './contact-group-page.component';
import { ContactGroupFormComponent } from '../contact-group-page-form/contact-group-form.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

// --- Mocks Data ---
const mockContactUrn = URN.parse('urn:contacts:user:user-123');
const mockGroupUrn = URN.parse('urn:contacts:group:grp-123');

const MOCK_CONTACTS: Contact[] = [
  {
    id: mockContactUrn,
    alias: 'johndoe',
    firstName: 'John',
    surname: 'Doe',
    email: 'john@example.com',
    serviceContacts: {},
    phoneNumbers: [],
    emailAddresses: [],
    lastModified: '' as ISODateTimeString,
  } as Contact,
];

const MOCK_GROUP: ContactGroup = {
  id: mockGroupUrn,
  name: 'Test Group',
  description: 'A test group',
  scope: 'local',
  members: [{ contactId: mockContactUrn, status: 'added' }],
};

const mockActivatedRoute = {
  paramMap: new Subject(),
};

// --- Service Mocks ---

// 1. Define the service mock simply (No vi.hoisted)
// Ensure contacts$ is initialized immediately so component constructor can subscribe.
const mockContactsService = {
  getGroup: vi.fn(),
  saveGroup: vi.fn(),
  contacts$: new Subject<Contact[]>(),
};

// 2. Define Router mock with createUrlTree (Required for [routerLink])
const mockRouter = {
  navigate: vi.fn(),
  createUrlTree: vi.fn().mockReturnValue({}),
  serializeUrl: vi.fn().mockReturnValue('#'),
  events: new Subject<unknown>(),
  url: '/',
};

describe('ContactGroupPageComponent', () => {
  let fixture: ComponentFixture<ContactGroupPageComponent>;
  let component: ContactGroupPageComponent;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset the Subject state
    mockContactsService.contacts$ = new Subject<Contact[]>();
    mockContactsService.getGroup.mockResolvedValue(MOCK_GROUP);
    mockContactsService.saveGroup.mockResolvedValue(undefined);

    await TestBed.configureTestingModule({
      imports: [
        ContactGroupPageComponent,
        ContactsPageToolbarComponent,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactGroupPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should be in ADD MODE if groupId is undefined', async () => {
    fixture.componentRef.setInput('groupId', undefined);

    // Emit data to the subject
    mockContactsService.contacts$.next(MOCK_CONTACTS);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockContactsService.getGroup).not.toHaveBeenCalled();
    expect(component.groupToEdit()).toBeTruthy();
    expect(component.startInEditMode()).toBe(true);
  });

  it('should be in EDIT MODE if groupId is provided', async () => {
    fixture.componentRef.setInput('groupId', mockGroupUrn);
    mockContactsService.contacts$.next(MOCK_CONTACTS);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockContactsService.getGroup).toHaveBeenCalledWith(mockGroupUrn);
    expect(component.groupToEdit()).toEqual(MOCK_GROUP);
    expect(component.startInEditMode()).toBe(false);
  });

  it('should call saveGroup and navigate on (save) event', async () => {
    fixture.componentRef.setInput('groupId', undefined);
    mockContactsService.contacts$.next(MOCK_CONTACTS);
    fixture.detectChanges();
    await fixture.whenStable();

    const formComponent = fixture.debugElement.query(
      By.directive(ContactGroupFormComponent),
    );

    formComponent.triggerEventHandler('save', MOCK_GROUP);
    await fixture.whenStable();

    expect(mockContactsService.saveGroup).toHaveBeenCalledWith(MOCK_GROUP);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/contacts'], {
      queryParams: { tab: 'groups' },
      queryParamsHandling: 'merge',
    });
  });
});
