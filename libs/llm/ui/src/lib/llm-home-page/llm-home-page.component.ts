import {
  Component,
  inject,
  ChangeDetectionStrategy,
  afterNextRender,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import { LegacyMigrationService } from '@nx-platform-application/llm-tools-migration'; // Your new lib
import { LlmMigrationDialogComponent } from '../migration/tools/migration-dialog.component';

// UI
import {
  LlmToolbarComponent,
  LlmAppView,
} from '../llm-toolbar/llm-toolbar.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'llm-home-page',
  standalone: true,
  imports: [CommonModule, RouterOutlet, LlmToolbarComponent],
  templateUrl: './llm-home-page.component.html',
  styleUrl: './llm-home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmHomePageComponent {
  private router = inject(Router);
  private dialog = inject(MatDialog);

  migrationService = inject(LegacyMigrationService);

  readonly migrationCount = this.migrationService.pendingLegacyCount;

  activeView = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.getViewFromUrl(this.router.url)),
      startWith(this.getViewFromUrl(this.router.url)),
    ),
    { initialValue: 'chat' as LlmAppView },
  );

  constructor() {
    // Replaces ngOnInit entirely.
    // This runs once immediately after the browser paints the initial UI.
    afterNextRender(async () => {
      const count = await this.migrationService.scanForLegacyProposals();
      if (count > 0) {
        this.promptMigration();
      }
    });
  }

  async promptMigration() {
    const dialogRef = this.dialog.open(LlmMigrationDialogComponent, {
      width: '450px',
      disableClose: true,
    });

    const wantsToMigrate = await dialogRef.afterClosed().toPromise();

    if (wantsToMigrate) {
      await this.migrationService.executeMigration();
    }
  }

  private getViewFromUrl(url: string): LlmAppView {
    if (url.includes('/data-sources')) return 'data-sources';
    if (url.includes('/settings')) return 'settings';
    return 'chat';
  }

  // --- ACTIONS ---
  onViewChat() {
    this.router.navigate(['/']);
  }

  onViewDataSources() {
    this.router.navigate(['/data-sources']);
  }

  onViewSettings() {
    this.router.navigate(['/settings']);
  }
}
