import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component, signal } from '@angular/core';
import {
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-storage';
// --- 1. Import URN ---
import { URN } from '@nx-platform-application/platform-types';
import { vi } from 'vitest';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
// --- 2. Import NoopAnimationsModule ---
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ContactGroupFormComponent } from './contact-group-form.component';
import { ContactMultiSelectorComponent } from '../contact-multi-selector/contact-multi-selector.component';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';

// --- 3. Update Mock Fixtures to use URNs ---
const mockContact1Urn = URN.parse('urn:sm:user:user-123');
const mockContact2Urn = URN.parse('urn:sm:user:user-456');
const mockGroupUrn = URN.parse('urn:sm:group:grp-123');

const MOCK_CONTACTS: Contact[] = [
  {
    id: mockContact1Urn,
    alias: 'johndoe',
    firstName: 'John',
    surname: 'Doe',
    email: 'john@example.com',
    serviceContacts: {},
    phoneNumbers: [],
    emailAddresses: [],
  } as Contact,
  {
    id: mockContact2Urn,
    alias: 'janedoe',
    firstName: 'Jane',
    surname: 'Doe',
    email: 'jane@example.com',
    serviceContacts: {},
    phoneNumbers: [],
    emailAddresses: [],
  } as Contact,
];

const MOCK_GROUP: ContactGroup = {
  id: mockGroupUrn,
  name: 'Test Group',
  description: 'A test group',
  contactIds: [mockContact2Urn], // <-- Use URN
};

// --- Test Host (This is the original, correct setup) ---
@Component({
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    ContactGroupFormComponent,
    ContactMultiSelectorComponent,
    ContactAvatarComponent,
  ],
  template: `
    <contacts-group-form
      [group]="group()"
      [allContacts]="allContacts()"
      [startInEditMode]="startInEditMode()"
      (save)="onSave($event)"
    />
  `,
})
class TestHostComponent {
  group = signal<ContactGroup | null>(null);
  allContacts = signal(MOCK_CONTACTS);
  startInEditMode = signal(false);

  savedGroup: ContactGroup | null = null;

  onSave(group: ContactGroup) {
    this.savedGroup = group;
  }
}

describe('ContactGroupFormComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;
  let componentEl: HTMLElement;
  let formComponent: ContactGroupFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // --- 4. Import the Host and the Animation Module ---
      imports: [TestHostComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    componentEl = fixture.nativeElement;

    formComponent = fixture.debugElement.query(
      By.directive(ContactGroupFormComponent)
    ).componentInstance;

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(formComponent).toBeTruthy();
  });

  it('should be in "add mode" with an empty form', () => {
    hostComponent.startInEditMode.set(true);
    fixture.detectChanges();

    const nameInput = componentEl.querySelector(
      'input[formControlName="name"]'
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('');
    expect(formComponent.form.value.contactIds).toEqual([]);
  });

  // --- 5. Update Assertions for "edit mode" ---
  it('should be in "edit mode" and patch the form', async () => {
    hostComponent.group.set(MOCK_GROUP);
    hostComponent.startInEditMode.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const nameInput = componentEl.querySelector(
      'input[formControlName="name"]'
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('Test Group');
    // Assert against the string version in the form
    expect(formComponent.form.value.id).toBe(mockGroupUrn.toString());
    expect(formComponent.form.value.contactIds).toEqual([
      mockContact2Urn.toString(),
    ]);

    const selectorCheckboxes = componentEl.querySelectorAll<HTMLInputElement>(
      'contacts-multi-selector input[type="checkbox"]'
    );
    expect(selectorCheckboxes.length).toBe(MOCK_CONTACTS.length);
    expect(selectorCheckboxes[0].checked).toBe(false);
    expect(selectorCheckboxes[1].checked).toBe(true);
  });

  // --- 6. Update Assertions for "multi-selector" ---
  it('should update form when child multi-selector changes', async () => {
    hostComponent.startInEditMode.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const firstCheckbox = fixture.debugElement.query(
      By.css('contacts-multi-selector input[type="checkbox"]')
    ).nativeElement as HTMLInputElement;

    firstCheckbox.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // Assert the form holds the string ID
    expect(formComponent.form.value.contactIds).toEqual([
      mockContact1Urn.toString(),
    ]);
  });

  // --- 7. Update Assertions for "save" ---
  it('should emit (save) with form data', async () => {
    const saveSpy = vi.spyOn(hostComponent, 'onSave');

    hostComponent.group.set(MOCK_GROUP); // Set the group so the ID is preserved
    hostComponent.startInEditMode.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    // Patch with string IDs
    formComponent.form.patchValue({
      name: 'New Group Name',
      description: 'New desc',
      contactIds: [mockContact1Urn.toString()],
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const saveButton = fixture.debugElement.query(
      By.css('[data-testid="save-button"]')
    ).nativeElement as HTMLButtonElement;
    saveButton.click();
    fixture.detectChanges();

    // Assert the emitted value is a ContactGroup with URNs
    expect(saveSpy).toHaveBeenCalled();
    expect(hostComponent.savedGroup).toBeTruthy();
    expect(hostComponent.savedGroup?.name).toBe('New Group Name');
    expect(hostComponent.savedGroup?.id).toBe(mockGroupUrn); // Preserved URN
    expect(hostComponent.savedGroup?.contactIds).toEqual([mockContact1Urn]); // Converted URN
  });

  it('should set isEditing to false on cancel click', () => {
    hostComponent.startInEditMode.set(true);
    fixture.detectChanges();
    expect(formComponent.isEditing()).toBe(true);

    const cancelButton = fixture.debugElement.query(
      By.css('[data-testid="cancel-button"]')
    ).nativeElement as HTMLButtonElement;
    cancelButton.click();
    fixture.detectChanges();

    expect(formComponent.isEditing()).toBe(false);
  });

  it('should disable save button when form is invalid', async () => {
    hostComponent.startInEditMode.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const saveButton = fixture.debugElement.query(
      By.css('[data-testid="save-button"]')
    ).nativeElement as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    formComponent.form.patchValue({ name: 'Valid Name' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(saveButton.disabled).toBe(false);
  });

  it('should switch from view mode to edit mode when "Edit" is clicked', () => {
    hostComponent.group.set(MOCK_GROUP);
    hostComponent.startInEditMode.set(false);
    fixture.detectChanges();
    expect(formComponent.isEditing()).toBe(false);

    const editButton = fixture.debugElement.query(
      By.css('[data-testid="edit-button"]')
    ).nativeElement;
    editButton.click();
    fixture.detectChanges();

    expect(formComponent.isEditing()).toBe(true);
  });
});
