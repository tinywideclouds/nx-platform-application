import { TestBed } from '@angular/core/testing';
import { DataSourceTargetAdapter } from './data-source-target.adapter';
import { DataSourcesApiFacade } from '@nx-platform-application/data-sources-api';
import { URN } from '@nx-platform-application/platform-types';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('DataSourceTargetAdapter', () => {
  let adapter: DataSourceTargetAdapter;

  const mockApiFacade = {
    getFileContent: vi.fn(),
  };

  const sandboxUrn = URN.parse('urn:datasource:stream:123');

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        DataSourceTargetAdapter,
        { provide: DataSourcesApiFacade, useValue: mockApiFacade },
      ],
    });

    adapter = TestBed.inject(DataSourceTargetAdapter);
  });

  it('should fetch the base file content via the data sources facade', async () => {
    mockApiFacade.getFileContent.mockResolvedValue('package main');

    const result = await adapter.getBaseFileContent(sandboxUrn, 'main.go');

    expect(mockApiFacade.getFileContent).toHaveBeenCalledWith(
      sandboxUrn,
      'main.go',
    );
    expect(result).toBe('package main');
  });

  it('should gracefully return null if the facade throws an error (e.g. 404 File Not Found)', async () => {
    mockApiFacade.getFileContent.mockRejectedValue(new Error('404 Not Found'));

    const result = await adapter.getBaseFileContent(sandboxUrn, 'new-file.ts');

    expect(result).toBeNull();
  });
});
