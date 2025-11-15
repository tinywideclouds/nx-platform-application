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

import { ContactGroupPageComponent } from './contact-group-page.component';
import { ContactGroupFormComponent } from '../contact-group-page-form/contact-group-form.component';

// --- NEW IMPORTS ---
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';

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

// REMOVED: const mockRouter

const mockActivatedRoute = {
  paramMap: new Subject(),
};

describe('ContactGroupPageComponent', () => {
  let fixture: ComponentFixture<ContactGroupPageComponent>;
  let component: ContactGroupPageComponent;
  let router: Router; // Will hold the real router

  beforeEach(async () => {
    vi.clearAllMocks();
    mockContactsService.getGroup.mockResolvedValue(MOCK_GROUP);
    mockContactsService.saveGroup.mockResolvedValue(undefined);
    mockContactsService.contacts$ = new Subject<Contact[]>();

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([]), // 1. Add router testing module
        NoopAnimationsModule, // 2. Add animations module
        ContactGroupPageComponent,
        ContactsPageToolbarComponent, // 3. Import the toolbar
        // ContactGroupFormComponent is imported by the page component
      ],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
        // 4. THIS IS THE FIX: Removed the mock router provider
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactGroupPageComponent);
    component = fixture.componentInstance;

    // 5. Inject the real router and spy on it
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
    expect(component.groupToEdit()?.id).toContain('urn:sm:group:');
    expect(component.allContacts()).toEqual(MOCK_CONTACTS);
  });

  it('should be in EDIT MODE if :id is present', async () => {
    mockActivatedRoute.paramMap.next({ get: () => 'grp-123' });
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

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
    expect(router.navigate).toHaveBeenCalledWith(['/contacts'], {
      queryParams: { tab: 'groups' },
    });
  });

});