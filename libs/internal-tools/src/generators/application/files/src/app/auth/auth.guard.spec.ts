// src/app/auth/auth.guard.spec.ts
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { IAuthService } from '@nx-platform-application/platform-auth-data-access';
import { authGuard } from './auth.guard';
import { Component } from '@angular/core';
// 1. Import firstValueFrom
import { firstValueFrom, of, Observable } from 'rxjs';

// Helper to execute the functional guard within an injection context
const executeGuard = () =>
  TestBed.runInInjectionContext(() => {
    // This returns an Observable<boolean> | boolean | ...
    return authGuard({} as any, {} as any);
  });

// Mock component for router configuration
@Component({
  standalone: true,
  template: '',
})
class MockComponent {}

describe('authGuard (Zoneless + Globals)', () => {
  let mockAuthService: {
    isAuthenticated: ReturnType<typeof vi.fn>;
    sessionLoaded$: ReturnType<typeof of>;
  };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockAuthService = {
      isAuthenticated: vi.fn(),
      sessionLoaded$: of(null), // This is correct
    };
    mockRouter = {
      navigate: vi.fn(() => Promise.resolve(true)),
    };

    await TestBed.configureTestingModule({
      imports: [MockComponent],
      providers: [
        provideRouter([{ path: 'login', component: MockComponent }]),
        { provide: IAuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();
  });

  // 2. Make the test async
  it('should return true and not redirect if user is authenticated', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(true);

    const canActivate = executeGuard() as Observable<boolean>;

    // 3. Await the value from the observable
    const result = await firstValueFrom(canActivate);

    expect(result).toBe(true);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  // 2. Make the test async
  it('should return false and redirect to /login if user is not authenticated', async () => {
    mockAuthService.isAuthenticated.mockReturnValue(false);

    const canActivate = executeGuard() as Observable<boolean>;

    // 3. Await the value from the observable
    const result = await firstValueFrom(canActivate);

    expect(result).toBe(false);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });
});
