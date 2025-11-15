import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Component, signal } from '@angular/core';
import { Contact } from '@nx-platform-application/contacts-data-access';
// ... other imports ...
import { FormsModule } from '@angular/forms';

import { ContactMultiSelectorComponent } from './contact-multi-selector.component';
import { ContactAvatarComponent } from '../contact-avatar/contact-avatar.component';

// --- Mock Contacts ---
const MOCK_CONTACTS: Contact[] = [
  {
    id: 'user-123',
    alias: 'johndoe',
    email: 'john@example.com',
    firstName: 'John',
    surname: 'Doe',
    phoneNumbers: [],
    emailAddresses: [],
    isFavorite: false,
    serviceContacts: {},
  } as Contact,
  {
    id: 'user-456',
    alias: 'janedoe',
    email: 'jane@example.com',
    firstName: 'Jane',
    surname: 'Doe',
    phoneNumbers: [],
    emailAddresses: [],
    isFavorite: true,
    serviceContacts: {},
  } as Contact,
  {
    id: 'user-789',
    alias: 'alice',
    email: 'alice@example.com',
    firstName: 'Alice',
    surname: 'Smith',
    phoneNumbers: [],
    emailAddresses: [],
    isFavorite: false,
    serviceContacts: {},
  } as Contact,
];

@Component({
  standalone: true,
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
  selected: string[] = ['user-456'];
}

describe('ContactMultiSelectorComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;
  let componentEl: HTMLElement;
  let componentInstance: ContactMultiSelectorComponent; // Get component instance

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        TestHostComponent,
        ContactMultiSelectorComponent,
        ContactAvatarComponent,
        FormsModule,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    componentEl = fixture.nativeElement;
    
    // Get the child component instance
    componentInstance = fixture.debugElement.query(
      By.directive(ContactMultiSelectorComponent)
    ).componentInstance;

    fixture.detectChanges();
    await fixture.whenStable(); // Wait for initial bindings
  });

  it('should render all contacts', () => {
    const items = componentEl.querySelectorAll('label');
    expect(items.length).toBe(MOCK_CONTACTS.length);
  });

  // --- THIS IS THE FIXED TEST (1) ---
  it('should filter contacts based on filter text', async () => {
    // 1. Set the filterText signal *directly* on the component instance.
    // This is more reliable than simulating DOM events for ngModel.
    componentInstance.filterText.set('john');
    fixture.detectChanges();
    await fixture.whenStable(); // Wait for computed signals to render

    // 2. Assert the list is shorter
    const items = componentEl.querySelectorAll('label');
    expect(items.length).toBe(1);
    expect(items[0].textContent).toContain('johndoe');
  });

  // --- THIS IS THE FIXED TEST (2) ---
  it('should check boxes based on "selectedIds" input', () => {
    // The beforeEach already ran detectChanges and whenStable,
    // so the DOM should be fully rendered.
    const checkboxes = componentEl.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]'
    );
    
    // Assert that we *found* the checkboxes
    expect(checkboxes.length).toBe(MOCK_CONTACTS.length); 
    
    // Now test their state
    expect(checkboxes[0].checked).toBe(false); // John
    expect(checkboxes[1].checked).toBe(true);  // Jane
    expect(checkboxes[2].checked).toBe(false); // Alice
  });

  // --- THIS IS THE FIXED TEST (3) ---
  it('should update "selectedIds" model on (change)', () => {
    // 1. Assert initial state
    expect(hostComponent.selected).toEqual(['user-456']);

    // 2. Find the *first* checkbox (John)
    const firstCheckbox = fixture.debugElement.query(
      By.css('input[type="checkbox"]')
    )?.nativeElement as HTMLInputElement; // Add safe navigation

    // Assert that we *found* it
    expect(firstCheckbox).toBeTruthy();
    firstCheckbox.click();
    fixture.detectChanges();

    // 3. Assert the host's model was updated
    expect(hostComponent.selected).toEqual(['user-456', 'user-123']);

    // 4. Click the *second* checkbox (Jane) to deselect her
    const secondCheckbox = componentEl.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]'
    )[1];
    
    secondCheckbox.click();
    fixture.detectChanges();

    // 5. Assert the host's model was updated again
    expect(hostComponent.selected).toEqual(['user-123']);
  });
});