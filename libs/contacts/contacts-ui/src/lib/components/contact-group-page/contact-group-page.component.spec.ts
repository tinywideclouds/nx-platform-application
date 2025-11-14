import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { of, Subject } from 'rxjs';
import { By } from '@angular/platform-browser';

import { ContactGroupEditPageComponent } from './contact-group-edit-page.component';
import { ContactGroupFormComponent } from '../contact-group-form/contact-group-form.component';

// --- Fixtures ---
const MOCK_CONTACTS: Contact[] = [
  {
    id: 'user-123',
    alias: 'johndoe',
    firstName: 'John',
    surname: 'Doe',
    email: 'john@example.com',
    serviceContacts: {},
    phoneNumbers: [],
    emailAddresses: [],
  } as Contact,
];

const MOCK_GROUP: ContactGroup = {
  id: 'grp-123',
  name: 'Test Group',
  description: 'A test group',
  contactIds: ['user-123'],
};

// --- Mocks ---
const { mockContactsService } = vi.hoisted(() => {
  return {
    mockContactsService: {
      getGroup: vi.fn(),
      saveGroup: vi.fn(),
      contacts$: null as Subject<Contact[]> | null,
    },
  };
});

const mockRouter = {
  navigate: vi.fn(),
};

const mockActivatedRoute = {
  paramMap: new Subject(),
};

describe('ContactGroupEditPageComponent', () => {
  let fixture: ComponentFixture<ContactGroupEditPageComponent>;
  let component: ContactGroupEditPageComponent;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockContactsService.getGroup.mockResolvedValue(MOCK_GROUP);
    mockContactsService.saveGroup.mockResolvedValue(undefined);
    mockContactsService.contacts$ = new Subject<Contact[]>();

    await TestBed.configureTestingModule({
      imports: [ContactGroupEditPageComponent],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactGroupEditPageComponent);
    component = fixture.componentInstance;
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
    expect(component.groupToEdit()?.id).toContain('urn:sm:group:');
    expect(component.allContacts()).toEqual(MOCK_CONTACTS);
  });

  // --- THIS IS THE FIXED TEST ---
  it('should be in EDIT MODE if :id is present', async () => {
    mockActivatedRoute.paramMap.next({ get: () => 'grp-123' });
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Assertion is fixed to use the correct ID
    expect(mockContactsService.getGroup).toHaveBeenCalledWith('grp-123');
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
    formComponent.triggerEventHandler('save', MOCK_GROUP);
    await fixture.whenStable();

    expect(mockContactsService.saveGroup).toHaveBeenCalledWith(MOCK_GROUP);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/contacts'], {
      queryParams: { tab: 'groups' },
    });
  });

  it('should navigate on (cancel) event', async () => {
    mockActivatedRoute.paramMap.next({ get: () => null });
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const formComponent = fixture.debugElement.query(
      By.directive(ContactGroupFormComponent)
    );
    formComponent.triggerEventHandler('cancel');
    await fixture.whenStable();

    expect(mockContactsService.saveGroup).not.toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/contacts'], {
      queryParams: { tab: 'groups' },
    });
  });
});