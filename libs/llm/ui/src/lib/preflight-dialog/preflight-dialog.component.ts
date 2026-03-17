import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogRef,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { ContextAssembly } from '@nx-platform-application/llm-domain-context';
import { LlmSession } from '@nx-platform-application/llm-types';

export interface PreflightDialogData {
  assembly: ContextAssembly;
  session: LlmSession;
}

export interface PreflightDialogResult {
  send: boolean;
  disableFuture: boolean;
}

@Component({
  selector: 'llm-preflight-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
  ],
  template: `
    <div class="flex flex-col h-full bg-slate-50">
      <div
        class="p-4 border-b border-gray-200 bg-white flex items-center justify-between shrink-0"
      >
        <h2 class="text-lg font-bold text-gray-800 m-0 flex items-center gap-2">
          <mat-icon class="text-indigo-500">flight_takeoff</mat-icon>
          Pre-Flight Context Preview
        </h2>
        <div
          class="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200"
        >
          Model:
          <span class="text-indigo-700">{{ data.assembly.request.model }}</span>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-4">
        <div
          class="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex gap-6 text-sm"
        >
          <div class="flex flex-col">
            <span
              class="text-xs font-bold text-indigo-400 uppercase tracking-wider"
              >Active Window</span
            >
            <span class="text-indigo-900 font-medium"
              >{{ data.assembly.memoryMetrics.activeWindowCount }} msgs</span
            >
          </div>
          <div class="flex flex-col">
            <span
              class="text-xs font-bold text-indigo-400 uppercase tracking-wider"
              >Digests Used</span
            >
            <span class="text-indigo-900 font-medium"
              >{{ data.assembly.memoryMetrics.digestsUsed }} blocks</span
            >
          </div>
          <div class="flex flex-col">
            <span
              class="text-xs font-bold text-indigo-400 uppercase tracking-wider"
              >Archivable</span
            >
            <span class="text-indigo-900 font-medium"
              >{{ data.assembly.memoryMetrics.archivableCount }} msgs</span
            >
          </div>
        </div>

        <div class="space-y-4">
          <h3
            class="text-sm font-bold text-slate-700 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4"
          >
            Final Network Payload
          </h3>

          @for (msg of data.assembly.request.history; track msg.id) {
            <div
              class="bg-white border border-slate-200 rounded-lg p-4 shadow-sm"
            >
              <span
                class="text-[10px] font-bold uppercase tracking-widest block mb-2"
                [ngClass]="
                  msg.role === 'user' ? 'text-blue-600' : 'text-purple-600'
                "
              >
                {{ msg.role }}
              </span>
              <pre
                class="text-xs font-mono text-slate-700 whitespace-pre-wrap m-0 bg-slate-50 p-3 rounded border border-slate-100"
                >{{ msg.content }}</pre
              >
            </div>
          }
        </div>
      </div>

      <div
        class="p-4 border-t border-gray-200 bg-white flex items-center justify-between shrink-0"
      >
        <mat-checkbox [(ngModel)]="disableFuture" color="primary">
          <span class="text-sm font-medium text-slate-600"
            >Don't show this again</span
          >
        </mat-checkbox>

        <div class="flex gap-2">
          <button mat-button (click)="onCancel()">Cancel Send</button>
          <button mat-flat-button color="primary" (click)="onSend()">
            <mat-icon>send</mat-icon> Send to LLM
          </button>
        </div>
      </div>
    </div>
  `,
})
export class LlmPreflightDialogComponent {
  data = inject<PreflightDialogData>(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<LlmPreflightDialogComponent>);

  disableFuture = false;

  onCancel() {
    this.dialogRef.close({ send: false, disableFuture: false });
  }

  onSend() {
    this.dialogRef.close({ send: true, disableFuture: this.disableFuture });
  }
}
