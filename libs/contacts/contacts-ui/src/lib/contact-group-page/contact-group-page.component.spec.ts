// libs/contacts/contacts-ui/src/lib/components/contact-group-page/contact-group-page.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ContactsStorageService } from '@nx-platform-application/contacts-storage';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { Subject, of } from 'rxjs';
import { By } from '@angular/platform-browser';

import { ContactGroupPageComponent } from './contact-group-page.component';
import { ContactGroupFormComponent } from '../contact-group-page-form/contact-group-form.component';
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

// ✅ IMPORT MODULE FOR REMOVAL
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';

// --- Mocks Data ---
const mockContactUrn = URN.parse('urn:contacts:user:user-123');
const mockGroupUrn = URN.parse('urn:contacts:group:grp-123');

const MOCK_CONTACTS: Contact[] = [
  {
    id: mockContactUrn,
    alias: 'johndoe',
    firstName: 'John',
    surname: 'Doe',
    email: 'john@example.com',
    serviceContacts: {},
    phoneNumbers: [],
    emailAddresses: [],
    lastModified: '' as any,
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
  let mockContactsService: any;
  let mockDialog: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockContactsService = {
      getGroup: vi.fn(),
      saveGroup: vi.fn(),
      deleteGroup: vi.fn(),
      getGroupsByParent: vi.fn().mockResolvedValue([]),
      contacts$: new Subject<Contact[]>(),
    };

    // ✅ ROBUST MOCK: Returns the expected Ref structure
    mockDialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(true), // Simulates "Yes, Delete"
      }),
    };

    await TestBed.configureTestingModule({
      imports: [
        ContactGroupPageComponent,
        ContactsPageToolbarComponent,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: ContactsStorageService, useValue: mockContactsService },
        // ✅ PROVIDE MOCK: This replaces the real service
        { provide: MatDialog, useValue: mockDialog },
      ],
    })
      .overrideComponent(ContactGroupPageComponent, {
        // ✅ CRITICAL: Remove real module to prevent internal service injection
        remove: { imports: [ContactGroupFormComponent, MatDialogModule] },
        add: { imports: [] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ContactGroupPageComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    mockContactsService.getGroup.mockResolvedValue(MOCK_GROUP);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should emit (saved) when saveGroup completes', async () => {
    fixture.componentRef.setInput('groupId', undefined);
    mockContactsService.saveGroup.mockResolvedValue(undefined);
    mockContactsService.contacts$.next(MOCK_CONTACTS);
    fixture.detectChanges();
    await fixture.whenStable();

    const spy = vi.spyOn(component.saved, 'emit');

    await component.onSave(MOCK_GROUP);

    expect(mockContactsService.saveGroup).toHaveBeenCalledWith(MOCK_GROUP);
    expect(spy).toHaveBeenCalled();
  });

  it('should emit (cancelled) when onClose is called', () => {
    const spy = vi.spyOn(component.cancelled, 'emit');
    component.onClose();
    expect(spy).toHaveBeenCalled();
  });

  it('should emit (saved) when onDelete is confirmed', async () => {
    fixture.componentRef.setInput('groupId', mockGroupUrn);
    mockContactsService.getGroup.mockResolvedValue(MOCK_GROUP);
    mockContactsService.contacts$.next(MOCK_CONTACTS);
    mockContactsService.deleteGroup.mockResolvedValue(undefined);

    fixture.detectChanges();
    await fixture.whenStable();

    const spy = vi.spyOn(component.saved, 'emit');

    // ✅ This will now use mockDialog.open() and succeed
    await component.onDelete({ recursive: false });

    expect(mockDialog.open).toHaveBeenCalledWith(
      ConfirmationDialogComponent,
      expect.anything(),
    );
    expect(mockContactsService.deleteGroup).toHaveBeenCalledWith(MOCK_GROUP.id);
    expect(spy).toHaveBeenCalled();
  });
});
