import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { firstValueFrom } from 'rxjs';

import { DataSourceFilesClient } from './datasource-files.client';
import { URN } from '@nx-platform-application/platform-types';

describe('DataSourceFilesClient', () => {
  let client: DataSourceFilesClient;
  let httpMock: HttpTestingController;

  const dsUrn = URN.parse('urn:datasource:stream:123');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DataSourceFilesClient,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    client = TestBed.inject(DataSourceFilesClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should list data source file metadata via GET /v1/data/sources/{id}/files', async () => {
    const promise = firstValueFrom(client.listDataSourceFiles(dsUrn));

    // The URN should be correctly URL-encoded in the path
    const req = httpMock.expectOne(
      '/v1/data/sources/urn%3Adatasource%3Astream%3A123/files',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('text');

    // Simulate the raw JSON string the Go backend will send
    req.flush(
      JSON.stringify([
        { path: 'src/main.go', size_bytes: 1024, extension: '.go' },
        { path: 'README.md', size_bytes: 256, extension: '.md' },
      ]),
    );

    const result = await promise;
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('src/main.go');
    expect(result[0].sizeBytes).toBe(1024);
  });

  it('should get data source file content via GET /v1/data/sources/{id}/files/{base64Path}/content', async () => {
    const base64Path = btoa('src/main.go');
    const promise = firstValueFrom(
      client.getDataSourceFileContent(dsUrn, base64Path),
    );

    const req = httpMock.expectOne(
      `/v1/data/sources/urn%3Adatasource%3Astream%3A123/files/${base64Path}/content`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('json'); // Default for standard HTTP GET

    req.flush({ content: 'package main\n\nfunc main() {}' });

    const result = await promise;
    expect(result.content).toBe('package main\n\nfunc main() {}');
  });
});
