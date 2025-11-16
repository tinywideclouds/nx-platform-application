import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { AuthService } from './auth.service';
import { User } from '@nx-platform-application/platform-types';
import { MockAuthService } from './testing/mock-auth.service';
import { AUTH_API_URL } from './auth-data.config'; // <-- 1. Import the token

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

// --- 2. Define the mock URL for this test suite ---
const MOCK_AUTH_URL = '/api/auth';

describe('AuthService', () => {
  let service: AuthService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
        // --- 3. Provide the mock token ---
        { provide: AUTH_API_URL, useValue: MOCK_AUTH_URL },
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
    expect(service).toBeTruthy();
  });

  it('should have correct initial state', () => {
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBeFalsy();
    expect(service.getJwtToken()).toBeNull();
  });

  it('should set state on success when sessionLoaded$ is subscribed to', () => {
    service.sessionLoaded$.subscribe();

    // --- 4. Update the expected URL ---
    const req = httpTestingController.expectOne(`${MOCK_AUTH_URL}/status`);
    expect(req.request.method).toBe('GET');
    req.flush(mockAuthResponse);

    expect(service.currentUser()).toEqual(mockUser);
    expect(service.isAuthenticated()).toBeTruthy();
    expect(service.getJwtToken()).toBe('mock-jwt-token-123');
  });

  it('should clear state on failure when sessionLoaded$ is subscribed to', () => {
    service.sessionLoaded$.subscribe();

    // --- 5. Update the expected URL ---
    const req = httpTestingController.expectOne(`${MOCK_AUTH_URL}/status`);
    expect(req.request.method).toBe('GET');
    req.flush('Error', { status: 401, statusText: 'Unauthorized' });

    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBeFalsy();
    expect(service.getJwtToken()).toBeNull();
  });

  it('should clear state on logout', () => {
    service.sessionLoaded$.subscribe();
    const initReq = httpTestingController.expectOne(`${MOCK_AUTH_URL}/status`);
    initReq.flush(mockAuthResponse);
    expect(service.isAuthenticated()).toBeTruthy(); // Verify pre-condition

    service.logout().subscribe();

    // --- 6. Update the expected URL ---
    const logoutReq = httpTestingController.expectOne(`${MOCK_AUTH_URL}/logout`);
    expect(logoutReq.request.method).toBe('POST');
    logoutReq.flush({});

    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBeFalsy();
    expect(service.getJwtToken()).toBeNull();
  });

  it('should return the current token with getJwtToken()', () => {
    service.sessionLoaded$.subscribe();
    const initReq = httpTestingController.expectOne(`${MOCK_AUTH_URL}/status`);
    initReq.flush(mockAuthResponse);

    expect(service.getJwtToken()).toBe('mock-jwt-token-123');
  });
});

//
// --- THE LOCAL CONTRACT TEST ---
// This test also needs the provider
//
describe('MockAuthService Contract', () => {
  it('should be assignable to the real AuthService in TestBed', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useClass: MockAuthService },
        // --- 7. Add the provider here too ---
        { provide: AUTH_API_URL, useValue: MOCK_AUTH_URL }
      ],
    });

    const service = TestBed.inject(AuthService);
    expect(service).toBeInstanceOf(MockAuthService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });
});