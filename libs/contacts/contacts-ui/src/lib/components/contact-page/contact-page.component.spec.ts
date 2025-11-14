import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { ContactEditPageComponent } from './contact-edit-page.component';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { ContactFormComponent } from '../contact-form/contact-form.component';
import { of, Subject } from 'rxjs';
import { By } from '@angular/platform-browser';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

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

const mockRouter = {
  navigate: vi.fn(),
};

const mockActivatedRoute = {
  paramMap: new Subject(),
};

describe('ContactEditPageComponent (RxJS-based)', () => {
  let fixture: ComponentFixture<ContactEditPageComponent>;
  let component: ContactEditPageComponent;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockContactsService.getContact.mockResolvedValue(mockContact);
    mockContactsService.saveContact.mockResolvedValue(undefined);
    mockContactsService.getGroupsForContact.mockResolvedValue([MOCK_GROUP]);

    await TestBed.configureTestingModule({
      imports: [ContactEditPageComponent, ContactFormComponent],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactEditPageComponent);
    component = fixture.componentInstance;
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

  // --- THIS IS THE FIXED TEST ---
  it('should fetch and display groups for the contact in EDIT MODE', async () => {
    // 1. Emit route param to trigger contactToEdit
    mockActivatedRoute.paramMap.next({ get: () => 'user-123' });
    fixture.detectChanges();
    
    // 2. Wait for getContact() promise
    await fixture.whenStable();
    
    // 3. Wait for the derived getGroupsForContact() promise
    await fixture.whenStable();
    fixture.detectChanges();

    // 4. Assert signal is set
    expect(mockContactsService.getGroupsForContact).toHaveBeenCalledWith('user-123');
    expect(component.groupsForContact()).toEqual([MOCK_GROUP]);

    // 5. Assert DOM is rendered
    const chips = fixture.nativeElement.querySelectorAll(
      '[data-testid="group-chip"]'
    );
    expect(chips.length).toBe(1); // This should no longer be null
    expect(chips[0].textContent).toContain('Test Group');
  });
  // --- END OF FIX ---

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
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/contacts'], {
      queryParams: { tab: 'contacts' },
    });
  });

  it('should navigate on (cancel) event', async () => {
    mockActivatedRoute.paramMap.next({ get: () => null });
    fixture.detectChanges();
    await fixture.whenStable();

    const formComponent = fixture.debugElement.query(
      By.directive(ContactFormComponent)
    );
    formComponent.triggerEventHandler('cancel');
    await fixture.whenStable();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/contacts'], {
      queryParams: { tab: 'contacts' },
    });
  });
});