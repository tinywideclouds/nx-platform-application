import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContactsSettingsPageComponent } from './contacts-settings-page.component';
import { ContactsSyncService } from '@nx-platform-application/contacts-sync';
import { ContactsSecurityComponent } from '../contacts-security/contacts-security.component';
import { MockComponent, MockProvider } from 'ng-mocks';
import { MatSnackBar } from '@angular/material/snack-bar';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ContactsSettingsPageComponent', () => {
  let component: ContactsSettingsPageComponent;
  let fixture: ComponentFixture<ContactsSettingsPageComponent>;
  let syncService: ContactsSyncService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ContactsSettingsPageComponent,
        MockComponent(ContactsSecurityComponent),
      ],
      providers: [
        MockProvider(ContactsSyncService, {
          backup: vi.fn().mockResolvedValue(undefined),
          restore: vi.fn().mockResolvedValue(undefined),
        }),
        MockProvider(MatSnackBar),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContactsSettingsPageComponent);
    component = fixture.componentInstance;
    syncService = TestBed.inject(ContactsSyncService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should trigger backup', async () => {
    await component.backupToCloud();
    expect(syncService.backup).toHaveBeenCalled();
  });

  it('should trigger restore', async () => {
    // Mock confirm dialog
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await component.restoreFromCloud();

    expect(window.confirm).toHaveBeenCalled();
    expect(syncService.restore).toHaveBeenCalled();
  });
});
