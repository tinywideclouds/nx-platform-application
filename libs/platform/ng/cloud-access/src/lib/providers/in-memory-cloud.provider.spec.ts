import { TestBed } from '@angular/core/testing';
import { InMemoryCloudProvider } from './in-memory-cloud.provider';
import { describe, it, expect, beforeEach } from 'vitest';

describe('InMemoryCloudProvider', () => {
  let provider: InMemoryCloudProvider;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InMemoryCloudProvider],
    });
    provider = TestBed.inject(InMemoryCloudProvider);
  });

  describe('Authentication', () => {
    it('should start without permission', () => {
      expect(provider.hasPermission()).toBe(false);
    });

    it('should grant permission on request', async () => {
      const result = await provider.requestAccess();
      expect(result).toBe(true);
      expect(provider.hasPermission()).toBe(true);
    });

    it('should revoke permission', async () => {
      await provider.requestAccess();
      await provider.revokeAccess();
      expect(provider.hasPermission()).toBe(false);
    });

    it('should throw error if accessing without permission', async () => {
      // Ensure we are logged out
      if (provider.hasPermission()) await provider.revokeAccess();

      // FIX: Expect 'Access Denied' exactly as thrown by implementation
      await expect(provider.listBackups('')).rejects.toThrow('Access Denied');
      await expect(provider.uploadFile({}, 'test.json')).rejects.toThrow(
        'Access Denied'
      );
    });
  });

  describe('Generic File Operations (Manifests & Indexes)', () => {
    beforeEach(async () => {
      await provider.requestAccess();
    });

    it('should upload and download a JSON object', async () => {
      const filename = 'chat_index.json';
      const data = [{ id: 1, name: 'Alice' }];

      // 1. Upload
      await provider.uploadFile(data, filename);

      // 2. Download
      const result = await provider.downloadFile<typeof data>(filename);
      expect(result).toEqual(data);
    });

    it('should return null if file does not exist', async () => {
      const result = await provider.downloadFile('missing_file.json');
      expect(result).toBeNull();
    });

    it('should overwrite existing files with the same name', async () => {
      const filename = 'config.json';
      await provider.uploadFile({ version: 1 }, filename);
      await provider.uploadFile({ version: 2 }, filename);

      const result = await provider.downloadFile<any>(filename);
      expect(result.version).toBe(2);
    });
  });

  describe('Backup Operations (Vaults)', () => {
    beforeEach(async () => {
      await provider.requestAccess();
    });

    it('should upload a backup and verify metadata', async () => {
      const filename = 'chat_vault_2024_01.json';
      const vaultData = { messages: [] };

      await provider.uploadBackup(vaultData, filename);

      // Verify it appears in the list
      const files = await provider.listBackups('chat_vault_');
      expect(files.length).toBe(1);
      expect(files[0].name).toBe(filename);
      expect(files[0].fileId).toBeTruthy();
      expect(files[0].sizeBytes).toBeGreaterThan(0);
    });

    it('should list backups filtering by prefix', async () => {
      await provider.uploadBackup({}, 'chat_vault_A.json');
      await provider.uploadBackup({}, 'chat_vault_B.json');
      await provider.uploadBackup({}, 'chat_manifest_A.json'); // Different prefix

      const vaults = await provider.listBackups('chat_vault_');
      expect(vaults.length).toBe(2);

      const manifests = await provider.listBackups('chat_manifest_');
      expect(manifests.length).toBe(1);
    });

    it('should download backup using fileId', async () => {
      const filename = 'my_backup.json';
      const data = { content: 'secret' };

      await provider.uploadBackup(data, filename);

      const files = await provider.listBackups(filename);
      const fileId = files[0].fileId;

      const downloaded = await provider.downloadBackup<any>(fileId);
      expect(downloaded).toEqual(data);
    });

    it('should throw error if downloading invalid fileId', async () => {
      await expect(provider.downloadBackup('invalid-id')).rejects.toThrow(
        'File not found'
      );
    });
  });
});
