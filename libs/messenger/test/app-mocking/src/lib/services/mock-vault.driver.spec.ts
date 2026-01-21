import { TestBed } from '@angular/core/testing';
import { MockVaultDriver } from './mock-vault.driver';
import { describe, it, expect, beforeEach } from 'vitest';

describe('MockVaultDriver', () => {
  let driver: MockVaultDriver;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MockVaultDriver],
    });
    driver = TestBed.inject(MockVaultDriver);
  });

  describe('Authentication', () => {
    it('should start unauthenticated', () => {
      expect(driver.isAuthenticated()).toBe(false);
    });

    it('should switch state on link/unlink', async () => {
      await driver.link(true);
      expect(driver.isAuthenticated()).toBe(true);

      await driver.unlink();
      expect(driver.isAuthenticated()).toBe(false);
    });
  });

  describe('Data Plane (JSON)', () => {
    it('should write and read JSON data', async () => {
      const path = 'settings.json';
      const data = { theme: 'dark', notifications: true };

      await driver.writeJson(path, data);
      const result = await driver.readJson(path);

      expect(result).toEqual(data);
    });

    it('should return null for non-existent files', async () => {
      const result = await driver.readJson('ghost.json');
      expect(result).toBeNull();
    });

    it('should correctly report file existence', async () => {
      await driver.writeJson('exists.json', {});
      expect(await driver.fileExists('exists.json')).toBe(true);
      expect(await driver.fileExists('missing.json')).toBe(false);
    });

    it('should list files in a "directory" (prefix match)', async () => {
      await driver.writeJson('folder/a.json', {});
      await driver.writeJson('folder/b.json', {});
      await driver.writeJson('other/c.json', {});

      const list = await driver.listFiles('folder/');
      expect(list).toHaveLength(2);
      expect(list).toContain('a.json');
      expect(list).toContain('b.json');
    });
  });

  describe('Asset Plane', () => {
    it('should upload assets and return a valid resource ID', async () => {
      const blob = new Blob(['image-data'], { type: 'image/png' });
      const result = await driver.uploadAsset(
        blob,
        'avatar.png',
        'public',
        'image/png',
      );

      expect(result.provider).toBe('google-drive'); // Masquerading
      expect(result.resourceId).toBeDefined();
      expect(result.resourceId).toContain('mock-asset-');
    });

    it('should provide a download link (dummy data URI)', async () => {
      const link = await driver.downloadAsset('any-id');
      expect(link).toContain('data:image/png;base64');
    });
  });
});
