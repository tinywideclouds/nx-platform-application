import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { URN } from '@nx-platform-application/platform-types';
import { LlmMemoryDigest } from '@nx-platform-application/llm-types';
import {
  StandardPrompt,
  ArchitecturalPrompt,
  DebugPrompt,
  MinimalPrompt,
} from '@nx-platform-application/llm-domain-digest';

@Component({
  selector: 'llm-digest-detail-info',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-6">
      <div
        class="bg-indigo-50/50 rounded-xl border border-indigo-100 p-5 shadow-sm"
      >
        <h3
          class="font-bold text-indigo-900 text-sm mb-4 flex items-center gap-2"
        >
          <mat-icon class="text-indigo-500 scale-90">history</mat-icon> Source
          Context
        </h3>
        <p class="text-xs text-indigo-700/80 mb-4 leading-relaxed">
          View the exact timeline of messages and proposals that were compressed
          to create this digest.
        </p>
        <button
          mat-flat-button
          color="primary"
          class="w-full"
          (click)="viewContext.emit()"
        >
          <mat-icon class="scale-75 -ml-1">visibility</mat-icon> View Source
          Messages
        </button>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3
          class="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2"
        >
          <mat-icon class="text-gray-400 scale-90">info</mat-icon> Properties
        </h3>
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <span
              class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
              >Digest Strategy</span
            >
            <div class="flex items-center mt-1">
              <span
                class="text-xs font-bold px-2 py-1 rounded border"
                [ngClass]="getPromptColorClass(digest().typeId)"
              >
                {{ getPromptDisplayName(digest().typeId) }}
              </span>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <span
              class="text-[10px] font-bold text-gray-500 uppercase tracking-wider"
              >Generated On</span
            >
            <span class="text-sm font-medium text-gray-800">{{
              digest().createdAt | date: 'medium'
            }}</span>
          </div>
          <div class="grid grid-cols-2 gap-3 mt-2">
            <div
              class="bg-slate-50 border border-gray-100 rounded-lg p-3 text-center"
            >
              <div class="text-xl font-bold text-indigo-600">
                {{ digest().coveredMessageIds.length }}
              </div>
              <div
                class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1"
              >
                Messages
              </div>
            </div>
            <div
              class="bg-slate-50 border border-gray-100 rounded-lg p-3 text-center"
            >
              <div class="text-xl font-bold text-emerald-600">
                {{ digest().registryEntities.length }}
              </div>
              <div
                class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-1"
              >
                Proposals
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3
          class="font-bold text-gray-800 text-sm mb-4 flex items-center gap-2"
        >
          <mat-icon class="text-gray-400 scale-90">radar</mat-icon> Context
          Scope
        </h3>
        <div class="flex flex-col gap-3">
          @if (digest().registryEntities.length > 0) {
            <div>
              <span
                class="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2"
                >Affected Entities</span
              >
              <div class="flex flex-col gap-1.5">
                @for (
                  entity of digest().registryEntities;
                  track entity.toString()
                ) {
                  <div
                    class="text-[10px] bg-slate-100 text-slate-600 px-2 py-1.5 rounded font-mono truncate border border-slate-200"
                    [title]="entity.toString()"
                  >
                    {{ entity.toString().replace('urn:llm:proposal:', '') }}
                  </div>
                }
              </div>
            </div>
          }
          <div [class.mt-3]="digest().registryEntities.length > 0">
            <span
              class="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2"
              >Message Bounds</span
            >
            <div
              class="text-xs text-gray-600 border-l-2 border-indigo-200 pl-3 py-1 flex flex-col gap-2"
            >
              <div>
                <span class="font-semibold text-gray-800">Start:</span>
                <span
                  class="font-mono text-[10px] text-gray-500 block truncate"
                  [title]="digest().coveredMessageIds[0]?.toString()"
                  >{{ digest().coveredMessageIds[0]?.toString() }}</span
                >
              </div>
              <div>
                <span class="font-semibold text-gray-800">End:</span>
                <span
                  class="font-mono text-[10px] text-gray-500 block truncate"
                  [title]="
                    digest().coveredMessageIds[
                      digest().coveredMessageIds.length - 1
                    ]?.toString()
                  "
                  >{{
                    digest().coveredMessageIds[
                      digest().coveredMessageIds.length - 1
                    ]?.toString()
                  }}</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class LlmDigestDetailInfoComponent {
  digest = input.required<LlmMemoryDigest>();
  viewContext = output<void>();

  getPromptDisplayName(typeId?: URN): string {
    if (!typeId) return 'Standard';
    const idStr = typeId.toString();
    if (idStr === ArchitecturalPrompt.toString()) return 'Architectural';
    if (idStr === DebugPrompt.toString()) return 'Debugging';
    if (idStr === MinimalPrompt.toString()) return 'Minimal';
    return 'Standard';
  }

  getPromptColorClass(typeId?: URN): string {
    if (!typeId) return 'bg-blue-100 text-blue-800 border-blue-200';
    const idStr = typeId.toString();
    if (idStr === ArchitecturalPrompt.toString())
      return 'bg-purple-100 text-purple-800 border-purple-200';
    if (idStr === DebugPrompt.toString())
      return 'bg-orange-100 text-orange-800 border-orange-200';
    if (idStr === MinimalPrompt.toString())
      return 'bg-gray-100 text-gray-800 border-gray-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  }
}
