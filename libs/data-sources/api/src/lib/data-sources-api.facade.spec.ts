import { TestBed } from '@angular/core/testing';
import { DataSourcesApiFacade } from './data-sources-api.facade';
import { DataSourceFilesClient } from '@nx-platform-application/data-sources-infrastructure-data-access';
import { URN } from '@nx-platform-application/platform-types';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('DataSourcesApiFacade', () => {
  let facade: DataSourcesApiFacade;

  const mockFilesClient = {
    listDataSourceFiles: vi.fn(),
    getDataSourceFileContent: vi.fn(),
  };

  const dsUrn = URN.parse('urn:datasource:stream:123');

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        DataSourcesApiFacade,
        { provide: DataSourceFilesClient, useValue: mockFilesClient },
      ],
    });

    facade = TestBed.inject(DataSourcesApiFacade);
  });

  it('should list files by delegating to the internal client', async () => {
    const mockMeta = [{ path: 'main.go', sizeBytes: 1024, extension: '.go' }];
    mockFilesClient.listDataSourceFiles.mockReturnValue(of(mockMeta));

    const result = await facade.listFiles(dsUrn);

    expect(mockFilesClient.listDataSourceFiles).toHaveBeenCalledWith(dsUrn);
    expect(result).toEqual(mockMeta);
  });

  it('should encode the path and get file content', async () => {
    mockFilesClient.getDataSourceFileContent.mockReturnValue(
      of({ content: 'package main' }),
    );

    const result = await facade.getFileContent(dsUrn, 'src/main.go');

    // btoa('src/main.go') -> 'c3JjL21haW4uZ28='
    expect(mockFilesClient.getDataSourceFileContent).toHaveBeenCalledWith(
      dsUrn,
      'c3JjL21haW4uZ28=',
    );
    expect(result).toBe('package main');
  });
});
