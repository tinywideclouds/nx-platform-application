// Mock the Angular Material modules imported by the component

vi.mock('@angular/material/list', () => ({
  MatListModule: {},
}));
vi.mock('@angular/material/input', () => ({
  MatInputModule: {},
}));
vi.mock('@angular/material/form-field', () => ({
  MatFormFieldModule: {},
}));
vi.mock('@angular/material/button', () => ({
  MatButtonModule: {},
}));
vi.mock('@angular/material/card', () => ({
  MatCardModule: {},
}));
// -----------------------

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsComponent } from './contacts.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { signal, WritableSignal } from '@angular/core';

// --- Platform/Feature Imports ---
import { ContactsService } from '@nx-platform-application/contacts-data-access';
import { LoggerService } from '@nx-platform-application/console-logger';
import { User } from '@nx-platform-application/platform-types';

// --- Mock Data ---
const MOCK_USERS: User[] = [
  { id: '1', email: 'user1@example.com', alias: 'User One' },
  { id: '2', email: 'user2@example.com', alias: 'User Two' },
];

// --- Mock Services ---
//
class MockLoggerService {
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
}

class MockContactsService {
  // Use a WritableSignal for testing
  contacts: WritableSignal<User[]> = signal<User[]>([]);
  loadContacts = vi.fn();
  addContact = vi.fn();
}

describe('ContactsComponent (Zoneless)', () => {
  let component: ContactsComponent;
  let fixture: ComponentFixture<ContactsComponent>;
  let element: HTMLElement;
  let mockContactsService: MockContactsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Import the standalone component
      imports: [ContactsComponent, NoopAnimationsModule],
      providers: [
        // Provide the mock services
        { provide: ContactsService, useClass: MockContactsService },
        { provide: LoggerService, useClass: MockLoggerService },
      ],
    })
      .overrideComponent(ContactsComponent, {
        set: {
          imports: [],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ContactsComponent);
    component = fixture.componentInstance;
    element = fixture.nativeElement;

    // Get the injected instance of the mock service
    mockContactsService = TestBed.inject(
      ContactsService
    ) as unknown as MockContactsService;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call loadContacts on initialization (ngOnInit)', () => {
    // Act
    fixture.detectChanges(); // Triggers ngOnInit

    // Assert
    expect(mockContactsService.loadContacts).toHaveBeenCalledTimes(1);
  });

  it('should display contacts from the service signal', () => {
    // Arrange
    mockContactsService.contacts.set(MOCK_USERS);

    // Act
    fixture.detectChanges(); // Update the view with the new signal value

    // Assert
    const listItems = element.querySelectorAll('mat-list-item');
    expect(listItems.length).toBe(2);
    expect(listItems[0].textContent).toContain('User One');
    expect(listItems[0].textContent).toContain('user1@example.com');
    expect(listItems[1].textContent).toContain('User Two');
  });

  it('should display an empty message when no contacts exist', () => {
    // Arrange
    mockContactsService.contacts.set([]);

    // Act
    fixture.detectChanges();

    // Assert
    const listItems = element.querySelectorAll('mat-list-item');
    expect(listItems.length).toBe(1); // The "@empty" block
    expect(listItems[0].textContent).toContain('You have no contacts yet.');
  });

  it('should call addContact on button click with the input value', () => {
    // Arrange
    fixture.detectChanges();
    const input = element.querySelector('input') as HTMLInputElement;
    const addButton = element.querySelector('button') as HTMLButtonElement;
    const testEmail = 'new@example.com';

    // Act
    input.value = testEmail;
    input.dispatchEvent(new Event('input')); // Update input value
    addButton.click();
    fixture.detectChanges();

    // Assert
    expect(mockContactsService.addContact).toHaveBeenCalledTimes(1);
    expect(mockContactsService.addContact).toHaveBeenCalledWith(testEmail);
  });

  it('should clear the input after adding a contact', () => {
    // Arrange
    fixture.detectChanges();
    const input = element.querySelector('input') as HTMLInputElement;
    const addButton = element.querySelector('button') as HTMLButtonElement;

    // Act
    input.value = 'test@example.com';
    addButton.click();
    fixture.detectChanges();

    // Assert
    expect(input.value).toBe('');
  });
});
