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

// --- THIS IS THE FIX ---
// The mock contacts must satisfy the Contact interface,
// specifically by providing serviceContacts (even if empty).
const MOCK_CONTACTS: Contact[] = [
  {
    id: 'user-123',
    alias: 'johndoe',
    firstName: 'John',
    surname: 'Doe',
    email: 'john@example.com',
    serviceContacts: {}, // <-- Required
    phoneNumbers: [],     // <-- Required
    emailAddresses: [],   // <-- Required
  } as Contact,
  {
    id: 'user-456',
    alias: 'janedoe',
    firstName: 'Jane',
    surname: 'Doe',
    email: 'jane@example.com',
    serviceContacts: {}, // <-- Required
    phoneNumbers: [],     // <-- Required
    emailAddresses: [],   // <-- Required
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
    <lib-contact-group-form
      [group]="group()"
      [allContacts]="allContacts()"
      (save)="onSave($event)"
      (cancel)="onCancel()"
    />
  `,
})
class TestHostComponent {
  group = signal<ContactGroup | null>(null);
  allContacts = signal(MOCK_CONTACTS);

  savedGroup: ContactGroup | null = null;
  cancelled = false;

  onSave(group: ContactGroup) {
    this.savedGroup = group;
  }
  onCancel() {
    this.cancelled = true;
  }
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
    const nameInput = componentEl.querySelector(
      'input[formControlName="name"]'
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('');
    expect(formComponent.form.value.contactIds).toEqual([]);
  });

  it('should be in "edit mode" and patch the form', async () => {
    hostComponent.group.set(MOCK_GROUP);
    fixture.detectChanges();
    await fixture.whenStable();

    const nameInput = componentEl.querySelector(
      'input[formControlName="name"]'
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('Test Group');
    
    expect(formComponent.form.value.contactIds).toEqual(['user-456']);

    const selectorCheckboxes = componentEl.querySelectorAll<HTMLInputElement>(
      'lib-contact-multi-selector input[type="checkbox"]'
    );
    expect(selectorCheckboxes.length).toBe(MOCK_CONTACTS.length);
    expect(selectorCheckboxes[0].checked).toBe(false); // 'johndoe'
    expect(selectorCheckboxes[1].checked).toBe(true);  // 'janedoe'
  });

  it('should update form when child multi-selector changes', async () => {
    const firstCheckbox = fixture.debugElement.query(
      By.css('lib-contact-multi-selector input[type="checkbox"]')
    ).nativeElement as HTMLInputElement;

    firstCheckbox.click();
    fixture.detectChanges();
    await fixture.whenStable();
    
    expect(formComponent.form.value.contactIds).toEqual(['user-123']);
  });

  it('should emit (save) with form data', async () => {
    const saveSpy = vi.spyOn(hostComponent, 'onSave');

    formComponent.form.patchValue({
      name: 'New Group Name',
      description: 'New desc',
      contactIds: ['user-123'],
    });
    fixture.detectChanges();
    await fixture.whenStable();

    const saveButton = fixture.debugElement.query(
      By.css('[data-testid="save-button"]')
    ).nativeElement as HTMLButtonElement;
    saveButton.click();
    fixture.detectChanges();

    expect(saveSpy).toHaveBeenCalled();
    expect(hostComponent.savedGroup).toBeTruthy();
    expect(hostComponent.savedGroup?.name).toBe('New Group Name');
    expect(hostComponent.savedGroup?.contactIds).toEqual(['user-123']);
  });

  it('should emit (cancel) on click', () => {
    const cancelSpy = vi.spyOn(hostComponent, 'onCancel');

    const cancelButton = fixture.debugElement.query(
      By.css('[data-testid="cancel-button"]')
    ).nativeElement as HTMLButtonElement;
    cancelButton.click();
    fixture.detectChanges();

    expect(cancelSpy).toHaveBeenCalled();
    expect(hostComponent.cancelled).toBe(true);
  });

  it('should disable save button when form is invalid', async () => {
    const saveButton = fixture.debugElement.query(
      By.css('[data-testid="save-button"]')
    ).nativeElement as HTMLButtonElement;

    expect(saveButton.disabled).toBe(true);

    formComponent.form.patchValue({ name: 'Valid Name' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(saveButton.disabled).toBe(false);
  });
});