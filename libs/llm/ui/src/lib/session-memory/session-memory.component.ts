import {
  Component,
  ChangeDetectionStrategy,
  output,
  signal,
  inject,
  computed,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { MasterDetailLayoutComponent } from '@nx-platform-application/platform-ui-layouts';
import { LlmMemorySidebarComponent } from '../memory-sidebar/memory-sidebar.component';
import { LlmManualDigestBuilderComponent } from '../manual-digest-builder/manual-digest-builder.component';
import { LlmDigestDetailComponent } from '../digest-detail/digest-detail.component';
import { URN } from '@nx-platform-application/platform-types';

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

  // Derived from URL: ?view=memory&digest=urn:llm:digest:xxx
  readonly activeDigestId = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => {
        const id = params.get('digest');
        return id ? URN.parse(id) : null;
      }),
    ),
    { initialValue: null }, // This forces the type to URN | null
  );

  // Derives view based on URL state
  readonly activeView = computed(() => {
    const params = this.route.snapshot.queryParamMap;
    if (params.get('builder') === 'true') return 'builder'; // Optional: if builder is also URL-driven
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
