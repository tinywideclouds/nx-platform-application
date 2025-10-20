import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { User } from '@nx-platform-application/platform-types';

// --- Mock Data ---
const mockUser: User = {
  id: '123',
  alias: 'Test User',
  email: 'test@example.com',
};

const mockAuthResponse = {
  authenticated: true,
  user: mockUser,
  token: 'mock-jwt-token-123',
};

describe('AuthService', () => {
  let service: AuthService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
      ],
    });

    httpTestingController = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    // 1. Verify that no unhandled requests are pending
    httpTestingController.verify();

    // 2. Reset the TestBed to fix the "Cannot configure" error
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    const req = httpTestingController.expectOne('/api/auth/status');
    req.flush('Error', { status: 401, statusText: 'Unauthorized' });
    expect(service).toBeTruthy();
  });

  it('should have correct initial state before auth check completes', () => {
    // State should be initial (service created, but init request not flushed)
    expect(service.currentUser()).toBeNull();

    /**
     * CORRECTED: The initial state should be falsy, not truthy.
     */
    expect(service.isAuthenticated()).toBeFalsy();
    expect(service.getJwtToken()).toBeNull();

    // Flush the pending request
    const req = httpTestingController.expectOne('/api/auth/status');
    req.flush('Error', { status: 401, statusText: 'Unauthorized' });
  });

  it('should checkAuthStatus on init and set state on success', () => {
    const req = httpTestingController.expectOne('/api/auth/status');
    expect(req.request.method).toBe('GET');
    req.flush(mockAuthResponse);

    expect(service.currentUser()).toEqual(mockUser);
    expect(service.isAuthenticated()).toBeTruthy();
    expect(service.getJwtToken()).toBe('mock-jwt-token-123');
  });

  it('should checkAuthStatus on init and clear state on failure', () => {
    const req = httpTestingController.expectOne('/api/auth/status');
    expect(req.request.method).toBe('GET');
    req.flush('Error', { status: 401, statusText: 'Unauthorized' });

    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBeFalsy();
    expect(service.getJwtToken()).toBeNull();
  });

  it('should clear state on logout', () => {
    // 1. Get into logged-in state (and handle constructor call)
    const initReq = httpTestingController.expectOne('/api/auth/status');
    initReq.flush(mockAuthResponse);
    expect(service.isAuthenticated()).toBeTruthy(); // Verify pre-condition

    // 2. Call logout
    service.logout().subscribe();

    // 3. Expect and flush POST
    const logoutReq = httpTestingController.expectOne('/api/auth/logout');
    expect(logoutReq.request.method).toBe('POST');
    logoutReq.flush({});

    // 4. Check cleared state
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBeFalsy();
    expect(service.getJwtToken()).toBeNull();
  });

  it('should return the current token with getJwtToken()', () => {
    // Get to a logged-in state (and handle constructor call)
    const initReq = httpTestingController.expectOne('/api/auth/status');
    initReq.flush(mockAuthResponse);

    expect(service.getJwtToken()).toBe('mock-jwt-token-123');
  });
});
