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
import { IAuthService } from '@nx-platform-application/platform-auth-data-access';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor (Zoneless + Globals)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let mockAuthService: { getJwtToken: ReturnType<typeof vi.fn> };
  const testUrl = '/api/test';
  const testToken = 'test-jwt-token-123';

  const setupTestBed = (token: string | null) => {
    mockAuthService = {
      getJwtToken: vi.fn().mockReturnValue(token),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: IAuthService, useValue: mockAuthService },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  };

  afterEach(() => {
    httpMock.verify();
  });

  it('should add an Authorization header if a token exists', () => {
    setupTestBed(testToken);

    http.get(testUrl).subscribe();

    const req = httpMock.expectOne(testUrl);
    expect(req.request.headers.has('Authorization')).toBe(true);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${testToken}`);

    req.flush({});
  });

  it('should not add an Authorization header if no token exists', () => {
    setupTestBed(null);

    http.get(testUrl).subscribe();

    const req = httpMock.expectOne(testUrl);
    expect(req.request.headers.has('Authorization')).toBe(false);

    req.flush({});
  });
});
