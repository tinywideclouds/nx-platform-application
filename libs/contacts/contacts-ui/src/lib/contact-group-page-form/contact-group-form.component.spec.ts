// ... (imports remain the same)
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component, signal } from '@angular/core';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ContactGroupFormComponent } from './contact-group-form.component';

// --- UPDATED MOCK FIXTURES ---
const mockContact1Urn = URN.parse('urn:contacts:user:user-123');
const mockContact2Urn = URN.parse('urn:contacts:user:user-456');
const mockGroupUrn = URN.parse('urn:contacts:group:grp-123');

const MOCK_CONTACTS: Contact[] = [
  {
    id: mockContact1Urn,
    alias: 'John',
    serviceContacts: {}, // ✅ Fix: Added missing property
  } as any,
  {
    id: mockContact2Urn,
    alias: 'Jane',
    serviceContacts: {}, // ✅ Fix: Added missing property
  } as any,
];

const MOCK_GROUP: ContactGroup = {
  id: mockGroupUrn,
  name: 'Test Group',
  description: 'Desc',
  scope: 'local',
  members: [{ contactId: mockContact2Urn, status: 'added' }],
};

@Component({
  standalone: true,
  imports: [ContactGroupFormComponent],
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
  let formComponent: ContactGroupFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, NoopAnimationsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;

    fixture.detectChanges();

    formComponent = fixture.debugElement.query(
      By.directive(ContactGroupFormComponent),
    ).componentInstance;
  });

  it('should create', () => {
    expect(formComponent).toBeTruthy();
  });

  it('should exit edit mode on save if startInEditMode is false', async () => {
    hostComponent.group.set(MOCK_GROUP);
    hostComponent.startInEditMode.set(false);
    fixture.detectChanges();

    formComponent.isEditing.set(true);
    fixture.detectChanges();
    expect(formComponent.isEditing()).toBe(true);

    const saveBtn = fixture.debugElement.query(
      By.css('[data-testid="save-button"]'),
    ).nativeElement;
    saveBtn.click();
    fixture.detectChanges();

    expect(formComponent.isEditing()).toBe(false);
  });

  it('should remain in edit mode on save if startInEditMode is true (Creating)', async () => {
    hostComponent.startInEditMode.set(true);
    fixture.detectChanges();

    formComponent.name.set('New Group');
    fixture.detectChanges();

    const saveBtn = fixture.debugElement.query(
      By.css('[data-testid="save-button"]'),
    ).nativeElement;
    saveBtn.click();
    fixture.detectChanges();

    expect(formComponent.isEditing()).toBe(true);
  });
});
