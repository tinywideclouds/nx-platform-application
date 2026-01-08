import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IdentitySettingsContentComponent } from '../identity-settings-content/identity-settings-content.component';

@Component({
  selector: 'lib-identity-settings-page',
  standalone: true,
  imports: [CommonModule, IdentitySettingsContentComponent],
  templateUrl: './identity-settings-page.component.html',
  styleUrl: './identity-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentitySettingsPageComponent {}
