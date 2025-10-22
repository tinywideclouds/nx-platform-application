import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { LoginSuccessComponent } from './login-success';
import { User } from '@nx-platform-application/platform-types';

import { IAuthService } from '@nx-platform-application/platform-auth-data-access';
import { MockAuthService } from '@nx-platform-application/platform-auth-data-access/testing';

const mockUser: User = {
  id: '1',
  alias: 'Test User',
  email: 'test@example.com',
};

describe('LoginSuccessComponent', () => {
  let fixture: ComponentFixture<LoginSuccessComponent>;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockAuthService: MockAuthService;

  beforeEach(async () => {
    mockRouter = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LoginSuccessComponent],
      providers: [
        provideNoopAnimations(),
        { provide: Router, useValue: mockRouter },
        { provide: IAuthService, useClass: MockAuthService },
      ],
    }).compileComponents();

    mockAuthService = TestBed.inject(IAuthService) as unknown as MockAuthService;
    fixture = TestBed.createComponent(LoginSuccessComponent);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should redirect to / on successful auth check', async () => {
    // Arrange
    mockAuthService.mockCheckAuthStatusSuccess(mockUser);

    // Act
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Assert
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should redirect to /login on failed auth check', async () => {
    // Arrange
    mockAuthService.mockCheckAuthStatusFailure();

    // Act
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Assert
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { error: 'auth_failed' },
    });
  });

  it('should redirect to /login on network error', async () => {
    // Arrange
    mockAuthService.mockCheckAuthStatusError();

    // Act
    // We trigger ngOnInit. The component's try/catch will handle the error.
    fixture.detectChanges();
    // We wait for the promise (which is caught) to resolve and for the
    // catch block to finish executing.
    await fixture.whenStable();
    // We run change detection again to make sure any UI updates from the
    // catch block are rendered.
    fixture.detectChanges();

    // Assert
    // Now we assert the outcome: the component should have navigated.
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { error: 'auth_failed' },
    });
  });
});

