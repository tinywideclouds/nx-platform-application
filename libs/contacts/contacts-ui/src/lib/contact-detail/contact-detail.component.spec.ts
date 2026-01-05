import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ContactDetailComponent } from './contact-detail.component';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { Contact } from '@nx-platform-application/contacts-types';
import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';
import { MockComponent } from 'ng-mocks';
import { ContactFormComponent } from '../contact-page-form/contact-form.component';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';

const mockUrn = URN.parse('urn:contacts:user:123');
const mockContact: Contact = {
  id: mockUrn,
  alias: 'Test User',
  email: 'test@example.com',
  firstName: 'Test',
  surname: 'User',
  phoneNumbers: [],
  emailAddresses: [],
  serviceContacts: {},
  lastModified: '' as ISODateTimeString,
};

describe('ContactDetailComponent', () => {
  let fixture: ComponentFixture<ContactDetailComponent>;
  let component: ContactDetailComponent;
  let stateService: ContactsStateService;
  let dialog: MatDialog;

  // Define variables for fresh initialization
  let mockStateService: any;
  let mockDialogRef: { afterClosed: any };

  beforeEach(async () => {
    // ✅ FRESH STATE FOR EVERY TEST
    mockDialogRef = { afterClosed: vi.fn() };

    mockStateService = {
      getContact: vi.fn().mockResolvedValue(mockContact),
      saveContact: vi.fn().mockResolvedValue(undefined),
      deleteContact: vi.fn().mockResolvedValue(undefined),
      getLinkedIdentities: vi.fn().mockResolvedValue([]),
      getGroupsForContact: vi.fn().mockResolvedValue([]),
    };

    await TestBed.configureTestingModule({
      imports: [ContactDetailComponent, MockComponent(ContactFormComponent)],
      providers: [
        { provide: ContactsStateService, useValue: mockStateService },
        {
          provide: MatDialog,
          useValue: {
            open: vi.fn().mockReturnValue(mockDialogRef),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactDetailComponent);
    component = fixture.componentInstance;
    stateService = TestBed.inject(ContactsStateService);
    dialog = TestBed.inject(MatDialog);

    // Set input using the Modern Angular API
    fixture.componentRef.setInput('contactId', mockUrn);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch contact and display form', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    expect(stateService.getContact).toHaveBeenCalledWith(mockUrn);
    const form = fixture.debugElement.query(By.directive(ContactFormComponent));
    expect(form).toBeTruthy();
  });

  it('should emit saved event on save', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const spy = vi.spyOn(component.saved, 'emit');

    const form = fixture.debugElement.query(By.directive(ContactFormComponent));
    form.componentInstance.save.emit(mockContact);
    await fixture.whenStable();

    expect(stateService.saveContact).toHaveBeenCalledWith(mockContact);
    expect(spy).toHaveBeenCalledWith(mockContact);
  });

  it('should open confirmation dialog on delete request', async () => {
    // Setup specific to this test
    mockDialogRef.afterClosed.mockReturnValue(of(true));
    const spy = vi.spyOn(component.deleted, 'emit');

    await component.onDelete();

    expect(dialog.open).toHaveBeenCalledWith(
      ConfirmationDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          confirmColor: 'warn',
          icon: 'delete',
        }),
      }),
    );
    expect(stateService.deleteContact).toHaveBeenCalledWith(mockContact.id);
    expect(spy).toHaveBeenCalled();
  });

  it('should abort delete if dialog is cancelled', async () => {
    // Setup specific to this test
    mockDialogRef.afterClosed.mockReturnValue(of(false));
    const spy = vi.spyOn(component.deleted, 'emit');

    await component.onDelete();

    // Verify dialog opened but logic stopped
    expect(dialog.open).toHaveBeenCalled();
    expect(stateService.deleteContact).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
  });
});
