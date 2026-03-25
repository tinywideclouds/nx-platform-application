import { Component, inject, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DataSourcesService } from '@nx-platform-application/data-sources-features-state';
import { DataSourcesRegistryService } from '@nx-platform-application/data-sources-domain-registry';
import { DataSource } from '@nx-platform-application/data-sources-types';
import { IngestionSidebarComponent } from '../ingestion-sidebar/ingestion-sidebar.component';

export type SidebarPillar = 'sources' | 'ingestion';
export type SourcesTab = 'streams' | 'groups';

@Component({
  selector: 'data-sources-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    IngestionSidebarComponent,
  ],
  templateUrl: './data-sources-sidebar.component.html',
})
export class DataSourcesSidebarComponent {
  state = inject(DataSourcesService);
  registry = inject(DataSourcesRegistryService);
  private router = inject(Router);

  showIngestion = input<boolean>(true);

  private activeRouteData = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.parseRoute(this.router.url)),
      startWith(this.parseRoute(this.router.url)),
    ),
    {
      initialValue: {
        pillar: 'sources' as SidebarPillar,
        tab: 'streams' as SourcesTab,
      },
    },
  );

  activePillar = computed<SidebarPillar>(() => {
    if (!this.showIngestion()) return 'sources';
    return this.activeRouteData().pillar;
  });

  activeSourcesTab = computed<SourcesTab>(() => {
    return this.activeRouteData().tab;
  });

  hasTargets = computed(() => {
    return this.state.githubTargets().length > 0;
  });

  groupedSources = computed(() => {
    const sources = this.registry.dataSources();
    const targetMap = this.state.targetsById();

    const groups: Record<
      string,
      { repo: string; targetId: string; sources: DataSource[] }
    > = {};

    for (const source of sources) {
      const targetIdStr = source.targetId.toString();
      if (!groups[targetIdStr]) {
        const target = targetMap.get(targetIdStr);
        groups[targetIdStr] = {
          repo: target ? target.repo : 'Unknown Repository',
          targetId: targetIdStr,
          sources: [],
        };
      }
      groups[targetIdStr].sources.push(source);
    }
    return Object.values(groups);
  });

  constructor() {
    this.state.loadAllTargets();
    this.state.loadAllDataGroups();
  }

  private parseRoute(url: string): { pillar: SidebarPillar; tab: SourcesTab } {
    if (url.includes('/repos')) return { pillar: 'ingestion', tab: 'streams' };
    if (url.includes('/groups')) return { pillar: 'sources', tab: 'groups' };
    return { pillar: 'sources', tab: 'streams' };
  }

  switchPillar(pillar: SidebarPillar) {
    if (pillar === 'ingestion') {
      this.router.navigate(['/data-sources/repos']);
    } else {
      this.router.navigate([`/data-sources/${this.activeSourcesTab()}`]);
    }
  }

  switchSourcesTab(tab: SourcesTab) {
    this.router.navigate([`/data-sources/${tab}`]);
  }

  isActiveSource(sourceId: string): boolean {
    return this.router.url.includes(`/sources/${sourceId}`);
  }
}
