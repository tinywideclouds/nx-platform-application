// libs/contacts/contacts-ui/src/lib/components/contact-detail/contact-detail.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { ContactDetailComponent } from './contact-detail.component';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { URN } from '@nx-platform-application/platform-types';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ContactFormComponent } from '../contact-page-form/contact-form.component';

const mockUrn = URN.parse('urn:sm:user:123');
const mockContact: Contact = {
  id: mockUrn,
  alias: 'Test User',
  email: 'test@example.com',
  firstName: 'Test',
  surname: 'User',
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: {},
};
const mockGroup: ContactGroup = {
  id: URN.parse('urn:sm:group:456'),
  name: 'Test Group',
  contactIds: [mockUrn],
};

const mockContactsService = {
  getContact: vi.fn(),
  saveContact: vi.fn(),
  getLinkedIdentities: vi.fn(),
  getGroupsForContact: vi.fn(),
};

describe('ContactDetailComponent', () => {
  let fixture: ComponentFixture<ContactDetailComponent>;
  let component: ContactDetailComponent;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockContactsService.getContact.mockResolvedValue(mockContact);
    mockContactsService.saveContact.mockResolvedValue(undefined);
    mockContactsService.getLinkedIdentities.mockResolvedValue([]);
    mockContactsService.getGroupsForContact.mockResolvedValue([mockGroup]);

    await TestBed.configureTestingModule({
      imports: [ContactDetailComponent, NoopAnimationsModule],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactDetailComponent);
    component = fixture.componentInstance;
    
    fixture.componentRef.setInput('contactId', mockUrn);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch contact and display form', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockContactsService.getContact).toHaveBeenCalledWith(mockUrn);
    const form = fixture.debugElement.query(By.directive(ContactFormComponent));
    expect(form).toBeTruthy();
  });

  it('should emit saved event on save', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const spy = vi.spyOn(component.saved, 'emit');
    
    const form = fixture.debugElement.query(By.directive(ContactFormComponent));
    form.triggerEventHandler('save', mockContact);
    
    await fixture.whenStable();

    expect(mockContactsService.saveContact).toHaveBeenCalledWith(mockContact);
    expect(spy).toHaveBeenCalledWith(mockContact);
  });
});