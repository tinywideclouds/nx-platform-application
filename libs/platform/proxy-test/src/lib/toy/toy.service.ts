import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ToyService {
  getData(): Promise<string> {
    // Introduce a 500ms delay to simulate network latency.
    // This is what fakeAsync and tick are designed to control.
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve('Success');
      }, 500);
    });
  }
}

