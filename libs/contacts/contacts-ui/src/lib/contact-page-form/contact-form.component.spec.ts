import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactFormComponent } from './contact-form.component';
import { Contact } from '@nx-platform-application/contacts-types';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { EditableListComponent } from '@nx-platform-application/platform-ui-forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Component, input, output } from '@angular/core';

// [OPTIMIZATION] Define Mock Class statically to avoid JIT overhead in beforeEach
@Component({
  selector: 'lib-editable-list',
  standalone: true,
  template: '',
})
class MockEditableListComponent {
  label = input<string>('');
  items = input<string[]>([]);
  itemsChange = output<string[]>();
  readonly = input<boolean>(false);
  schema = input<any>();
}

const mockContact: Contact = {
  id: URN.parse('urn:contacts:user:user-123'),
  alias: 'johndoe',
  email: 'john@example.com',
  firstName: 'John',
  surname: 'Doe',
  lastModified: '2024-01-01T00:00:00Z' as ISODateTimeString,
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: {},
};

describe('ContactFormComponent (Passive Architecture)', () => {
  let fixture: ComponentFixture<ContactFormComponent>;
  let component: ContactFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactFormComponent, NoopAnimationsModule],
    })
      .overrideComponent(ContactFormComponent, {
        remove: { imports: [EditableListComponent] },
        add: { imports: [MockEditableListComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ContactFormComponent);
    component = fixture.componentInstance;

    // Mock ElementRef for focus management
    fixture.nativeElement.querySelector = vi
      .fn()
      .mockReturnValue({ focus: vi.fn() });

    // Initialize Inputs
    fixture.componentRef.setInput('contact', mockContact);
    fixture.componentRef.setInput('isEditing', true);
    fixture.componentRef.setInput('isNew', false);

    // [OPTIMIZATION] detectChanges() is enough for Signals.
    // removed: await fixture.whenStable();
    fixture.detectChanges();
  });

  describe('Initialization', () => {
    it('should initialize signals from contact input', () => {
      expect(component.firstName()).toBe('John');
      expect(component.email()).toBe('john@example.com');
    });

    it('should emit error count when validation state changes', () => {
      const errorSpy = vi.spyOn(component.errorsChange, 'emit');

      // 1. Trigger INVALID state
      component.email.set('invalid-email');
      fixture.detectChanges();

      expect(errorSpy).toHaveBeenCalledWith(1);

      // 2. Trigger VALID state
      component.email.set('valid@test.com');
      fixture.detectChanges();

      expect(errorSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('Breadcrumb Logic (Modification)', () => {
    it('should mark field as modified when value differs from original', () => {
      expect(component.firstNameModified()).toBe(false);

      component.firstName.set('Jonathan');
      fixture.detectChanges();

      expect(component.firstNameModified()).toBe(true);
    });

    it('should SUPPRESS modification flag if isNew is true', async () => {
      fixture.componentRef.setInput('isNew', true);
      fixture.detectChanges();

      component.firstName.set('Jonathan');
      fixture.detectChanges();

      expect(component.firstNameModified()).toBe(false);
    });
  });

  describe('Validation & Saving (The Active Save)', () => {
    it('should emit (save) when valid and triggerSave() is called', () => {
      const saveSpy = vi.spyOn(component.save, 'emit');

      component.email.set('valid@test.com');
      fixture.detectChanges();

      component.triggerSave();

      expect(component.isValid()).toBe(true);
      expect(saveSpy).toHaveBeenCalled();
    });

    it('should NOT emit (save) when invalid', () => {
      const saveSpy = vi.spyOn(component.save, 'emit');

      component.email.set('not-an-email');
      fixture.detectChanges();

      component.triggerSave();

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('should mark all fields as touched when triggerSave() is called', () => {
      expect(component.firstNameTouched()).toBe(false);

      component.triggerSave();

      expect(component.firstNameTouched()).toBe(true);
    });
  });
});
