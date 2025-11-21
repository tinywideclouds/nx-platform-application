import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import { AuthService } from './auth.service';
// --- 1. Import URN and User ---
import { User, URN } from '@nx-platform-application/platform-types';
import { MockTestingAuthService } from './testing/mock-auth.service';
import { AUTH_API_URL } from './auth-data.config';

// --- 2. Define mock domain object and DTO ---
const mockUserDomain: User = {
  id: URN.parse('urn:sm:user:123'),
  alias: 'Test User',
  email: 'test@example.com',
};

// This is the DTO (raw JSON) the API sends
const mockAuthResponseDTO = {
  authenticated: true,
  user: {
    id: 'urn:sm:user:123', // <-- The ID is a string here
    alias: 'Test User',
    email: 'test@example.com',
  },
  token: 'mock-jwt-token-123',
};
// --- END CHANGES ---

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

    const req = httpTestingController.expectOne(`${MOCK_AUTH_URL}/status`);
    expect(req.request.method).toBe('GET');
    // --- 3. Flush the DTO, not the domain object ---
    req.flush(mockAuthResponseDTO);

    // --- 4. Assert against the parsed domain object ---
    expect(service.currentUser()).toEqual(mockUserDomain);
    expect(service.isAuthenticated()).toBeTruthy();
    expect(service.getJwtToken()).toBe('mock-jwt-token-123');
  });

  it('should clear state on failure when sessionLoaded$ is subscribed to', () => {
    service.sessionLoaded$.subscribe();

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
    // --- 5. Flush DTO here too ---
    initReq.flush(mockAuthResponseDTO);
    expect(service.isAuthenticated()).toBeTruthy(); // Verify pre-condition

    service.logout().subscribe();

    const logoutReq = httpTestingController.expectOne(
      `${MOCK_AUTH_URL}/logout`
    );
    expect(logoutReq.request.method).toBe('POST');
    logoutReq.flush({});

    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBeFalsy();
    expect(service.getJwtToken()).toBeNull();
  });

  it('should return the current token with getJwtToken()', () => {
    service.sessionLoaded$.subscribe();
    const initReq = httpTestingController.expectOne(`${MOCK_AUTH_URL}/status`);
    // --- 6. Flush DTO here too ---
    initReq.flush(mockAuthResponseDTO);

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
        { provide: AuthService, useClass: MockTestingAuthService },
        { provide: AUTH_API_URL, useValue: MOCK_AUTH_URL },
      ],
    });

    const service = TestBed.inject(AuthService);
    expect(service).toBeInstanceOf(MockTestingAuthService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });
});
