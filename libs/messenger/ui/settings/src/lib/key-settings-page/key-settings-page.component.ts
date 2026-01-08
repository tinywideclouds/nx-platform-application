import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KeySettingsContentComponent } from '../key-settings-content/key-settings-content.component';

@Component({
  selector: 'lib-keys-routing-settings-page',
  standalone: true,
  imports: [CommonModule, KeySettingsContentComponent],
  templateUrl: './key-settings-page.component.html',
  styleUrl: './key-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeySettingsPageComponent {}
