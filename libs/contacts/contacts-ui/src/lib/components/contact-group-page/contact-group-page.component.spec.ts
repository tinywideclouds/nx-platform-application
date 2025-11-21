// libs/contacts/contacts-ui/src/lib/components/contact-group-page/contact-group-page.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-access';
import { URN } from '@nx-platform-application/platform-types';
import { Subject } from 'rxjs';
import { By } from '@angular/platform-browser';

import { ContactGroupPageComponent } from './contact-group-page.component';
import { ContactGroupFormComponent } from '../contact-group-page-form/contact-group-form.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

// --- Mocks & Fixtures ---
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
  } as Contact,
];

const MOCK_GROUP: ContactGroup = {
  id: mockGroupUrn,
  name: 'Test Group',
  description: 'A test group',
  contactIds: [mockContactUrn],
};

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

describe('ContactGroupPageComponent', () => {
  let fixture: ComponentFixture<ContactGroupPageComponent>;
  let component: ContactGroupPageComponent;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockContactsService.getGroup.mockResolvedValue(MOCK_GROUP);
    mockContactsService.saveGroup.mockResolvedValue(undefined);
    mockContactsService.contacts$ = new Subject<Contact[]>();

    await TestBed.configureTestingModule({
      imports: [
        ContactGroupPageComponent,
        ContactsPageToolbarComponent,
        NoopAnimationsModule
      ],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
        { provide: Router, useValue: mockRouter },
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
    // 1. Set inputs (undefined is default, but being explicit)
    fixture.componentRef.setInput('groupId', undefined);
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    
    fixture.detectChanges();
    await fixture.whenStable(); // Wait for effects/observables

    expect(mockContactsService.getGroup).not.toHaveBeenCalled();
    expect(component.groupToEdit()).toBeTruthy();
    
    // Check it generated a new URN
    const group = component.groupToEdit()!;
    expect(group.id.toString()).toContain('urn:sm:group:');
    expect(group.name).toBe('');
    expect(component.startInEditMode()).toBe(true);
  });

  it('should be in EDIT MODE if groupId is provided', async () => {
    // 1. Set inputs with a specific URN
    fixture.componentRef.setInput('groupId', mockGroupUrn);
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    
    fixture.detectChanges();
    await fixture.whenStable();

    // 2. Verify service call
    expect(mockContactsService.getGroup).toHaveBeenCalledWith(mockGroupUrn);
    
    // 3. Verify state
    expect(component.groupToEdit()).toEqual(MOCK_GROUP);
    expect(component.startInEditMode()).toBe(false);
  });

  it('should call saveGroup and navigate on (save) event', async () => {
    // Setup Add Mode
    fixture.componentRef.setInput('groupId', undefined);
    mockContactsService.contacts$!.next(MOCK_CONTACTS);
    fixture.detectChanges();
    await fixture.whenStable();

    const formComponent = fixture.debugElement.query(
      By.directive(ContactGroupFormComponent)
    );
    
    // Trigger save event from child
    formComponent.triggerEventHandler('save', MOCK_GROUP);
    await fixture.whenStable();

    expect(mockContactsService.saveGroup).toHaveBeenCalledWith(MOCK_GROUP);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/contacts'], {
      queryParams: { tab: 'groups' },
      queryParamsHandling: 'merge'
    });
  });
});