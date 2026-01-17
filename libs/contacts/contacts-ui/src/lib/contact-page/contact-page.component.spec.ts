import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactPageComponent } from './contact-page.component';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { URN } from '@nx-platform-application/platform-types';
import { Contact } from '@nx-platform-application/contacts-types';
import { ContactsStateService } from '@nx-platform-application/contacts-state';

// MATERIAL MOCKS
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';

// NG-MOCKS
import { MockComponent } from 'ng-mocks';
import { ContactFormComponent } from '../contact-page-form/contact-form.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';

const mockUrnString = 'urn:contacts:user:123';
const mockUrn = URN.parse(mockUrnString);

const mockContact: Contact = {
  id: mockUrn,
  alias: 'Test User',
} as any;

describe('ContactPageComponent', () => {
  let fixture: ComponentFixture<ContactPageComponent>;
  let component: ContactPageComponent;
  let stateService: any;
  let snackBar: any;
  let dialog: any;

  // Helper to setup the module with specific route params
  const setupModule = async (routeId: string | null) => {
    stateService = {
      saveContact: vi.fn().mockResolvedValue(undefined),
      deleteContact: vi.fn().mockResolvedValue(undefined),
      getContact: vi.fn().mockResolvedValue(mockContact),
      getLinkedIdentities: vi.fn().mockResolvedValue([]),
      getGroupsForContact: vi.fn().mockResolvedValue([]),
    };

    snackBar = { open: vi.fn() };

    dialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(true),
      }),
    };

    await TestBed.configureTestingModule({
      imports: [
        ContactPageComponent,
        MockComponent(ContactFormComponent),
        MockComponent(ContactsPageToolbarComponent),
      ],
      providers: [
        { provide: ContactsStateService, useValue: stateService },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: MatDialog, useValue: dialog },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap(routeId ? { id: routeId } : {})),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  describe('Data Resolution', () => {
    it('should resolve contactId from Route when Input is missing', async () => {
      await setupModule(mockUrnString);
      expect(component.contactId()?.urn.toString()).toBe(mockUrnString);
      expect(component.contactId()?.isNew).toBe(false);
    });

    it('should prioritize selectedUrn Input over Route', async () => {
      await setupModule(mockUrnString);
      const inputUrn = URN.parse('urn:contacts:user:999');
      fixture.componentRef.setInput('selectedUrn', inputUrn);
      fixture.detectChanges();

      expect(component.contactId()?.urn.toString()).toBe(inputUrn.toString());
    });

    it('should default to NEW mode if Route has no ID', async () => {
      await setupModule(null); // No ID in route
      expect(component.contactId()?.isNew).toBe(true);
    });
  });

  describe('Save Logic', () => {
    it('should call state.saveContact and show "updated" SnackBar for existing contact', async () => {
      await setupModule(mockUrnString); // Existing

      const emitSpy = vi.spyOn(component.saved, 'emit');
      await component.onSave(mockContact);

      expect(stateService.saveContact).toHaveBeenCalledWith(mockContact);
      expect(snackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('updated'),
        expect.any(String),
        expect.any(Object),
      );
      expect(emitSpy).toHaveBeenCalledWith(mockContact);
    });

    it('should show "created" SnackBar for new contact', async () => {
      await setupModule(null); // New

      await component.onSave(mockContact);

      expect(snackBar.open).toHaveBeenCalledWith(
        expect.stringContaining('created'),
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  describe('Delete Logic', () => {
    beforeEach(async () => {
      await setupModule(mockUrnString);
    });

    it('should open Confirmation Dialog', async () => {
      await component.onDelete();
      expect(dialog.open).toHaveBeenCalledWith(
        ConfirmationDialogComponent,
        expect.any(Object),
      );
    });

    it('should call state.deleteContact and emit (deleted) if confirmed', async () => {
      const deleteSpy = vi.spyOn(component.deleted, 'emit');
      await component.onDelete();

      expect(stateService.deleteContact).toHaveBeenCalledWith(mockContact.id);
      expect(deleteSpy).toHaveBeenCalled();
    });

    it('should NOT delete if dialog cancelled', async () => {
      dialog.open.mockReturnValue({ afterClosed: () => of(false) });
      const deleteSpy = vi.spyOn(component.deleted, 'emit');

      await component.onDelete();

      expect(stateService.deleteContact).not.toHaveBeenCalled();
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });
});
