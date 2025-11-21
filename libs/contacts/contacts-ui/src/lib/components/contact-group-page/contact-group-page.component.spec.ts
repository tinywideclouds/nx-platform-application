import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-access';
// --- 1. Import URN and other types ---
import { URN } from '@nx-platform-application/platform-types';
import { Subject } from 'rxjs';
import { By } from '@angular/platform-browser';

import { ContactGroupPageComponent } from './contact-group-page.component';
import { ContactGroupFormComponent } from '../contact-group-page-form/contact-group-form.component';

import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

// --- 2. Update Fixtures to use URNs ---
const mockContactUrn = URN.parse('urn:sm:user:user-123');
const mockGroupUrn = URN.parse('urn:sm:group:grp-123');

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
  } as Contact, // Use 'as Contact' for simplicity in mock
];

const MOCK_GROUP: ContactGroup = {
  id: mockGroupUrn,
  name: 'Test Group',
  description: 'A test group',
  contactIds: [mockContactUrn],
};
// --- END CHANGES ---

const { mockContactsService } = vi.hoisted(() => {
  return {
    mockContactsService: {
      getGroup: vi.fn(),
      saveGroup: vi.fn(),
      contacts$: null as Subject<Contact[]> | null,
    },
  };
});

const mockActivatedRoute = {
  paramMap: new Subject(),
};

describe('ContactGroupPageComponent', () => {
  let fixture: ComponentFixture<ContactGroupPageComponent>;
  let component: ContactGroupPageComponent;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockContactsService.getGroup.mockResolvedValue(MOCK_GROUP);
    mockContactsService.saveGroup.mockResolvedValue(undefined);
    mockContactsService.contacts$ = new Subject<Contact[]>();

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([]),
        NoopAnimationsModule,
        ContactGroupPageComponent,
        ContactsPageToolbarComponent,
      ],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactGroupPageComponent);
    component = fixture.componentInstance;

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');
  });

  it('should create', () => {
    mockActivatedRoute.paramMap.next({ get: () => null });
    mockContactsService.contacts$!.next([]);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should be in ADD MODE if no :id is present', async () => {
    mockActivatedRoute.paramMap.next({ get: () => null });
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockContactsService.getGroup).not.toHaveBeenCalled();
    expect(component.groupToEdit()).toBeTruthy();
    // Check that the ID is a URN object
    expect(component.groupToEdit()?.id).toBeInstanceOf(URN);
    expect(component.groupToEdit()?.id.toString()).toContain('urn:sm:group:');
    expect(component.allContacts()).toEqual(MOCK_CONTACTS);
  });

  it('should be in EDIT MODE if :id is present', async () => {
    // --- 3. Pass the string version of the URN, as the router would ---
    const idString = mockGroupUrn.toString();
    mockActivatedRoute.paramMap.next({ get: () => idString });
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // --- 4. Expect the service to be called with the PARSED URN object ---
    expect(mockContactsService.getGroup).toHaveBeenCalledWith(mockGroupUrn);
    expect(component.groupToEdit()).toEqual(MOCK_GROUP);
    expect(component.allContacts()).toEqual(MOCK_CONTACTS);
  });

  it('should call saveGroup and navigate on (save) event', async () => {
    mockActivatedRoute.paramMap.next({ get: () => null });
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const formComponent = fixture.debugElement.query(
      By.directive(ContactGroupFormComponent)
    );
    // Trigger with the URN-based mock
    formComponent.triggerEventHandler('save', MOCK_GROUP);
    await fixture.whenStable();

    expect(mockContactsService.saveGroup).toHaveBeenCalledWith(MOCK_GROUP);
    expect(router.navigate).toHaveBeenCalledWith(['/contacts'], {
      queryParams: { tab: 'groups' },
    });
  });
});
