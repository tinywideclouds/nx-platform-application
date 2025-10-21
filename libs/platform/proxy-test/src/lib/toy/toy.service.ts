// src/lib/toy/toy.service.ts
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ToyService {
  getData(): Observable<string> {
    // Introduce a 500ms delay to simulate network latency.
    return of('Success').pipe(delay(500));
  }
}
