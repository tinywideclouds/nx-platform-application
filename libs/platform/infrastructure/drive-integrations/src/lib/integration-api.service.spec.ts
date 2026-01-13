import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { IntegrationApiService } from './integration-api.service';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { IntegrationStatus } from '@nx-platform-application/platform-types';

describe('IntegrationApiService', () => {
  let service: IntegrationApiService;
  let httpMock: HttpTestingController;

  // Mock Logger to keep test output clean
  const mockLogger = {
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        IntegrationApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(IntegrationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.clearAllMocks();
  });

  describe('getStatus', () => {
    it('should return the status when API call succeeds', async () => {
      const mockStatus: IntegrationStatus = { google: true, dropbox: false };

      const statusPromise = service.getStatus();

      const req = httpMock.expectOne('/api/auth/integrations/status');
      expect(req.request.method).toBe('GET');
      req.flush(mockStatus);

      const result = await statusPromise;
      expect(result).toEqual(mockStatus);
    });

    it('should return default false/false when API call fails', async () => {
      const statusPromise = service.getStatus();

      const req = httpMock.expectOne('/api/auth/integrations/status');
      req.flush('Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await statusPromise;

      // Verify fail-safe behavior
      expect(result).toEqual({ google: false, dropbox: false });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to check status'),
        expect.anything(),
      );
    });
  });

  describe('disconnect', () => {
    it('should send delete request for provider', async () => {
      const disconnectPromise = service.disconnect('google');

      const req = httpMock.expectOne('/api/auth/integrations/google');
      expect(req.request.method).toBe('DELETE');
      req.flush({}); // 200 OK

      await expect(disconnectPromise).resolves.not.toThrow();
    });

    it('should propagate error when API call fails', async () => {
      const disconnectPromise = service.disconnect('google');

      const req = httpMock.expectOne('/api/auth/integrations/google');
      req.flush('Failed', { status: 400, statusText: 'Bad Request' });

      await expect(disconnectPromise).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
