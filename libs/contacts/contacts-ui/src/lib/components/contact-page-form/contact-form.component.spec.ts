// libs/contacts/contacts-ui/src/lib/components/contact-page-form/contact-form.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { ContactFormComponent } from './contact-form.component';
import { Contact } from '@nx-platform-application/contacts-data-access';
// --- 1. Import URN and ISODateTimeString ---
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { NoopAnimationsModule } from '@angular/platform-browser/animations'; // <-- Import
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

// --- 2. Update Fixtures to use URNs ---
const mockContact: Contact = {
  id: URN.parse('urn:sm:user:user-123'),
  alias: 'johndoe',
  email: 'john@example.com',
  firstName: 'John',
  surname: 'Doe',
  phoneNumbers: ['+15550100'],
  emailAddresses: ['john@work.com'],
  serviceContacts: {
    messenger: {
      id: URN.parse('urn:sm:service:msg-uuid-1'),
      alias: 'jd_messenger',
      lastSeen: '2023-01-01T12:00:00Z' as ISODateTimeString,
    },
  },
  // isFavorite: true, <-- This property is not on the base Contact/User
};

describe('ContactFormComponent (Signal-based)', () => {
  let fixture: ComponentFixture<ContactFormComponent>;
  let component: ContactFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // --- 3. Import all necessary modules ---
      imports: [
        ContactFormComponent,
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatButtonModule,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactFormComponent);
    component = fixture.componentInstance;
    // NOTE: We call detectChanges() *once* to run the constructor effect
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be in "add mode" with an empty form on init', () => {
    expect(component.contact()).toBeNull();
    expect(component.form.value.firstName).toBe('');
    expect(component.form.value.id).toBe('');
    expect(component.isEditing()).toBe(false); // Default state
  });

  it('should be in "edit mode" and patch the form when contact input is set', () => {
    fixture.componentRef.setInput('contact', mockContact);
    fixture.detectChanges(); // Trigger the effect

    expect(component.form.value.firstName).toBe('John');
    expect(component.form.value.surname).toBe('Doe');
    expect(component.phoneNumbers.length).toBe(1);
    expect(component.phoneNumbers.at(0).value).toBe('+15550100');
  });

  it('should dynamically add a phone number field', () => {
    // 1. Set to editing mode
    component.isEditing.set(true);
    fixture.detectChanges();

    // 2. Assert initial state
    expect(component.phoneNumbers.length).toBe(0);
    const addButton = fixture.debugElement.query(
      By.css('[data-testid="add-phone"]')
    ).nativeElement;

    // 3. Act
    addButton.click();
    fixture.detectChanges();

    // 4. Assert final state
    expect(component.phoneNumbers.length).toBe(1);
  });

  it('should dynamically remove a phone number field', () => {
    // 1. Arrange: Set contact and enter edit mode
    fixture.componentRef.setInput('contact', mockContact);
    component.isEditing.set(true);
    fixture.detectChanges();
    expect(component.phoneNumbers.length).toBe(1);

    // 2. Act
    const removeButton = fixture.debugElement.query(
      By.css('[data-testid="remove-phone"]')
    ).nativeElement;
    removeButton.click();
    fixture.detectChanges();

    // 3. Assert
    expect(component.phoneNumbers.length).toBe(0);
  });

  it('should emit (save) with the form data when "Save" is clicked', () => {
    const saveSpy = vi.spyOn(component.save, 'emit');

    // 1. Act: Set form to valid state and enter edit mode
    component.isEditing.set(true);
    component.form.patchValue({
      firstName: 'Test',
      surname: 'User',
      alias: 'testy',
      email: 'test@user.com',
    });
    fixture.detectChanges();

    // 2. Find and click save button
    const saveButton = fixture.debugElement.query(
      By.css('[data-testid="save-button"]')
    ).nativeElement;
    saveButton.click();

    // 3. Assert
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Test' })
    );
  });

  it('should preserve non-form fields (like serviceContacts) on save', () => {
    const saveSpy = vi.spyOn(component.save, 'emit');

    // 1. Arrange: Set the contact and enter edit mode
    fixture.componentRef.setInput('contact', mockContact);
    component.isEditing.set(true);
    fixture.detectChanges();

    // 2. Act: Change one value
    component.form.patchValue({ firstName: 'Johnny' });
    fixture.detectChanges();

    const saveButton = fixture.debugElement.query(
      By.css('[data-testid="save-button"]')
    ).nativeElement;
    saveButton.click();

    // 3. Assert
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Johnny',
        id: mockContact.id, // <-- Check against the URN object
        serviceContacts: mockContact.serviceContacts,
      })
    );
  });

  it('should set isEditing to false when "Cancel" is clicked', () => {
    // 1. Arrange: Enter edit mode
    component.isEditing.set(true);
    fixture.detectChanges();
    expect(component.isEditing()).toBe(true);

    // 2. Act
    const cancelButton = fixture.debugElement.query(
      By.css('[data-testid="cancel-button"]')
    ).nativeElement;
    cancelButton.click();
    fixture.detectChanges();

    // 3. Assert: Internal state is changed
    expect(component.isEditing()).toBe(false);
  });

  it('should switch from view mode to edit mode when "Edit" is clicked', () => {
    // 1. Arrange: Should start in view mode
    fixture.componentRef.setInput('contact', mockContact);
    fixture.detectChanges();
    expect(component.isEditing()).toBe(false);

    // 2. Act
    const editButton = fixture.debugElement.query(
      By.css('[data-testid="edit-button"]')
    ).nativeElement;
    editButton.click();
    fixture.detectChanges();

    // 3. Assert
    expect(component.isEditing()).toBe(true);
  });
});