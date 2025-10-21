// src/lib/toy/toy.ts
import { Component, inject, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ToyService } from './toy.service';

@Component({
  standalone: true,
  selector: 'lib-toy',
  // FIX: The signal must be called as a function: status()
  template: `<p>{{ status() }}</p>`,
})
export class ToyComponent {
  private toyService = inject(ToyService);
  public status = toSignal(this.toyService.getData(), { initialValue: 'Loading...' });
}
