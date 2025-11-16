// vi.mock for material has been REMOVED

import { ComponentFixture, TestBed } from '@angular/core/testing';
// CUSTOM_ELEMENTS_SCHEMA has been REMOVED
import { signal, WritableSignal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { User } from '@nx-platform-application/platform-types';
import { IAuthService } from '@nx-platform-application/platform-auth-data-access';
import { LoginComponent } from './login';

// --- Mock Data ---
const mockUser: User = {
  id: '1',
  alias: 'Test User',
  email: 'test@example.com',
};

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let mockAuthService: Partial<IAuthService>;
  let isAuthenticatedSignal: WritableSignal<boolean>;
  let currentUserSignal: WritableSignal<User | null>;

  beforeEach(async () => {
    // 1. Create mutable signals for the mock
    isAuthenticatedSignal = signal(false);
    currentUserSignal = signal(null);

    // 2. Create the mock AuthService
    mockAuthService = {
      isAuthenticated: isAuthenticatedSignal.asReadonly(),
      currentUser: currentUserSignal.asReadonly(),
      logout: vi.fn(), // Create a Vitest mock function
    };

    // 3. Configure the TestBed
    await TestBed.configureTestingModule({
      imports: [LoginComponent], // This now correctly includes MatModules
      providers: [
        { provide: IAuthService, useValue: mockAuthService },
        provideNoopAnimations(),
      ],
      // schemas: [CUSTOM_ELEMENTS_SCHEMA] has been REMOVED
    })
      // .overrideComponent(...) block has been REMOVED
      .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.clearAllMocks(); // Clean up mocks
    TestBed.resetTestingModule();
  });

  it('should show login button when not authenticated', () => {
    // Arrange: Set state to logged out
    isAuthenticatedSignal.set(false);
    fixture.detectChanges();

    // Act
    const loginButton = fixture.nativeElement.querySelector(
      'a[href="/api/auth/google"]'
    );
    const logoutButton = fixture.nativeElement.querySelector('button');

    // Assert
    expect(loginButton).toBeTruthy();
    expect(loginButton.textContent).toContain('Login with Google');
    expect(logoutButton).toBeFalsy();
  });

  it('should show welcome message and logout button when authenticated', () => {
    // Arrange: Set state to logged in
    isAuthenticatedSignal.set(true);
    currentUserSignal.set(mockUser);
    fixture.detectChanges();

    // Act
    const welcomeMessage = fixture.nativeElement.querySelector('h2');
    const logoutButton = fixture.nativeElement.querySelector('button');
    const loginButton = fixture.nativeElement.querySelector(
      'a[href="/auth/google"]'
    );

    // Assert
    expect(welcomeMessage.textContent).toContain('Welcome, Test User!');
    expect(logoutButton).toBeTruthy();
    expect(logoutButton.textContent).toContain('Logout');
    expect(loginButton).toBeFalsy();
  });

  it('should call authService.logout when logout button is clicked', () => {
    // Arrange: Set state to logged in
    isAuthenticatedSignal.set(true);
    currentUserSignal.set(mockUser);
    fixture.detectChanges();

    // Act
    const logoutButton = fixture.nativeElement.querySelector('button');
    logoutButton.click();

    // Assert
    expect(mockAuthService.logout).toHaveBeenCalledTimes(1);
  });
});