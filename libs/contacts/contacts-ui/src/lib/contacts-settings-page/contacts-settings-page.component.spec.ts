import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsSettingsPageComponent } from './contacts-settings-page.component';
import {
  ContactsStorageService,
  PendingIdentity,
} from '@nx-platform-application/contacts-storage';
import {
  ContactsCloudService,
  CloudBackupMetadata,
} from '@nx-platform-application/contacts-cloud-access';
import { MockComponent, MockProvider } from 'ng-mocks';
import { PendingListComponent } from '../pending-list/pending-list.component';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of } from 'rxjs';

const mockBackup: CloudBackupMetadata = {
  fileId: 'f1',
  name: 'backup.json',
  createdAt: '',
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
        MockComponent(PendingListComponent),
      ],
      providers: [
        MockProvider(ContactsStorageService, {
          pending$: of([]),
          deletePending: vi.fn(),
          blockIdentity: vi.fn(),
        }),
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
