import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component, signal } from '@angular/core';
import { Contact } from '@nx-platform-application/contacts-access';
import { URN } from '@nx-platform-application/platform-types'; // <-- 1. Import URN
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations'; // <-- 2. Import

import { ContactMultiSelectorComponent } from './contact-multi-selector.component';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';

// --- 3. Update Mock Contacts to use URNs ---
const MOCK_CONTACTS: Contact[] = [
  {
    id: URN.parse('urn:sm:user:user-123'),
    alias: 'johndoe',
    email: 'john@example.com',
    firstName: 'John',
    surname: 'Doe',
    phoneNumbers: [],
    emailAddresses: [],
    serviceContacts: {},
  } as Contact,
  {
    id: URN.parse('urn:sm:user:user-456'),
    alias: 'janedoe',
    email: 'jane@example.com',
    firstName: 'Jane',
    surname: 'Doe',
    phoneNumbers: [],
    emailAddresses: [],
    serviceContacts: {},
  } as Contact,
  {
    id: URN.parse('urn:sm:user:user-789'),
    alias: 'alice',
    email: 'alice@example.com',
    firstName: 'Alice',
    surname: 'Smith',
    phoneNumbers: [],
    emailAddresses: [],
    serviceContacts: {},
  } as Contact,
];

@Component({
  standalone: true,
  // --- 4. Remove NoopAnimationsModule from here ---
  imports: [ContactMultiSelectorComponent, FormsModule],
  template: `
    <contacts-multi-selector
      [allContacts]="allContacts()"
      [(selectedIds)]="selected"
    />
  `,
})
class TestHostComponent {
  allContacts = signal(MOCK_CONTACTS);
  // --- 5. Update selected strings to be full URNs ---
  selected: string[] = ['urn:sm:user:user-456'];
}

describe('ContactMultiSelectorComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;
  let componentEl: HTMLElement;
  let componentInstance: ContactMultiSelectorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // --- 6. Simplify imports and add NoopAnimationsModule ---
      imports: [
        TestHostComponent,
        NoopAnimationsModule,
        // ContactMultiSelectorComponent, // Already in TestHostComponent
        // ContactAvatarComponent, // Already in ContactMultiSelectorComponent
        // FormsModule, // Already in TestHostComponent
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    componentEl = fixture.nativeElement;

    componentInstance = fixture.debugElement.query(
      By.directive(ContactMultiSelectorComponent)
    ).componentInstance;

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should render all contacts', () => {
    const items = componentEl.querySelectorAll('label');
    expect(items.length).toBe(MOCK_CONTACTS.length);
  });

  it('should filter contacts based on filter text', async () => {
    componentInstance.filterText.set('john');
    fixture.detectChanges();
    await fixture.whenStable();

    const items = componentEl.querySelectorAll('label');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('johndoe');
  });

  it('should check boxes based on "selectedIds" input', () => {
    const checkboxes = componentEl.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]'
    );

    expect(checkboxes.length).toBe(MOCK_CONTACTS.length);
    expect(checkboxes[0].checked).toBe(false); // John
    expect(checkboxes[1].checked).toBe(true); // Jane
    expect(checkboxes[2].checked).toBe(false); // Alice
  });

  it('should update "selectedIds" model on (change)', () => {
    expect(hostComponent.selected).toEqual(['urn:sm:user:user-456']);

    const firstCheckbox = fixture.debugElement.query(
      By.css('input[type="checkbox"]')
    )?.nativeElement as HTMLInputElement;

    expect(firstCheckbox).toBeTruthy();
    firstCheckbox.click();
    fixture.detectChanges();

    expect(hostComponent.selected).toEqual([
      'urn:sm:user:user-456',
      'urn:sm:user:user-123',
    ]);

    const secondCheckbox = componentEl.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]'
    )[1];

    secondCheckbox.click();
    fixture.detectChanges();

    expect(hostComponent.selected).toEqual(['urn:sm:user:user-123']);
  });
});
