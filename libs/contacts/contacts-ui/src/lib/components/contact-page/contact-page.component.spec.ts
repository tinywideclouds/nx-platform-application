// libs/contacts/contacts-ui/src/lib/components/contact-page/contact-page.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { ContactPageComponent } from './contact-page.component';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { ContactFormComponent } from '../contact-page-form/contact-form.component';
import { Subject } from 'rxjs';
import { By } from '@angular/platform-browser';
import {
  URN,
} from '@nx-platform-application/platform-types';

import { RouterTestingModule } from '@angular/router/testing';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatChipsModule } from '@angular/material/chips';

// --- Fixtures ---
const mockContactUrn = URN.parse('urn:sm:user:user-123');
const mockGroupUrn = URN.parse('urn:sm:group:grp-123');
const mockAuthUrn = URN.parse('urn:auth:google:bob-123');

const mockContact: Contact = {
  id: mockContactUrn,
  alias: 'testuser',
  email: 'test@example.com',
  firstName: 'Test',
  surname: 'User',
  phoneNumbers: ['+15550100'],
  emailAddresses: ['test@example.com'],
  serviceContacts: {},
} as Contact;

const MOCK_GROUP: ContactGroup = {
  id: mockGroupUrn,
  name: 'Test Group',
  contactIds: [mockContactUrn],
};

// --- Mocks ---
const { mockContactsService } = vi.hoisted(() => {
  return {
    mockContactsService: {
      getContact: vi.fn(),
      saveContact: vi.fn(),
      getGroupsForContact: vi.fn(),
      getLinkedIdentities: vi.fn(), // <-- Added mock
    },
  };
});

const mockActivatedRoute = {
  paramMap: new Subject(),
};

describe('ContactPageComponent (RxJS-based)', () => {
  let fixture: ComponentFixture<ContactPageComponent>;
  let component: ContactPageComponent;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockContactsService.getContact.mockResolvedValue(mockContact);
    mockContactsService.saveContact.mockResolvedValue(undefined);
    mockContactsService.getGroupsForContact.mockResolvedValue([MOCK_GROUP]);
    mockContactsService.getLinkedIdentities.mockResolvedValue([mockAuthUrn]); // <-- Default return

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([]),
        NoopAnimationsModule,
        ContactPageComponent,
        ContactFormComponent,
        ContactsPageToolbarComponent,
        MatChipsModule,
      ],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactPageComponent);
    component = fixture.componentInstance;

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate');

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be in ADD MODE', async () => {
    mockActivatedRoute.paramMap.next({ get: () => null });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockContactsService.getContact).not.toHaveBeenCalled();
    expect(component.contactToEdit()).toBeTruthy();
    expect(component.contactToEdit()?.id).toBeInstanceOf(URN);
  });

  it('should be in EDIT MODE and fetch linked identities', async () => {
    const idString = mockContactUrn.toString();
    mockActivatedRoute.paramMap.next({ get: () => idString });
    fixture.detectChanges();
    
    // 1. Wait for 'getContact' to resolve and update the contactToEdit signal
    await fixture.whenStable();
    fixture.detectChanges(); 

    // Verify Contact fetch (This was already passing)
    expect(mockContactsService.getContact).toHaveBeenCalledWith(mockContactUrn);
    expect(component.contactToEdit()).toEqual(mockContact);

    // 2. Wait for 'toObservable' to react and 'getLinkedIdentities' to resolve
    await fixture.whenStable();
    fixture.detectChanges();

    // Verify Linked Identities fetch (This should now pass)
    expect(mockContactsService.getLinkedIdentities).toHaveBeenCalledWith(mockContactUrn);
    expect(component.linkedIdentities()).toEqual([mockAuthUrn]);
  });

  it('should fetch and display groups for the contact in EDIT MODE', async () => {
    const idString = mockContactUrn.toString();
    mockActivatedRoute.paramMap.next({ get: () => idString });
    fixture.detectChanges();
    await fixture.whenStable(); // Contact
    await fixture.whenStable(); // Groups & Links
    fixture.detectChanges();

    expect(mockContactsService.getGroupsForContact).toHaveBeenCalledWith(
      mockContactUrn
    );
    expect(component.groupsForContact()).toEqual([MOCK_GROUP]);

    const chips = fixture.nativeElement.querySelectorAll(
      '[data-testid="group-chip"]'
    );
    expect(chips.length).toBe(1);
  });

  it('should call saveContact and navigate on (save) event', async () => {
    mockActivatedRoute.paramMap.next({ get: () => null });
    fixture.detectChanges();
    await fixture.whenStable();

    const formComponent = fixture.debugElement.query(
      By.directive(ContactFormComponent)
    );
    formComponent.triggerEventHandler('save', mockContact);
    await fixture.whenStable();

    expect(mockContactsService.saveContact).toHaveBeenCalledWith(mockContact);
    expect(router.navigate).toHaveBeenCalledWith(['/contacts'], {
      queryParams: { tab: 'contacts' },
    });
  });
});