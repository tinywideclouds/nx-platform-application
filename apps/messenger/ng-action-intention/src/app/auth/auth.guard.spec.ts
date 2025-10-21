// src/app/auth/auth.guard.spec.ts
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '@nx-platform-application/platform-auth-data-access';
import { authGuard } from './auth.guard';
import { Component } from '@angular/core';

// Helper to execute the functional guard within an injection context
const executeGuard = () =>
  TestBed.runInInjectionContext(() => {
    return authGuard({} as any, {} as any);
  });

// Mock component for router configuration
// FIX 1: Make the mock component standalone
@Component({
  standalone: true,
  template: '',
})
class MockComponent {}

describe('authGuard (Zoneless + Globals)', () => {
  let mockAuthService: { isAuthenticated: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  // Use async/await for modern TestBed configuration
  beforeEach(async () => {
    mockAuthService = {
      isAuthenticated: vi.fn(),
    };
    mockRouter = {
      navigate: vi.fn(() => Promise.resolve(true)), // Mock navigate to return a promise
    };

    await TestBed.configureTestingModule({
      // FIX 2: Move MockComponent from 'declarations' to 'imports'
      imports: [MockComponent],
      providers: [
        provideRouter([{ path: 'login', component: MockComponent }]), // Provide router configuration
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents(); // Ensure components are compiled
  });

  it('should return true and not redirect if user is authenticated', () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);

    const canActivate = executeGuard();

    expect(canActivate).toBe(true);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it('should return false and redirect to /login if user is not authenticated', () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);

    const canActivate = executeGuard();

    expect(canActivate).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
