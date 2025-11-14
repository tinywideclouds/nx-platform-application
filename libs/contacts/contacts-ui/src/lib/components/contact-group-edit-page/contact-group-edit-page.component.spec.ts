import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { Subject } from 'rxjs';
import { By } from '@angular/platform-browser';

import { ContactGroupEditPageComponent } from './contact-group-edit-page.component';
import { ContactGroupFormComponent } from '../contact-group-form/contact-group-form.component';

// --- Fixtures ---
// We need full contacts for the child form's dependencies
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
      // --- THIS IS THE FIX ---
      // 1. Declare the stream as null inside vi.hoisted()
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
    // Reset mocks
    vi.clearAllMocks();
    mockContactsService.getGroup.mockResolvedValue(MOCK_GROUP);
    mockContactsService.saveGroup.mockResolvedValue(undefined);

    // --- THIS IS THE FIX ---
    // 2. Assign the new Subject here, after imports are resolved.
    mockContactsService.contacts$ = new Subject<Contact[]>();

    await TestBed.configureTestingModule({
      // The page component is standalone and imports its own dependencies
      imports: [ContactGroupEditPageComponent],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactGroupEditPageComponent);
    component = fixture.componentInstance;
    // We call detectChanges() *after* emitting route/data in each test
  });

  it('should create', () => {
    // 1. Emit data
    mockActivatedRoute.paramMap.next({ get: () => null });
    mockContactsService.contacts$!.next([]); // Use ! because we know it's set
    // 2. Run change detection
    fixture.detectChanges();
    // 3. Assert
    expect(component).toBeTruthy();
  });

  it('should be in ADD MODE if no :id is present', async () => {
    // 1. Emit data
    mockActivatedRoute.paramMap.next({ get: () => null });
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    fixture.detectChanges();

    // 2. Wait for async operations (toSignal)
    await fixture.whenStable();
    fixture.detectChanges();

    // 3. Assert
    expect(mockContactsService.getGroup).not.toHaveBeenCalled();
    expect(component.groupToEdit()).toBeTruthy();
    expect(component.groupToEdit()?.id).toContain('urn:sm:group:');
    expect(component.allContacts()).toEqual(MOCK_CONTACTS);
  });

  it('should be in EDIT MODE if :id is present', async () => {
    // 1. Emit data
    mockActivatedRoute.paramMap.next({ get: () => 'grp-123' });
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    fixture.detectChanges();

    // 2. Wait for async operations
    await fixture.whenStable();
    fixture.detectChanges();

    // 3. Assert
    expect(mockContactsService.getGroup).toHaveBeenCalledWith('grp-123');
    expect(component.groupToEdit()).toEqual(MOCK_GROUP);
    expect(component.allContacts()).toEqual(MOCK_CONTACTS);
  });

  it('should call saveGroup and navigate on (save) event', async () => {
    // 1. Start in "add" mode
    mockActivatedRoute.paramMap.next({ get: () => null });
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // 2. Simulate the dumb form emitting the save event
    const formComponent = fixture.debugElement.query(
      By.directive(ContactGroupFormComponent)
    );
    formComponent.triggerEventHandler('save', MOCK_GROUP);

    // 3. Wait for the async onSave method
    await fixture.whenStable();

    // 4. Assert
    expect(mockContactsService.saveGroup).toHaveBeenCalledWith(MOCK_GROUP);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/contacts']);
  });

  it('should navigate on (cancel) event', async () => {
    // 1. Start in "add" mode
    mockActivatedRoute.paramMap.next({ get: () => null });
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // 2. Simulate the dumb form emitting the cancel event
    const formComponent = fixture.debugElement.query(
      By.directive(ContactGroupFormComponent)
    );
    formComponent.triggerEventHandler('cancel');

    // 3. Wait for the event handler
    await fixture.whenStable();

    // 4. Assert
    expect(mockContactsService.saveGroup).not.toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/contacts']);
  });
});