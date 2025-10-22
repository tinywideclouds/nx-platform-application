import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { User } from '@nx-platform-application/platform-types';
import { MockAuthService } from './testing/mock-auth.service';

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
    httpTestingController.verify();
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    // 1. The service is created, but no HTTP call is made. This is correct.
    expect(service).toBeTruthy();
    // 2. We no longer expect any HTTP call here.
  });

  it('should have correct initial state', () => {
    // 1. State should be initial (service created, no calls made)
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBeFalsy();
    expect(service.getJwtToken()).toBeNull();
    // 2. We no longer expect any HTTP call here.
  });

  it('should set state on success when sessionLoaded$ is subscribed to', () => {
    // 1. Subscribe to the observable to trigger the HTTP call
    service.sessionLoaded$.subscribe();

    // 2. Now, we expect the call
    const req = httpTestingController.expectOne('/api/auth/status');
    expect(req.request.method).toBe('GET');
    req.flush(mockAuthResponse);

    // 3. Assert the state is set
    expect(service.currentUser()).toEqual(mockUser);
    expect(service.isAuthenticated()).toBeTruthy();
    expect(service.getJwtToken()).toBe('mock-jwt-token-123');
  });

  it('should clear state on failure when sessionLoaded$ is subscribed to', () => {
    // 1. Subscribe to the observable to trigger the HTTP call
    service.sessionLoaded$.subscribe();

    // 2. Now, we expect the call
    const req = httpTestingController.expectOne('/api/auth/status');
    expect(req.request.method).toBe('GET');
    req.flush('Error', { status: 401, statusText: 'Unauthorized' });

    // 3. Assert the state is cleared
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBeFalsy();
    expect(service.getJwtToken()).toBeNull();
  });

  it('should clear state on logout', () => {
    // 1. Get into logged-in state
    service.sessionLoaded$.subscribe();
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
    // 1. Get to a logged-in state
    service.sessionLoaded$.subscribe();
    const initReq = httpTestingController.expectOne('/api/auth/status');
    initReq.flush(mockAuthResponse);

    // 2. Assert the token is correct
    expect(service.getJwtToken()).toBe('mock-jwt-token-123');
  });
});

//
// --- THE LOCAL CONTRACT TEST ---
// (This test was fine and needs no changes)
//
describe('MockAuthService Contract', () => {
  it('should be assignable to the real AuthService in TestBed', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useClass: MockAuthService },
      ],
    });

    const service = TestBed.inject(AuthService);
    expect(service).toBeInstanceOf(MockAuthService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });
});
