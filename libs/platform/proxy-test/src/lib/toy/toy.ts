import { Component, OnInit, inject } from '@angular/core';
import { ToyService } from './toy.service';

@Component({
  standalone: true,
  selector: 'lib-toy',
  template: `<p>{{ status }}</p>`,
})
export class ToyComponent implements OnInit {
  private toyService = inject(ToyService);
  public status = 'Loading...';

  /**
   * On init, call the async service and update the status.
   */
  ngOnInit(): void {
    this.toyService
      .getData()
      .then((result) => {
        this.status = result;
      })
      .catch(() => {
        this.status = 'Error';
      });
  }
}
