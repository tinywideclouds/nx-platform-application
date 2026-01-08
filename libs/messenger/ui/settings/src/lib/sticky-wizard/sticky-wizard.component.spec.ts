import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StickyWizardComponent } from './sticky-wizard.component';
import { MockComponent } from 'ng-mocks';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Child Content Components
import { IdentitySettingsContentComponent } from '../identity-settings-content/identity-settings-content.component';
import { KeySettingsContentComponent } from '../key-settings-content/key-settings-content.component';
import { DataSettingsContentComponent } from '../data-settings-content/data-settings-content.component';

describe('StickyWizardComponent', () => {
  let component: StickyWizardComponent;
  let fixture: ComponentFixture<StickyWizardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StickyWizardComponent],
    })
      .overrideComponent(StickyWizardComponent, {
        remove: {
          imports: [
            IdentitySettingsContentComponent,
            KeySettingsContentComponent,
            DataSettingsContentComponent,
          ],
        },
        add: {
          imports: [
            MockComponent(IdentitySettingsContentComponent),
            MockComponent(KeySettingsContentComponent),
            MockComponent(DataSettingsContentComponent),
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(StickyWizardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the three content sections', () => {
    expect(
      fixture.nativeElement.querySelector('lib-identity-settings-content'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('lib-key-settings-content'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('lib-data-settings-content'),
    ).toBeTruthy();
  });

  it('should emit close event when button clicked', () => {
    const emitSpy = vi.spyOn(component.close, 'emit');
    const btn = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(emitSpy).toHaveBeenCalled();
  });
});
