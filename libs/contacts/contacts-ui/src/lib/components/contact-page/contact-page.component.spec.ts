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
import { ISODateTimeString } from '@nx-platform-application/platform-types';

// --- NEW IMPORTS ---
import { RouterTestingModule } from '@angular/router/testing';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

// --- Fixtures ---
const mockContact: Contact = {
  id: 'user-123',
  alias: 'testuser',
  email: 'test@example.com',
  firstName: 'Test',
  surname: 'User',
  phoneNumbers: ['+15550100'],
  emailAddresses: ['test@example.com'],
  serviceContacts: {},
  isFavorite: false,
} as Contact;

const MOCK_GROUP: ContactGroup = {
  id: 'grp-123',
  name: 'Test Group',
  contactIds: ['user-123'],
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

// REMOVED: const mockRouter

const mockActivatedRoute = {
  paramMap: new Subject(),
};

describe('ContactPageComponent (RxJS-based)', () => {
  let fixture: ComponentFixture<ContactPageComponent>;
  let component: ContactPageComponent;
  let router: Router; // Will hold the real router

  beforeEach(async () => {
    vi.clearAllMocks();
    mockContactsService.getContact.mockResolvedValue(mockContact);
    mockContactsService.saveContact.mockResolvedValue(undefined);
    mockContactsService.getGroupsForContact.mockResolvedValue([MOCK_GROUP]);

    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule.withRoutes([]), // 1. Add router testing module
        NoopAnimationsModule, // 2. Add animations module
        ContactPageComponent,
        ContactFormComponent,
        ContactsPageToolbarComponent, // 3. Import the toolbar
      ],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
        // 4. REMOVED: Mock router provider
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactPageComponent);
    component = fixture.componentInstance;
    
    // 5. Inject the real router and spy on it
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
    expect(component.contactToEdit()?.id).toContain('urn:sm:user:');
  });

  it('should be in EDIT MODE', async () => {
    mockActivatedRoute.paramMap.next({ get: () => 'user-123' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockContactsService.getContact).toHaveBeenCalledWith('user-123');
    expect(component.contactToEdit()).toEqual(mockContact);
  });

  it('should fetch and display groups for the contact in EDIT MODE', async () => {
    mockActivatedRoute.paramMap.next({ get: () => 'user-123' });
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.whenStable(); // Wait for derived stream
    fixture.detectChanges();

    expect(mockContactsService.getGroupsForContact).toHaveBeenCalledWith(
      'user-123'
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
    formComponent.triggerEventHandler('save', mockContact);
    await fixture.whenStable();

    expect(mockContactsService.saveContact).toHaveBeenCalledWith(mockContact);
    expect(router.navigate).toHaveBeenCalledWith(['/contacts'], {
      queryParams: { tab: 'contacts' },
    });
  });

});