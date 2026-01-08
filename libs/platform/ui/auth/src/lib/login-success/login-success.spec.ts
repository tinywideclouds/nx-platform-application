import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { LoginSuccessComponent } from './login-success';
import { User, URN } from '@nx-platform-application/platform-types';
import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { MockTestingAuthService } from '@nx-platform-application/platform-auth-access/testing';

const mockUser: User = {
  id: URN.parse('urn:contacts:user:1'),
  alias: 'Test User',
  email: 'test@example.com',
};

describe('LoginSuccessComponent', () => {
  let fixture: ComponentFixture<LoginSuccessComponent>;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockAuthService: MockTestingAuthService;

  beforeEach(async () => {
    mockRouter = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LoginSuccessComponent],
      providers: [
        provideNoopAnimations(),
        { provide: Router, useValue: mockRouter },
        { provide: IAuthService, useClass: MockTestingAuthService },
      ],
    }).compileComponents();

    mockAuthService = TestBed.inject(
      IAuthService,
    ) as unknown as MockTestingAuthService;
    fixture = TestBed.createComponent(LoginSuccessComponent);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should redirect to / on successful auth check', async () => {
    mockAuthService.mockCheckAuthStatusSuccess(mockUser);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should redirect to /login on failed auth check', async () => {
    mockAuthService.mockCheckAuthStatusFailure();

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { error: 'auth_failed' },
    });
  });

  it('should redirect to /login on network error', async () => {
    mockAuthService.mockCheckAuthStatusError();

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { error: 'auth_failed' },
    });
  });
});
