import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { Subject, of } from 'rxjs';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { By } from '@angular/platform-browser';

import { ContactGroupPageComponent } from './contact-group-page.component';
import { ContactGroupFormComponent } from '../contact-group-page-form/contact-group-form.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

//  NG-MOCKS & MATERIAL PROTOCOL
import { MockProvider, MockComponent } from 'ng-mocks';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';

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

  const setupModule = async (routeId: string | null) => {
    stateService = {
      getGroup: vi.fn(),
      saveGroup: vi.fn(),
      deleteGroup: vi.fn(),
      getGroupsByParent: vi.fn().mockResolvedValue([]),
      contacts$: new Subject<Contact[]>(),
    };

    // [cite: 167] Strict MatDialog Mocking
    dialogSpy = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(true),
      }),
    };

    snackBarSpy = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [
        ContactGroupPageComponent, // Standalone
        NoopAnimationsModule,
        MockComponent(ContactGroupFormComponent),
        MockComponent(ContactsPageToolbarComponent),
      ],
      providers: [
        { provide: ContactsStateService, useValue: stateService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap(routeId ? { id: routeId } : {})),
          },
        },
        MockProvider(MatDialog, dialogSpy),
        MockProvider(MatSnackBar, snackBarSpy),
      ],
    })
      //  Strict Module Removal
      .overrideComponent(ContactGroupPageComponent, {
        remove: { imports: [MatDialogModule] },
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

    it('should initialize in VIEW mode (isEditing = false)', () => {
      expect(component.isEditing()).toBe(false);
    });

    it('should switch to EDIT mode when enableEditMode is called', () => {
      component.enableEditMode();
      expect(component.isEditing()).toBe(true);
    });

    it('should emit (saved) and exit EDIT mode on save', async () => {
      // Setup
      component.isEditing.set(true);
      fixture.detectChanges();

      stateService.saveGroup.mockResolvedValue(undefined);
      const spy = vi.spyOn(component.saved, 'emit');

      // Act
      await component.onSave(MOCK_GROUP);

      // Assert
      expect(stateService.saveGroup).toHaveBeenCalledWith(MOCK_GROUP);
      expect(component.isEditing()).toBe(false); // [Check: Lifted State update]
      expect(spy).toHaveBeenCalledWith(MOCK_GROUP);
    });

    it('should emit (saved) when delete confirmed', async () => {
      stateService.deleteGroup.mockResolvedValue(undefined);
      const spy = vi.spyOn(component.deleted, 'emit');

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

    it('should default to EDIT mode for new groups', () => {
      expect(component.resolvedId()?.isNew).toBe(true);
      expect(component.isEditing()).toBe(true);
    });
  });
});
