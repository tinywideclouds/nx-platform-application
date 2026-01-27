import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { DirectoryScenarioService } from './directory-scenario.service';
import { DirectoryStorageService } from '@nx-platform-application/directory-infrastructure-storage';
import { directoryScenarios } from './data/directory-scenarios.const';

describe('DirectoryScenarioService', () => {
  let service: DirectoryScenarioService;
  let mockStorage: DirectoryStorageService;

  beforeEach(() => {
    // 1. Mock the Storage Service
    mockStorage = {
      clearDatabase: vi.fn(),
      bulkUpsert: vi.fn(),
      saveGroup: vi.fn(),
    } as unknown as DirectoryStorageService;

    // 2. Configure Bed
    TestBed.configureTestingModule({
      providers: [
        DirectoryScenarioService,
        { provide: DirectoryStorageService, useValue: mockStorage },
      ],
    });

    service = TestBed.inject(DirectoryScenarioService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initialize', () => {
    it('should wipe DB and seed "populated" scenario by default', async () => {
      // Act
      await service.initialize('populated');

      // Assert
      // 1. Wiped?
      expect(mockStorage.clearDatabase).toHaveBeenCalled();

      // 2. Seeded Entities?
      expect(mockStorage.bulkUpsert).toHaveBeenCalledWith(
        directoryScenarios.populated.entities,
      );

      // 3. Seeded Groups?
      expect(mockStorage.saveGroup).toHaveBeenCalledWith(
        directoryScenarios.populated.groups[0],
      );
    });

    it('should handle "empty" scenario', async () => {
      // Act
      await service.initialize('empty');

      // Assert
      expect(mockStorage.clearDatabase).toHaveBeenCalled();
      // Should NOT call save (arrays are empty)
      expect(mockStorage.bulkUpsert).not.toHaveBeenCalled();
      expect(mockStorage.saveGroup).not.toHaveBeenCalled();
    });

    it('should ignore unknown scenarios gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn');
      await service.initialize('invalid-key');

      expect(mockStorage.clearDatabase).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown scenario'),
      );
    });
  });
});
