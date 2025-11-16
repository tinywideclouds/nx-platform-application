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
// --- 1. Import URN and ISODateTimeString ---
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

import { RouterTestingModule } from '@angular/router/testing';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatChipsModule } from '@angular/material/chips'; // <-- Import MatChipsModule

// --- 2. Update Fixtures to use URNs ---
const mockContactUrn = URN.parse('urn:sm:user:user-123');
const mockGroupUrn = URN.parse('urn:sm:group:grp-123');

const mockContact: Contact = {
  id: mockContactUrn,
  alias: 'testuser',
  email: 'test@example.com',
  firstName: 'Test',
  surname: 'User',
  phoneNumbers: ['+15550100'],
  emailAddresses: ['test@example.com'],
  serviceContacts: {},
} as Contact; // Use 'as Contact' for mock simplicity

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

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([]),
        NoopAnimationsModule,
        ContactPageComponent,
        ContactFormComponent,
        ContactsPageToolbarComponent,
        MatChipsModule, // <-- Add MatChipsModule
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
    // Check that the ID is a URN object
    expect(component.contactToEdit()?.id).toBeInstanceOf(URN);
    expect(component.contactToEdit()?.id.toString()).toContain('urn:sm:user:');
  });

  it('should be in EDIT MODE', async () => {
    // --- 3. Pass the string version of the URN, as the router would ---
    const idString = mockContactUrn.toString();
    mockActivatedRoute.paramMap.next({ get: () => idString });
    fixture.detectChanges();
    await fixture.whenStable();

    // --- 4. Expect the service to be called with the PARSED URN object ---
    expect(mockContactsService.getContact).toHaveBeenCalledWith(mockContactUrn);
    expect(component.contactToEdit()).toEqual(mockContact);
  });

  it('should fetch and display groups for the contact in EDIT MODE', async () => {
    // --- 5. Pass the string ID from the router ---
    const idString = mockContactUrn.toString();
    mockActivatedRoute.paramMap.next({ get: () => idString });
    fixture.detectChanges();
    await fixture.whenStable(); // Waits for contactToEdit to resolve
    await fixture.whenStable(); // Waits for groupsForContact to resolve
    fixture.detectChanges();

    // --- 6. Expect service to be called with the URN ---
    expect(mockContactsService.getGroupsForContact).toHaveBeenCalledWith(
      mockContactUrn
    );
    expect(component.groupsForContact()).toEqual([MOCK_GROUP]);

    const chips = fixture.nativeElement.querySelectorAll(
      '[data-testid="group-chip"]'
    );
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('Test Group');
  });

  it('should call saveContact and navigate on (save) event', async () => {
    mockActivatedRoute.paramMap.next({ get: () => null });
    fixture.detectChanges();
    await fixture.whenStable();

    const formComponent = fixture.debugElement.query(
      By.directive(ContactFormComponent)
    );
    // Trigger with the URN-based mock
    formComponent.triggerEventHandler('save', mockContact);
    await fixture.whenStable();

    expect(mockContactsService.saveContact).toHaveBeenCalledWith(mockContact);
    expect(router.navigate).toHaveBeenCalledWith(['/contacts'], {
      queryParams: { tab: 'contacts' },
    });
  });
});