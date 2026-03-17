import {
  Component,
  ChangeDetectionStrategy,
  output,
  inject,
  computed,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { URN } from '@nx-platform-application/platform-types';

import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-layouts';
import { LlmMemorySidebarComponent } from '../memory-sidebar/memory-sidebar.component';
import { LlmManualDigestBuilderComponent } from '../manual-digest-builder/manual-digest-builder.component';
import { LlmDigestDetailComponent } from '../digest-detail/digest-detail.component';

@Component({
  selector: 'llm-session-memory',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MasterDetailLayoutComponent,
    LlmMemorySidebarComponent,
    LlmManualDigestBuilderComponent,
    LlmDigestDetailComponent,
  ],
  templateUrl: './session-memory.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmSessionMemoryComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  closed = output<void>();

  // 1. ONE Reactive source of truth for the URL
  private queryParams = toSignal(this.route.queryParamMap);

  // 2. Derive the Digest ID reactively
  readonly activeDigestId = computed(() => {
    const params = this.queryParams();
    const id = params?.get('digest');
    return id ? URN.parse(id) : null;
  });

  // 3. Derive the View reactively (no more snapshots!)
  readonly activeView = computed(() => {
    const params = this.queryParams();
    if (params?.get('builder') === 'true') return 'builder';
    return this.activeDigestId() ? 'digest' : 'empty';
  });

  onSelectDigest(id: URN | null) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { digest: id?.toString() || null, builder: null },
      queryParamsHandling: 'merge',
    });
  }

  onOpenBuilder() {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { builder: 'true', digest: null },
      queryParamsHandling: 'merge',
    });
  }

  onDigestCreated(newDigestId: URN) {
    this.onSelectDigest(newDigestId);
  }
}
