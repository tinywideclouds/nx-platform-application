import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { ContactFormComponent } from './contact-form.component';
import { Contact } from '@nx-platform-application/contacts-data-access';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

// --- Fixtures ---
const mockContact: Contact = {
  id: 'user-123',
  alias: 'johndoe',
  email: 'john@example.com',
  firstName: 'John',
  surname: 'Doe',
  phoneNumbers: ['+15550100'],
  emailAddresses: ['john@work.com'],
  serviceContacts: {
    messenger: {
      id: 'msg-uuid-1',
      alias: 'jd_messenger',
      lastSeen: '2023-01-01T12:00:00Z' as ISODateTimeString,
    },
  },
  isFavorite: true,
};

describe('ContactFormComponent (Signal-based)', () => {
  let fixture: ComponentFixture<ContactFormComponent>;
  let component: ContactFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactFormComponent, ReactiveFormsModule],
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
    // The effect runs in the constructor, setting defaults
    expect(component.contact()).toBeNull();
    expect(component.form.value.firstName).toBe('');
    expect(component.form.value.id).toBe('');
  });

  it('should be in "edit mode" and patch the form when contact input is set', () => {
    // Act: Set the signal input
    fixture.componentRef.setInput('contact', mockContact);
    fixture.detectChanges(); // Trigger the effect

    // Assert
    expect(component.form.value.firstName).toBe('John');
    expect(component.form.value.surname).toBe('Doe');
    expect(component.phoneNumbers.length).toBe(1);
    expect(component.phoneNumbers.at(0).value).toBe('+15550100');
  });

  it('should dynamically add a phone number field', () => {
    expect(component.phoneNumbers.length).toBe(0);
    const addButton = fixture.debugElement.query(By.css('[data-testid="add-phone"]')).nativeElement;
    
    addButton.click();
    fixture.detectChanges();

    expect(component.phoneNumbers.length).toBe(1);
  });

  it('should dynamically remove a phone number field', () => {
    // Arrange
    fixture.componentRef.setInput('contact', mockContact);
    fixture.detectChanges();
    expect(component.phoneNumbers.length).toBe(1);

    // Act
    const removeButton = fixture.debugElement.query(By.css('[data-testid="remove-phone"]')).nativeElement;
    removeButton.click();
    fixture.detectChanges();

    // Assert
    expect(component.phoneNumbers.length).toBe(0);
  });

  it('should emit (save) with the form data when "Save" is clicked', () => {
    const saveSpy = vi.spyOn(component.save, 'emit');

    // Act: Set form to valid state
    component.form.patchValue({
      firstName: 'Test',
      surname: 'User',
      alias: 'testy',
      email: 'test@user.com',
    });
    fixture.detectChanges();

    const saveButton = fixture.debugElement.query(By.css('[data-testid="save-button"]')).nativeElement;
    saveButton.click();

    // Assert
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ firstName: 'Test' })
    );
  });

  it('should preserve non-form fields (like serviceContacts) on save', () => {
    const saveSpy = vi.spyOn(component.save, 'emit');
    
    // Arrange: Set the contact, effect runs, form is valid
    fixture.componentRef.setInput('contact', mockContact);
    fixture.detectChanges();

    // Act: Change one value
    component.form.patchValue({ firstName: 'Johnny' });
    fixture.detectChanges();

    const saveButton = fixture.debugElement.query(By.css('[data-testid="save-button"]')).nativeElement;
    saveButton.click();

    // Assert
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Johnny',
        id: 'user-123',
        serviceContacts: mockContact.serviceContacts,
      })
    );
  });

  it('should emit (cancel) when "Cancel" is clicked', () => {
    const cancelSpy = vi.spyOn(component.cancel, 'emit');
    const cancelButton = fixture.debugElement.query(By.css('[data-testid="cancel-button"]')).nativeElement;
    
    cancelButton.click();
    expect(cancelSpy).toHaveBeenCalled();
  });
});