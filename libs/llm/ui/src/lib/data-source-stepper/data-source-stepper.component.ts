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
  selectedCacheId = signal<string | null>(null);
  selectedProfileId = signal<string | undefined>(undefined);
  selectedTarget = signal<ContextInjectionTarget>('inline-context');

  // --- ACTIONS ---

  async onCacheSelected(cacheId: string): Promise<void> {
    this.selectedCacheId.set(cacheId);
    this.selectedProfileId.set(undefined);
    // Triggers the state service to load profiles for Step 2
    await this.dataSourcesState.selectCache(cacheId);
  }

  confirmAddSource(): void {
    const cId = this.selectedCacheId();
    if (!cId) return;

    const newAtt: SessionAttachment = {
      id: crypto.randomUUID(),
      cacheId: URN.parse(cId),
      profileId: this.selectedProfileId()
        ? URN.parse(this.selectedProfileId()!)
        : undefined,
      target: this.selectedTarget(),
    };

    this.addSource.emit(newAtt);
  }
}
