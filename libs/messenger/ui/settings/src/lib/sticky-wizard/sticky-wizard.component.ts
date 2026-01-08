import {
  Component,
  ChangeDetectionStrategy,
  output,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { IdentitySettingsContentComponent } from '../identity-settings-content/identity-settings-content.component';
import { KeySettingsContentComponent } from '../key-settings-content/key-settings-content.component';
import { DataSettingsContentComponent } from '../data-settings-content/data-settings-content.component';

@Component({
  selector: 'lib-sticky-wizard',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    IdentitySettingsContentComponent,
    KeySettingsContentComponent,
    DataSettingsContentComponent,
  ],
  templateUrl: './sticky-wizard.component.html',
  styleUrl: './sticky-wizard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StickyWizardComponent {
  /**
   * 'overlay': Fixed bottom-right (Global Toast style)
   * 'inline': Fills container (Panel Content style)
   */
  displayMode = input<'overlay' | 'inline'>('overlay');
  // Pure UI Event: Parent (App Layout) listens to this to hide the wizard
  close = output<void>();
}
