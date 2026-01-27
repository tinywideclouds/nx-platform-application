import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { of } from 'rxjs';
import { ContactsSyncService } from './contacts-sync.service';
import {
  ContactsStorageService,
  GatekeeperStorage,
} from '@nx-platform-application/contacts-infrastructure-storage';
import { StorageService } from '@nx-platform-application/platform-domain-storage';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';
import { BackupPayload } from './models/backup-payload.interface';

// --- MOCKS ---

const mockDriver = {
  writeJson: vi.fn(),
  readJson: vi.fn(),
  providerId: 'mock',
  displayName: 'Mock Drive',
  link: vi.fn(),
  unlink: vi.fn(),
  isAuthenticated: vi.fn(),
  fileExists: vi.fn(),
  listFiles: vi.fn(),
  uploadPublicAsset: vi.fn(),
};

const mockStorageService = {
  getActiveDriver: vi.fn(),
};

const mockContactsStorage = {
  contacts$: of([{ id: 'urn:user:1' }]),
  groups$: of([{ id: 'urn:group:1' }]),
  bulkUpsert: vi.fn(),
  saveGroup: vi.fn(),
};

const mockGatekeeperStorage = {
  blocked$: of([{ urn: 'urn:blocked:1', scopes: ['all'], reason: 'spam' }]),
  blockIdentity: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

const BASE_PATH = 'tinywide/contacts';

describe('ContactsSyncService', () => {
  let service: ContactsSyncService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: Driver is connected
    mockStorageService.getActiveDriver.mockReturnValue(mockDriver);

    TestBed.configureTestingModule({
      providers: [
        ContactsSyncService,
        { provide: ContactsStorageService, useValue: mockContactsStorage },
        { provide: GatekeeperStorage, useValue: mockGatekeeperStorage },
        { provide: StorageService, useValue: mockStorageService },
        { provide: Logger, useValue: mockLogger },
      ],
    });

    service = TestBed.inject(ContactsSyncService);
  });

  describe('backup()', () => {
    it('should create a blind delta file', async () => {
      await service.backup();

      expect(mockDriver.writeJson).toHaveBeenCalledWith(
        expect.stringMatching(
          /tinywide\/contacts\/deltas\/\d+_generation\.json$/,
        ),
        expect.objectContaining({
          contacts: expect.arrayContaining([
            expect.objectContaining({ id: 'urn:user:1' }),
          ]),
          groups: expect.arrayContaining([
            expect.objectContaining({ id: 'urn:group:1' }),
          ]),
        }),
        { blindCreate: true },
      );
    });

    it('should do nothing if no driver is connected', async () => {
      mockStorageService.getActiveDriver.mockReturnValue(null);
      await service.backup();
      expect(mockDriver.writeJson).not.toHaveBeenCalled();
    });
  });

  describe('restore()', () => {
    it('should merge snapshot and deltas correctly', async () => {
      // 1. Snapshot: Contains Old User
      mockDriver.readJson.mockImplementation((path) => {
        if (path.includes('snapshot')) {
          return Promise.resolve({
            version: 1,
            contacts: [{ id: 'urn:user:old' }],
            groups: [],
            blocked: [],
          });
        }
        // 2. Delta: Contains New User
        if (path.includes('delta')) {
          return Promise.resolve({
            version: 1,
            contacts: [{ id: 'urn:user:new' }],
            groups: [{ id: 'urn:group:new' }],
            blocked: [],
          });
        }
        return Promise.resolve(null);
      });

      mockDriver.listFiles.mockResolvedValue(['delta_1.json']);

      await service.restore();

      // Check List Files
      expect(mockDriver.listFiles).toHaveBeenCalledWith(`${BASE_PATH}/deltas`);

      // Check Merge & Save (Contacts)
      expect(mockContactsStorage.bulkUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'urn:user:old' }),
          expect.objectContaining({ id: 'urn:user:new' }),
        ]),
      );

      // Check Groups (Parallel Save)
      expect(mockContactsStorage.saveGroup).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'urn:group:new' }),
      );
    });

    it('should gracefully handle invalid delta files', async () => {
      // Snapshot OK
      mockDriver.readJson.mockResolvedValueOnce({
        contacts: [],
        groups: [],
        blocked: [],
      });

      // Delta is NULL or Corrupt
      mockDriver.listFiles.mockResolvedValue(['bad_delta.json']);
      mockDriver.readJson.mockResolvedValueOnce(null);

      await service.restore();

      // Should not crash, just restore empty snapshot
      expect(mockContactsStorage.bulkUpsert).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Restored 0 contacts'),
      );
    });

    it('should trigger compaction if too many deltas exist', async () => {
      const manyDeltas = Array(6).fill('delta.json');
      mockDriver.listFiles.mockResolvedValue(manyDeltas);
      mockDriver.readJson.mockResolvedValue({
        contacts: [],
        groups: [],
        blocked: [],
      });

      await service.restore();

      expect(mockDriver.writeJson).toHaveBeenCalledWith(
        `${BASE_PATH}/snapshot.json`,
        expect.any(Object),
      );
    });
  });
});
