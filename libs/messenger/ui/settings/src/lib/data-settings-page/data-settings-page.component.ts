import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataSettingsContentComponent } from '../data-settings-content/data-settings-content.component';

@Component({
  selector: 'lib-data-settings-page',
  standalone: true,
  imports: [CommonModule, DataSettingsContentComponent],
  templateUrl: './data-settings-page.component.html',
  styleUrl: './data-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataSettingsPageComponent {}
