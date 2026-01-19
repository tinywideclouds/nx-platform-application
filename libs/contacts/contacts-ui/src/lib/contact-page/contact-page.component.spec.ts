import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactPageComponent } from './contact-page.component';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { ContactFormComponent } from '../contact-page-form/contact-form.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { MockProvider } from 'ng-mocks';
import { of, BehaviorSubject } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import { Contact } from '@nx-platform-application/contacts-types';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { By } from '@angular/platform-browser';
import { Component, signal, input, output, forwardRef } from '@angular/core';

// --- MANUAL MOCKS ---

@Component({
  selector: 'contacts-page-toolbar',
  template: '<ng-content></ng-content>',
  standalone: true,
  exportAs: 'contactsPageToolbar',
})
class MockToolbarComponent {
  mode = signal<'full' | 'compact'>('full');
  title = input<string>('');
}

@Component({
  selector: 'contacts-form',
  standalone: true,
  template: '',
  // CRITICAL FIX: This Provider tricks the @ViewChild(ContactFormComponent)
  // into accepting this Mock Class as the real token.
  providers: [
    {
      provide: ContactFormComponent,
      useExisting: forwardRef(() => MockContactFormComponent),
    },
  ],
})
class MockContactFormComponent {
  contact = input.required<Contact>();
  linkedIdentities = input<any[]>([]);
  isEditing = input<boolean>(false);
  isNew = input<boolean>(false);

  errorsChange = output<number>();
  save = output<Contact>();
  delete = output<void>();

  // Use vi.fn() so we can spy on it later
  triggerSave = vi.fn();
}

describe('ContactPageComponent', () => {
  let component: ContactPageComponent;
  let fixture: ComponentFixture<ContactPageComponent>;
  let stateService: ContactsStateService;
  let dialog: MatDialog;
  let snackBar: MatSnackBar;

  const paramsSubject = new BehaviorSubject(convertToParamMap({}));
  const queryParamsSubject = new BehaviorSubject(convertToParamMap({}));

  const mockContact: Contact = {
    id: URN.create('user', '123', 'contacts'),
    alias: 'Test User',
    firstName: 'Test',
    surname: 'User',
    email: 'test@test.com',
    phoneNumber: '',
    emailAddresses: [],
    phoneNumbers: [],
    lastModified: '' as any,
    serviceContacts: {},
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContactPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramsSubject.asObservable(),
            queryParamMap: queryParamsSubject.asObservable(),
          },
        },
        MockProvider(ContactsStateService, {
          getContact: vi.fn().mockResolvedValue(mockContact),
          getLinkedIdentities: vi.fn().mockResolvedValue([]),
          getGroupsForContact: vi.fn().mockResolvedValue([]),
          saveContact: vi.fn().mockResolvedValue(undefined),
          deleteContact: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(MatSnackBar, { open: vi.fn() }),
        MockProvider(MatDialog, {
          open: vi.fn().mockReturnValue({ afterClosed: () => of(true) }),
        }),
      ],
    })
      .overrideComponent(ContactPageComponent, {
        remove: {
          imports: [ContactFormComponent, ContactsPageToolbarComponent],
        },
        add: {
          imports: [MockContactFormComponent, MockToolbarComponent],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ContactPageComponent);
    component = fixture.componentInstance;
    stateService = TestBed.inject(ContactsStateService);
    dialog = TestBed.inject(MatDialog);
    snackBar = TestBed.inject(MatSnackBar);
  });

  function setQueryParams(params: Record<string, string>) {
    queryParamsSubject.next(convertToParamMap(params));
  }

  describe('State Logic', () => {
    it('should derive "New" state', async () => {
      fixture.componentRef.setInput('selectedUrn', undefined);
      setQueryParams({});
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.isNew()).toBe(true);
      expect(component.isEditMode()).toBe(true);
    });

    it('should derive "Edit" state via Query Params', async () => {
      fixture.componentRef.setInput('selectedUrn', mockContact.id);
      setQueryParams({ mode: 'edit' });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.isNew()).toBe(false);
      expect(component.isEditMode()).toBe(true);
    });
  });

  describe('Child Orchestration', () => {
    beforeEach(async () => {
      fixture.componentRef.setInput('selectedUrn', mockContact.id);
      setQueryParams({ mode: 'edit' });

      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    });

    it('should capture validation errors from Child Form via Output', () => {
      const formDebugEl = fixture.debugElement.query(
        By.directive(MockContactFormComponent),
      );
      const formInstance =
        formDebugEl.componentInstance as MockContactFormComponent;

      formInstance.errorsChange.emit(5);
      fixture.detectChanges();

      expect(component.formErrorCount()).toBe(5);
    });

    it('should trigger Child Form Save when triggerFormSave is called', () => {
      const formDebugEl = fixture.debugElement.query(
        By.directive(MockContactFormComponent),
      );
      const formInstance =
        formDebugEl.componentInstance as MockContactFormComponent;

      // Ensure the ViewChild was successfully resolved by Angular
      // If this fails, the 'providers' fix in the mock is incorrect
      expect(component.formComponent).toBeTruthy();

      component.triggerFormSave();

      expect(formInstance.triggerSave).toHaveBeenCalled();
    });
  });

  describe('Service Interactions', () => {
    it('should save via service', async () => {
      const updated = { ...mockContact, firstName: 'Updated' };
      const emitSpy = vi.spyOn(component.saved, 'emit');

      await component.onSave(updated);

      expect(stateService.saveContact).toHaveBeenCalledWith(updated);
      expect(snackBar.open).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith(updated);
    });

    it('should delete via service', async () => {
      fixture.componentRef.setInput('selectedUrn', mockContact.id);
      fixture.detectChanges();
      await fixture.whenStable();

      const emitSpy = vi.spyOn(component.deleted, 'emit');

      await component.onDelete();

      expect(dialog.open).toHaveBeenCalled();
      expect(stateService.deleteContact).toHaveBeenCalledWith(mockContact.id);
      expect(emitSpy).toHaveBeenCalled();
    });
  });
});
