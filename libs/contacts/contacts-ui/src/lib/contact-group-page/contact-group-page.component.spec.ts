import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { ContactsStateService } from '@nx-platform-application/contacts-state'; // ✅ Correct Service
import { Subject, of } from 'rxjs';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { ContactGroupPageComponent } from './contact-group-page.component';
import { ContactGroupFormComponent } from '../contact-group-page-form/contact-group-form.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

// ✅ IMPORT NG-MOCKS & MATERIAL
import { MockProvider } from 'ng-mocks';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';

// --- Mocks Data ---
const mockContactUrn = URN.parse('urn:contacts:user:user-123');
const mockGroupUrn = URN.parse('urn:contacts:group:grp-123');

const MOCK_CONTACTS: Contact[] = [
  {
    id: mockContactUrn,
    alias: 'johndoe',
  } as Contact,
];

const MOCK_GROUP: ContactGroup = {
  id: mockGroupUrn,
  name: 'Test Group',
  description: 'A test group',
  scope: 'local',
  members: [{ contactId: mockContactUrn, status: 'added' }],
};

describe('ContactGroupPageComponent', () => {
  let fixture: ComponentFixture<ContactGroupPageComponent>;
  let component: ContactGroupPageComponent;
  let stateService: any;
  let dialogSpy: any;
  let snackBarSpy: any;

  // Helper to re-configure for New vs Existing
  const setupModule = async (routeId: string | null) => {
    stateService = {
      getGroup: vi.fn(),
      saveGroup: vi.fn(),
      deleteGroup: vi.fn(),
      getGroupsByParent: vi.fn().mockResolvedValue([]),
      contacts$: new Subject<Contact[]>(),
    };

    // ✅ ROBUST SPY: Create the spy object explicitly
    dialogSpy = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(true), // Simulates "Yes"
      }),
    };

    snackBarSpy = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [
        ContactGroupPageComponent,
        ContactsPageToolbarComponent,
        NoopAnimationsModule,
      ],
      providers: [
        // Use the STATE service (not Storage) as that is what the component injects
        { provide: ContactsStateService, useValue: stateService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap(routeId ? { id: routeId } : {})),
          },
        },
        // ✅ USE MOCK PROVIDER
        MockProvider(MatDialog, dialogSpy),
        MockProvider(MatSnackBar, snackBarSpy),
      ],
    })
      .overrideComponent(ContactGroupPageComponent, {
        // ✅ STRIP REAL MODULES
        remove: { imports: [ContactGroupFormComponent, MatDialogModule] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ContactGroupPageComponent);
    component = fixture.componentInstance;
  };

  describe('Existing Group', () => {
    beforeEach(async () => {
      await setupModule(mockGroupUrn.toString());
      stateService.getGroup.mockResolvedValue(MOCK_GROUP);
      fixture.detectChanges();
    });

    it('should create and load group', () => {
      expect(component).toBeTruthy();
      expect(component.resolvedId()?.urn.toString()).toBe(
        mockGroupUrn.toString(),
      );
    });

    it('should emit (saved) and show "Updated" snackbar', async () => {
      stateService.saveGroup.mockResolvedValue(undefined);
      stateService.contacts$.next(MOCK_CONTACTS);
      const spy = vi.spyOn(component.saved, 'emit');

      await component.onSave(MOCK_GROUP);

      expect(stateService.saveGroup).toHaveBeenCalledWith(MOCK_GROUP);
      expect(snackBarSpy.open).toHaveBeenCalledWith(
        expect.stringContaining('updated'),
        expect.any(String),
        expect.any(Object),
      );
      expect(spy).toHaveBeenCalledWith(MOCK_GROUP);
    });

    it('should emit (saved) when delete confirmed', async () => {
      stateService.deleteGroup.mockResolvedValue(undefined);
      const spy = vi.spyOn(component.deleted, 'emit');

      // ✅ Uses the spy correctly now
      await component.onDelete({ recursive: false });

      expect(dialogSpy.open).toHaveBeenCalledWith(
        ConfirmationDialogComponent,
        expect.anything(),
      );
      expect(stateService.deleteGroup).toHaveBeenCalledWith(MOCK_GROUP.id);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('New Group', () => {
    beforeEach(async () => {
      await setupModule(null); // No ID in route
      fixture.detectChanges();
    });

    it('should default to New mode', () => {
      expect(component.resolvedId()?.isNew).toBe(true);
    });

    it('should show "Created" snackbar on save', async () => {
      stateService.saveGroup.mockResolvedValue(undefined);

      await component.onSave(MOCK_GROUP);

      expect(snackBarSpy.open).toHaveBeenCalledWith(
        expect.stringContaining('created'),
        expect.any(String),
        expect.any(Object),
      );
    });
  });
});
