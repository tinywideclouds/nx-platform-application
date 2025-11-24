// libs/messenger/settings-ui/src/lib/settings-shell/settings-shell.component.ts

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';

// Reusing your Toolkit Layout
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-toolkit';
import { SettingsSidebarComponent } from '../settings-sidebar/settings-sidebar.component';

@Component({
  selector: 'lib-settings-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MasterDetailLayoutComponent,
    SettingsSidebarComponent
  ],
  templateUrl: './settings-shell.component.html',
  styleUrl: './settings-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsShellComponent {
  private router = inject(Router);

  // We are technically always in "Detail Mode" in settings because 
  // the sidebar is navigation and the main view is the content.
  // On mobile, the MasterDetailLayout might need logic to toggle this,
  // but for now we default to showing both or letting the CSS handle it.
  showDetail = true; 

  onClose() {
    // Navigate back to the messenger root
    this.router.navigate(['/messenger']);
  }
}