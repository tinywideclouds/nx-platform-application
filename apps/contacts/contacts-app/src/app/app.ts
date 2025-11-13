// apps/contacts-app/src/app/app.component.ts

import { Component } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';

@Component({
  selector: 'app-root', // Use 'app-root' as defined in eslint.config.mjs
  standalone: true,
  // Import the router directives
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html'
})
export class AppComponent {}