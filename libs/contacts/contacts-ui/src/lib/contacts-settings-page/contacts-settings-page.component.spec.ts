import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsSettingsPageComponent } from './contacts-settings-page.component';
import { signal } from '@angular/core';

import { ContactsStateService } from '@nx-platform-application/contacts-state';
import { ContactsCloudService } from '@nx-platform-application/contacts-cloud-access';

import { MockComponent, MockProvider } from 'ng-mocks';
import { ContactsSecurityComponent } from '../contacts-security/contacts-security.component';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BackupFile } from '@nx-platform-application/platform-cloud-access';

const mockBackup: BackupFile = {
  fileId: 'f1',
  name: 'backup.json',
  createdAt: '2025-01-01',
  sizeBytes: 100,
};

describe('ContactsSettingsPageComponent', () => {
  let component: ContactsSettingsPageComponent;
  let fixture: ComponentFixture<ContactsSettingsPageComponent>;
  let cloudService: ContactsCloudService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ContactsSettingsPageComponent,
        MockComponent(ContactsSecurityComponent),
      ],
      providers: [
        // ✅ FIX: Use useValue to avoid class instantiation/toSignal crash
        {
          provide: ContactsStateService,
          useValue: { pending: signal([]) },
        },
        MockProvider(ContactsCloudService, {
          hasPermission: vi.fn().mockReturnValue(true),
          listBackups: vi.fn().mockResolvedValue([mockBackup]),
          backupToCloud: vi.fn(),
          restoreFromCloud: vi.fn(),
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsSettingsPageComponent);
    component = fixture.componentInstance;
    cloudService = TestBed.inject(ContactsCloudService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load backups on init', async () => {
    await fixture.whenStable();
    expect(cloudService.listBackups).toHaveBeenCalled();
    expect(component.cloudBackups()).toEqual([mockBackup]);
  });

  it('should trigger backup', async () => {
    await component.backupToCloud();
    expect(cloudService.backupToCloud).toHaveBeenCalled();
  });
});
