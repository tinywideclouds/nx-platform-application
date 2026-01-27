import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component, signal } from '@angular/core';
import { Contact, ContactGroup } from '@nx-platform-application/contacts-types';
import { URN } from '@nx-platform-application/platform-types';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

// COMPONENTS
import { ContactGroupFormComponent } from './contact-group-form.component';

// NG-MOCKS
import { MockComponent } from 'ng-mocks';
import { ContactMultiSelectorComponent } from '../contact-multi-selector/contact-multi-selector.component';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';

// --- DATA ---
const mockContact1Urn = URN.parse('urn:contacts:user:user-123');
const mockContact2Urn = URN.parse('urn:contacts:user:user-456');
const mockGroupUrn = URN.parse('urn:contacts:group:grp-123');
const mockDirectoryUrn = URN.parse('urn:directory:group:dir-123');

const MOCK_CONTACTS: Contact[] = [
  {
    id: mockContact1Urn,
    alias: 'John',
    firstName: 'John',
    surname: 'Doe',
    serviceContacts: {},
  } as any,
  {
    id: mockContact2Urn,
    alias: 'Jane',
    firstName: 'Jane',
    surname: 'Doe',
    serviceContacts: {},
  } as any,
];

// [FIX] Updated to V7 Schema
const MOCK_GROUP: ContactGroup = {
  id: mockGroupUrn,
  directoryId: mockDirectoryUrn,
  name: 'Test Group',
  description: 'Desc',
  members: [{ contactId: mockContact2Urn, status: 'added' } as any],
  lastModified: '2025-01-01T00:00:00Z' as any,
};

@Component({
  standalone: true,
  imports: [ContactGroupFormComponent],
  template: `
    <contacts-group-form
      [group]="group()"
      [allContacts]="allContacts()"
      [isEditing]="isEditing()"
      (save)="onSave($event)"
      (errorsChange)="onError($event)"
    />
  `,
})
class TestHostComponent {
  group = signal<ContactGroup | null>(null);
  allContacts = signal(MOCK_CONTACTS);
  isEditing = signal(false);

  savedGroup: ContactGroup | null = null;
  errorCount = 0;

  onSave(group: ContactGroup) {
    this.savedGroup = group;
  }
  onError(count: number) {
    this.errorCount = count;
  }
}

describe('ContactGroupFormComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;
  let formComponent: ContactGroupFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TestHostComponent,
        NoopAnimationsModule,
        MockComponent(ContactMultiSelectorComponent),
        MockComponent(ContactAvatarComponent),
      ],
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

  describe('Form Validation', () => {
    it('should initialize with values from group input', () => {
      hostComponent.group.set(MOCK_GROUP);
      fixture.detectChanges();

      expect(formComponent.name()).toBe('Test Group');
      expect(formComponent.description()).toBe('Desc');
    });

    it('should report errors when name is empty', () => {
      hostComponent.isEditing.set(true);
      fixture.detectChanges();

      formComponent.name.set('');
      fixture.detectChanges();

      expect(formComponent.isValid()).toBe(false);
      expect(hostComponent.errorCount).toBe(1);
    });
  });

  describe('Trigger Save', () => {
    it('should emit saved event when triggerSave() is called and form is valid', () => {
      hostComponent.group.set(MOCK_GROUP);
      hostComponent.isEditing.set(true);
      fixture.detectChanges();

      formComponent.triggerSave();
      fixture.detectChanges();

      expect(hostComponent.savedGroup).not.toBeNull();
      expect(hostComponent.savedGroup?.name).toBe('Test Group');
    });

    it('should NOT emit saved event if name is invalid', () => {
      hostComponent.group.set(MOCK_GROUP);
      hostComponent.isEditing.set(true);
      fixture.detectChanges();

      formComponent.name.set('');
      fixture.detectChanges();

      formComponent.triggerSave();
      fixture.detectChanges();

      expect(hostComponent.savedGroup).toBeNull();
      expect(formComponent.nameTouched()).toBe(true);
    });
  });

  describe('Visual State (Dumb Component)', () => {
    it('should mark fields readonly when isEditing is false', () => {
      hostComponent.isEditing.set(false);
      fixture.detectChanges();

      const input = fixture.debugElement.query(
        By.css('input#group-name-input'),
      );
      expect(input.properties['readOnly']).toBe(true);
    });

    it('should mark fields editable when isEditing is true', () => {
      hostComponent.isEditing.set(true);
      fixture.detectChanges();

      const input = fixture.debugElement.query(
        By.css('input#group-name-input'),
      );
      expect(input.properties['readOnly']).toBe(false);
    });
  });
});
