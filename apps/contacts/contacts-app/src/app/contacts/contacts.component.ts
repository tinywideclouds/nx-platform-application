// apps/contacts-app/src/app/all-contacts-placeholder.component.ts

import { Component } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-all-contacts-placeholder',
  template: `
    <div class="p-4">
      <h2 class="text-xl font-semibold">All Contacts</h2>
      <p class="text-gray-600">This view will show all contacts from all services.</p>
    </div>
  `,
})
export class AllContactsPlaceholderComponent {}