import {
  Component,
  output,
  signal,
  ChangeDetectionStrategy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatStepperModule } from '@angular/material/stepper';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';

import { URN } from '@nx-platform-application/platform-types';
import {
  SessionAttachment,
  ContextInjectionTarget,
} from '@nx-platform-application/llm-types';
import { LlmDataSourcesStateService } from '@nx-platform-application/llm-features-data-sources';

@Component({
  selector: 'llm-data-source-stepper',
  standalone: true,
  imports: [
    CommonModule,
    MatStepperModule,
    MatSelectModule,
    MatRadioModule,
    MatButtonModule,
    MatFormFieldModule,
  ],
  templateUrl: './data-source-stepper.component.html',
  styleUrl: './data-source-stepper.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LlmDataSourceStepperComponent {
  dataSourcesState = inject(LlmDataSourcesStateService);

  // --- OUTPUTS ---
  cancel = output<void>();
  addSource = output<SessionAttachment>();

  // --- STEPPER STATE ---
  // FIX: Strictly type as URNs
  selectedCacheId = signal<URN | null>(null);
  selectedProfileId = signal<URN | undefined>(undefined);
  selectedTarget = signal<ContextInjectionTarget>('inline-context');

  // --- HELPERS ---
  compareUrns(a: URN | null | undefined, b: URN | null | undefined): boolean {
    if (!a || !b) return a === b;
    return a.equals(b);
  }

  // --- ACTIONS ---

  // FIX: Accept URN from select menu
  async onCacheSelected(cacheId: URN): Promise<void> {
    this.selectedCacheId.set(cacheId);
    this.selectedProfileId.set(undefined);
    await this.dataSourcesState.selectCache(cacheId);
  }

  confirmAddSource(): void {
    const cId = this.selectedCacheId();
    if (!cId) return;

    const newAtt: SessionAttachment = {
      id: URN.parse('urn:llm:attachment:' + crypto.randomUUID()),
      cacheId: cId, // Already a URN
      profileId: this.selectedProfileId(), // Already a URN
      target: this.selectedTarget(),
    };

    this.addSource.emit(newAtt);
  }
}
