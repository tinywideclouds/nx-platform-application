import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ISODateTimeString } from '@nx-platform-application/platform-types';

import { KeyStorageService } from './key-storage.service';
import { KeyDatabase } from './db/key.database';
import { PublicKeyRecord } from './key-storage.models';

// --- Mocks ---
// Hoist the mock setup so it can be used in the module scope if needed
const { mockTable, mockKeyDb } = vi.hoisted(() => {
  const tableMock = {
    put: vi.fn(),
    get: vi.fn(),
    clear: vi.fn(),
  };
  return {
    mockTable: tableMock,
    mockKeyDb: {
      publicKeys: tableMock,
    },
  };
});

// --- Fixtures ---
const mockUrn = 'urn:auth:google:user-123';
const mockTimestamp = '2025-01-01T12:00:00Z' as ISODateTimeString;
const mockKeys = { encKey: 'base64-enc', sigKey: 'base64-sig' };

const mockRecord: PublicKeyRecord = {
  urn: mockUrn,
  keys: mockKeys,
  timestamp: mockTimestamp,
};

describe('KeyStorageService', () => {
  let service: KeyStorageService;

  beforeEach(() => {
    vi.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        KeyStorageService,
        { provide: KeyDatabase, useValue: mockKeyDb },
      ],
    });

    service = TestBed.inject(KeyStorageService);
    
    // Default returns
    mockTable.get.mockResolvedValue(mockRecord);
    mockTable.put.mockResolvedValue(undefined);
    mockTable.clear.mockResolvedValue(undefined);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('storeKey', () => {
    it('should put a record into the publicKeys table', async () => {
      await service.storeKey(mockUrn, mockKeys, mockTimestamp);
      expect(mockKeyDb.publicKeys.put).toHaveBeenCalledWith(mockRecord);
    });
  });

  describe('getKey', () => {
    it('should retrieve a record by URN string', async () => {
      const result = await service.getKey(mockUrn);
      expect(mockKeyDb.publicKeys.get).toHaveBeenCalledWith(mockUrn);
      expect(result).toEqual(mockRecord);
    });

    it('should return null if record not found', async () => {
      mockTable.get.mockResolvedValue(undefined);
      const result = await service.getKey('unknown-urn');
      expect(result).toBeNull();
    });
  });

  describe('clearDatabase', () => {
    it('should clear the publicKeys table', async () => {
      await service.clearDatabase();
      expect(mockKeyDb.publicKeys.clear).toHaveBeenCalled();
    });
  });
});