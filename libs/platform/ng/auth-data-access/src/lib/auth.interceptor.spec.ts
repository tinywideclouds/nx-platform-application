import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

// --- Import the new library's code ---
import { authInterceptor } from './auth.interceptor';
import { IAuthService } from './auth.service';
import { AUTH_API_URL } from './auth-data.config';

describe('authInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  
  let authServiceMock: Partial<IAuthService>; // <-- Use the new AuthService

  // Use a constant for the test, just like the old 'environment' variable
  const mockAuthApiUrl = 'http://localhost:3000/api/auth';

  const setup = (mock: Partial<IAuthService>) => {
    authServiceMock = mock;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: IAuthService, useValue: authServiceMock }, // <-- Provide the new AuthService
        { provide: AUTH_API_URL, useValue: mockAuthApiUrl }, // <-- Provide the new Token
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
  };

  afterEach(() => {
    httpMock.verify();
  });

  it('should add an Authorization header for non-identity service requests', () => {
    setup({ getJwtToken: () => 'test-jwt-token' }); // <-- Use getJwtToken()
    httpClient.get('/api/data').subscribe();
    const req = httpMock.expectOne('/api/data');
    expect(req.request.headers.has('Authorization')).toBe(true);
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt-token');
    req.flush({});
  });

  it('should set withCredentials for identity service requests', () => {
    setup({ getJwtToken: () => null }); // <-- Use getJwtToken()
    httpClient.get(mockAuthApiUrl + '/me').subscribe(); // <-- Use the mock URL constant
    const req = httpMock.expectOne(mockAuthApiUrl + '/me');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('should not add an Authorization header if token does not exist', () => {
    setup({ getJwtToken: () => null }); // <-- Use getJwtToken()
    httpClient.get('/api/data').subscribe();
    const req = httpMock.expectOne('/api/data');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('should NOT add Authorization header for identity service requests even if a token exists', () => {
    setup({ getJwtToken: () => 'test-jwt-token' }); // <-- Use getJwtToken()
    httpClient.get(mockAuthApiUrl + '/me').subscribe(); // <-- Use the mock URL constant
    const req = httpMock.expectOne(mockAuthApiUrl + '/me');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.withCredentials).toBe(true); // Still should have credentials
    req.flush({});
  });
});