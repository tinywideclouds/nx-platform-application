// libs/messenger/settings-ui/src/lib/settings-sidebar/settings-sidebar.component.ts

import { Component, ChangeDetectionStrategy, output } from '@angular/core';

import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'lib-settings-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    MatIconModule,
    MatListModule,
    MatButtonModule,
  ],
  templateUrl: './settings-sidebar.component.html',
  styleUrl: './settings-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSidebarComponent {
  // Navigation Actions
  closeSettings = output<void>();
  messengerVersion = 'v1.0.0';
}
