import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ContactDetailComponent } from './contact-detail.component';
import {
  ContactsStorageService,
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-storage';
import { URN } from '@nx-platform-application/platform-types';
import { MockComponent, MockProvider } from 'ng-mocks';
import { ContactFormComponent } from '../contact-page-form/contact-form.component';
import { MatChipsModule } from '@angular/material/chips';

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

describe('ContactDetailComponent', () => {
  let fixture: ComponentFixture<ContactDetailComponent>;
  let component: ContactDetailComponent;
  let service: ContactsStorageService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ContactDetailComponent,
        MockComponent(ContactFormComponent),
        // We can mock MatChipsModule too if we want to be pure unit, but it's often lightweight enough
        // Mocking it is safer for "dumb" DOM tests
      ],
      providers: [
        MockProvider(ContactsStorageService, {
          getContact: vi.fn().mockResolvedValue(mockContact),
          saveContact: vi.fn().mockResolvedValue(undefined),
          getLinkedIdentities: vi.fn().mockResolvedValue([]),
          getGroupsForContact: vi.fn().mockResolvedValue([mockGroup]),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactDetailComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(ContactsStorageService);

    fixture.componentRef.setInput('contactId', mockUrn);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch contact and display form', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    expect(service.getContact).toHaveBeenCalledWith(mockUrn);
    const form = fixture.debugElement.query(By.directive(ContactFormComponent));
    expect(form).toBeTruthy();
  });

  it('should emit saved event on save', async () => {
    await fixture.whenStable();
    fixture.detectChanges();

    const spy = vi.spyOn(component.saved, 'emit');

    // Simulate Output from Mock Child
    const form = fixture.debugElement.query(By.directive(ContactFormComponent));
    form.componentInstance.save.emit(mockContact);

    await fixture.whenStable();

    expect(service.saveContact).toHaveBeenCalledWith(mockContact);
    expect(spy).toHaveBeenCalledWith(mockContact);
  });
});
