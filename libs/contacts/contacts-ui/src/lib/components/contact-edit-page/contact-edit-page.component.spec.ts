import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { ContactEditPageComponent } from './contact-edit-page.component';
import {
  ContactsStorageService,
  Contact,
} from '@nx-platform-application/contacts-data-access';
import { ContactFormComponent } from '../contact-form/contact-form.component';
import { of, Subject } from 'rxjs';
import { By } from '@angular/platform-browser';

// --- Fixtures (FIXED) ---
const mockContact: Contact = {
  id: 'user-123',
  alias: 'testuser',
  email: 'test@example.com',
  firstName: 'Test',
  surname: 'User',
  // These MUST be defined as arrays to prevent the .forEach error
  phoneNumbers: ['+15550100'],
  emailAddresses: ['test@example.com'],
  serviceContacts: {},
  isFavorite: false,
} as Contact; // 'as Contact' is fine to skip other base User properties

// --- Mocks ---
const mockContactsService = {
  getContact: vi.fn(),
  saveContact: vi.fn(),
};

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
    // Reset mocks
    mockContactsService.getContact.mockReset().mockResolvedValue(mockContact);
    mockContactsService.saveContact.mockReset().mockResolvedValue(undefined);
    mockRouter.navigate.mockReset();

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
    // Call detectChanges once to init
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be in ADD MODE if no :id is present', () => {
    // 1. Emit null from the paramMap (no ID)
    mockActivatedRoute.paramMap.next({ get: () => null });
    fixture.detectChanges();

    // 2. Assert
    expect(mockContactsService.getContact).not.toHaveBeenCalled();
    expect(component.contactToEdit()).toBeTruthy();
    expect(component.contactToEdit()?.id).toContain('urn:sm:user:');
  });

  it('should be in EDIT MODE if :id is present', async () => {
    // 1. Emit 'user-123' from the paramMap
    mockActivatedRoute.paramMap.next({ get: () => 'user-123' });
    fixture.detectChanges();

    // 2. Wait for async operations
    await fixture.whenStable();
    fixture.detectChanges();

    // 3. Assert
    expect(mockContactsService.getContact).toHaveBeenCalledWith('user-123');
    expect(component.contactToEdit()).toEqual(mockContact);
  });

  it('should call saveContact and navigate on (save) event', async () => {
    // 1. Start in "add" mode
    mockActivatedRoute.paramMap.next({ get: () => null });
    fixture.detectChanges();

    // 2. Simulate the dumb form emitting the save event
    const formComponent = fixture.debugElement.query(
      By.directive(ContactFormComponent)
    );
    formComponent.triggerEventHandler('save', mockContact);

    // 3. Wait for the async onSave method
    await fixture.whenStable();

    // 4. Assert
    expect(mockContactsService.saveContact).toHaveBeenCalledWith(mockContact);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/contacts']);
  });

  it('should navigate on (cancel) event', async () => {
    // 1. Start in "add" mode
    mockActivatedRoute.paramMap.next({ get: () => null });
    fixture.detectChanges();

    // 2. Simulate the dumb form emitting the cancel event
    const formComponent = fixture.debugElement.query(
      By.directive(ContactFormComponent)
    );
    formComponent.triggerEventHandler('cancel');

    // 3. Wait for the event handler
    await fixture.whenStable();

    // 4. Assert
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/contacts']);
  });
});