import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component, signal } from '@angular/core';
import {
  Contact,
  ContactGroup,
} from '@nx-platform-application/contacts-data-access';
import { vi } from 'vitest';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { ContactGroupFormComponent } from './contact-group-form.component';
import { ContactMultiSelectorComponent } from '../contact-multi-selector/contact-multi-selector.component';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';

// --- Mock Fixtures ---
const MOCK_CONTACTS: Contact[] = [
  {
    id: 'user-123',
    alias: 'johndoe',
    firstName: 'John',
    surname: 'Doe',
    email: 'john@example.com',
    serviceContacts: {},
    phoneNumbers: [],
    emailAddresses: [],
  } as Contact,
  {
    id: 'user-456',
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
  id: 'grp-123',
  name: 'Test Group',
  description: 'A test group',
  contactIds: ['user-456'],
};

// --- Test Host ---
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
  // --- NEW: Signal for startInEditMode ---
  startInEditMode = signal(false);

  savedGroup: ContactGroup | null = null;
  
  onSave(group: ContactGroup) {
    this.savedGroup = group;
  }
  // REMOVED: onCancel()
}

describe('ContactGroupFormComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;
  let componentEl: HTMLElement;
  let formComponent: ContactGroupFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
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
    // 1. Set startInEditMode to true
    hostComponent.startInEditMode.set(true);
    fixture.detectChanges();
    
    // 2. Query for the input
    const nameInput = componentEl.querySelector(
      'input[formControlName="name"]'
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('');
    expect(formComponent.form.value.contactIds).toEqual([]);
  });

  // --- FIXED TEST ---
  it('should be in "edit mode" and patch the form', async () => {
    // 1. Set group and startInEditMode
    hostComponent.group.set(MOCK_GROUP);
    hostComponent.startInEditMode.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    // 2. Assert form values
    const nameInput = componentEl.querySelector(
      'input[formControlName="name"]'
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('Test Group');
    expect(formComponent.form.value.contactIds).toEqual(['user-456']);

    // 3. Assert checkboxes (now that they are visible)
    const selectorCheckboxes = componentEl.querySelectorAll<HTMLInputElement>(
      'contacts-multi-selector input[type="checkbox"]'
    );
    expect(selectorCheckboxes.length).toBe(MOCK_CONTACTS.length); // This should be 2, not 0
    expect(selectorCheckboxes[0].checked).toBe(false); // 'johndoe'
    expect(selectorCheckboxes[1].checked).toBe(true); // 'janedoe'
  });

  // --- FIXED TEST ---
  it('should update form when child multi-selector changes', async () => {
    // 1. Set edit mode
    hostComponent.startInEditMode.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    // 2. Find checkbox
    const firstCheckbox = fixture.debugElement.query(
      By.css('contacts-multi-selector input[type="checkbox"]')
    ).nativeElement as HTMLInputElement;

    // 3. Act
    firstCheckbox.click();
    fixture.detectChanges();
    await fixture.whenStable();

    // 4. Assert
    expect(formComponent.form.value.contactIds).toEqual(['user-123']);
  });

  // --- FIXED TEST ---
  it('should emit (save) with form data', async () => {
    const saveSpy = vi.spyOn(hostComponent, 'onSave');
    
    // 1. Set edit mode
    hostComponent.startInEditMode.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    // 2. Patch form
    formComponent.form.patchValue({
      name: 'New Group Name',
      description: 'New desc',
      contactIds: ['user-123'],
    });
    fixture.detectChanges();
    await fixture.whenStable();

    // 3. Find and click save button
    const saveButton = fixture.debugElement.query(
      By.css('[data-testid="save-button"]')
    ).nativeElement as HTMLButtonElement;
    saveButton.click();
    fixture.detectChanges();

    // 4. Assert
    expect(saveSpy).toHaveBeenCalled();
    expect(hostComponent.savedGroup).toBeTruthy();
    expect(hostComponent.savedGroup?.name).toBe('New Group Name');
    expect(hostComponent.savedGroup?.contactIds).toEqual(['user-123']);
  });

  // --- REVISED TEST ---
  it('should set isEditing to false on cancel click', () => {
    // 1. Set edit mode
    hostComponent.startInEditMode.set(true);
    fixture.detectChanges();
    expect(formComponent.isEditing()).toBe(true);
    
    // 2. Find and click cancel button
    const cancelButton = fixture.debugElement.query(
      By.css('[data-testid="cancel-button"]')
    ).nativeElement as HTMLButtonElement;
    cancelButton.click();
    fixture.detectChanges();

    // 3. Assert internal state
    expect(formComponent.isEditing()).toBe(false);
  });

  // --- FIXED TEST ---
  it('should disable save button when form is invalid', async () => {
    // 1. Set edit mode
    hostComponent.startInEditMode.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    // 2. Find button and check state
    const saveButton = fixture.debugElement.query(
      By.css('[data-testid="save-button"]')
    ).nativeElement as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    // 3. Act
    formComponent.form.patchValue({ name: 'Valid Name' });
    fixture.detectChanges();
    await fixture.whenStable();

    // 4. Assert
    expect(saveButton.disabled).toBe(false);
  });
  
  // --- NEW TEST ---
  it('should switch from view mode to edit mode when "Edit" is clicked', () => {
    // 1. Arrange: Should start in view mode
    hostComponent.group.set(MOCK_GROUP);
    hostComponent.startInEditMode.set(false);
    fixture.detectChanges();
    expect(formComponent.isEditing()).toBe(false);

    // 2. Act
    const editButton = fixture.debugElement.query(
      By.css('[data-testid="edit-button"]')
    ).nativeElement;
    editButton.click();
    fixture.detectChanges();

    // 3. Assert
    expect(formComponent.isEditing()).toBe(true);
  });
});