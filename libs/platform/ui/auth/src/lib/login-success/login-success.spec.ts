import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { LoginSuccessComponent } from './login-success';
import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('LoginSuccessComponent', () => {
  let fixture: ComponentFixture<LoginSuccessComponent>;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  // LOCAL MOCK: No external dependency needed
  const mockAuthService = {
    checkAuthStatus: vi.fn(),
    isAuthenticated: vi.fn(),
  };

  beforeEach(async () => {
    mockRouter = {
      navigate: vi.fn(),
    };

    // Reset mocks before each test
    mockAuthService.checkAuthStatus.mockReset();
    mockAuthService.isAuthenticated.mockReset();

    await TestBed.configureTestingModule({
      imports: [LoginSuccessComponent],
      providers: [
        provideNoopAnimations(),
        { provide: Router, useValue: mockRouter },
        { provide: IAuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginSuccessComponent);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should redirect to / on successful auth check', async () => {
    // 1. Mock the API call completing
    mockAuthService.checkAuthStatus.mockReturnValue(
      of({ authenticated: true }),
    );
    // 2. Mock the signal state being true (simulating the side effect of the call)
    mockAuthService.isAuthenticated.mockReturnValue(true);

    fixture.detectChanges(); // Triggers ngOnInit
    await fixture.whenStable(); // Waits for the promise/observable

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should redirect to /login on failed auth check', async () => {
    // 1. API completes (returning null or unauthenticated DTO)
    mockAuthService.checkAuthStatus.mockReturnValue(of(null));
    // 2. Signal state remains false
    mockAuthService.isAuthenticated.mockReturnValue(false);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { error: 'auth_failed' },
    });
  });

  it('should redirect to /login on network error', async () => {
    // 1. API throws error
    mockAuthService.checkAuthStatus.mockReturnValue(
      throwError(() => new Error('Network Error')),
    );

    fixture.detectChanges();
    await fixture.whenStable();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { error: 'auth_failed' },
    });
  });
});
