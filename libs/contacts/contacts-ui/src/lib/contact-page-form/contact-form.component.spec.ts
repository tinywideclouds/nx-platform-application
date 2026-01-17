// libs/contacts/contacts-ui/src/lib/components/contact-page-form/contact-form.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ContactFormComponent } from './contact-form.component';
import { Contact } from '@nx-platform-application/contacts-types';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Temporal } from '@js-temporal/polyfill';

// MOCK DATA
const mockContact: Contact = {
  id: URN.parse('urn:contacts:user:user-123'),
  alias: 'johndoe',
  email: 'john@example.com',
  firstName: 'John',
  surname: 'Doe',
  lastModified: Temporal.Now.instant().toString() as ISODateTimeString,
  phoneNumbers: ['+15550100'],
  emailAddresses: ['john@work.com'],
  serviceContacts: {},
};

describe('ContactFormComponent (Signals)', () => {
  let fixture: ComponentFixture<ContactFormComponent>;
  let component: ContactFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactFormComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize signals from contact input', () => {
    fixture.componentRef.setInput('contact', mockContact);
    fixture.detectChanges();

    expect(component.firstName()).toBe('John');
    expect(component.email()).toBe('john@example.com');
    expect(component.phoneNumbers()).toEqual(['+15550100']);
  });

  it('should validate required fields (Traffic Light)', () => {
    component.isEditing.set(true);

    // 1. Empty & Untouched -> Amber (Pending)
    component.firstName.set('');
    component.firstNameTouched.set(false);
    fixture.detectChanges();

    expect(component.getStatusIcon('firstName')).toBe('priority_high');
    expect(component.getStatusColor('firstName')).toContain('text-amber-500');

    // 2. Empty & Touched -> Red (Error)
    component.firstNameTouched.set(true);
    fixture.detectChanges();

    expect(component.getStatusIcon('firstName')).toBe('error');
    expect(component.getStatusColor('firstName')).toContain('text-red-600');

    // 3. Valid -> Green (Success)
    component.firstName.set('Alice');
    fixture.detectChanges();

    expect(component.getStatusIcon('firstName')).toBe('check_circle');
    expect(component.getStatusColor('firstName')).toContain('text-green-600');
  });

  it('should disable save button when invalid', () => {
    fixture.componentRef.setInput('startInEditMode', true);
    fixture.detectChanges();

    // Invalid (empty)
    component.firstName.set('');
    fixture.detectChanges();

    const saveBtn = fixture.debugElement.query(
      By.css('[data-testid="save-button"]'),
    ).nativeElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('should manage array items (add/remove)', () => {
    fixture.componentRef.setInput('startInEditMode', true);
    fixture.detectChanges();

    // Add
    component.addPhoneNumber();
    expect(component.phoneNumbers().length).toBe(1);

    // Update
    component.updatePhoneNumber(0, '+123');
    expect(component.phoneNumbers()[0]).toBe('+123');

    // Remove
    component.removePhoneNumber(0);
    expect(component.phoneNumbers().length).toBe(0);
  });
});
