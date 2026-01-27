import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { Subject, of } from 'rxjs';
import { ActivatedRoute, convertToParamMap } from '@angular/router';

import { ContactGroupPageComponent } from './contact-group.component';
import { ContactGroupFormComponent } from '../contact-group-form/contact-group-form.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { MockProvider, MockComponent } from 'ng-mocks';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

const mockContactUrn = URN.parse('urn:contacts:user:user-123');
const mockGroupUrn = URN.parse('urn:contacts:group:grp-123');

// ✅ FIX: V9 Schema
const MOCK_GROUP: ContactGroup = {
  id: mockGroupUrn,
  directoryId: undefined,
  name: 'Test Group',
  description: 'A test group',
  memberUrns: [mockContactUrn], // V9
  lastModified: '2025-01-01T00:00:00Z' as any,
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
      createGroup: vi.fn(),
      deleteGroup: vi.fn(),
      getGroupsByParent: vi.fn().mockResolvedValue([]),
      contacts$: new Subject<Contact[]>(),
    };

    dialogSpy = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(true),
      }),
    };

    snackBarSpy = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [
        ContactGroupPageComponent,
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

    it('should emit (saved) and exit EDIT mode on save', async () => {
      component.isEditing.set(true);
      fixture.detectChanges();

      stateService.saveGroup.mockResolvedValue(undefined);
      const spy = vi.spyOn(component.saved, 'emit');

      await component.onSave(MOCK_GROUP);

      expect(stateService.saveGroup).toHaveBeenCalledWith(MOCK_GROUP);
      expect(component.isEditing()).toBe(false);
      expect(spy).toHaveBeenCalledWith(MOCK_GROUP);
    });
  });

  describe('New Group', () => {
    beforeEach(async () => {
      await setupModule(null);
      fixture.detectChanges();
    });

    it('should call createGroup on save', async () => {
      // Setup
      component.isEditing.set(true);
      fixture.detectChanges();

      const newGroup = { ...MOCK_GROUP, memberUrns: [] };
      stateService.createGroup.mockResolvedValue(mockGroupUrn);

      // Act
      await component.onSave(newGroup);

      // Assert
      // ✅ FIX: Expect memberUrns (empty array)
      expect(stateService.createGroup).toHaveBeenCalledWith(
        newGroup.name,
        newGroup.description,
        [],
      );
    });
  });
});
