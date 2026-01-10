import { ComponentFixture, TestBed } from '@angular/core/testing';
import { KeySettingsPageComponent } from './key-settings-page.component';
import { ChatService } from '@nx-platform-application/messenger-state-app';
import { KeyCacheService } from '@nx-platform-application/messenger-infrastructure-key-cache';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MockProvider, MockComponent } from 'ng-mocks';
import { Logger } from '@nx-platform-application/console-logger';
import { KeySettingsContentComponent } from '../key-settings-content/key-settings-content.component';

describe('KeySettingsPageComponent', () => {
  let component: KeySettingsPageComponent;
  let fixture: ComponentFixture<KeySettingsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KeySettingsPageComponent],
      providers: [
        MockProvider(ChatService),
        MockProvider(KeyCacheService),
        MockProvider(MatDialog),
        MockProvider(MatSnackBar),
        MockProvider(Logger),
      ],
    })
      .overrideComponent(KeySettingsPageComponent, {
        remove: { imports: [KeySettingsContentComponent] },
        add: { imports: [MockComponent(KeySettingsContentComponent)] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(KeySettingsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the header', () => {
    const header = fixture.nativeElement.querySelector('header');
    expect(header.textContent).toContain('Keys & Routing');
  });

  it('should render the content component', () => {
    const content = fixture.nativeElement.querySelector(
      'lib-key-settings-content',
    );
    expect(content).toBeTruthy();
  });
});
