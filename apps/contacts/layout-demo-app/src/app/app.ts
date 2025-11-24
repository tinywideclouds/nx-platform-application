import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DemoShellComponent } from '@nx-platform-application/platform-ui-toolkit';

@Component({
  standalone: true,
  imports: [RouterModule, DemoShellComponent],
  selector: 'app-root',
  template: `<lib-demo-shell />`,
})
export class App {}