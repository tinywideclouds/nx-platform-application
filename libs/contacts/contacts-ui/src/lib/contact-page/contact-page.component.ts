// libs/contacts/contacts-ui/src/lib/components/contact-page/contact-page.component.ts

import { Component, inject } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { URN } from '@nx-platform-application/platform-types';
import { ContactDetailComponent } from '../contact-detail/contact-detail.component';
// Import Toolbar & UI Modules
import { ContactsPageToolbarComponent } from '../contacts-page-toolbar/contacts-page-toolbar.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'contacts-page',
  standalone: true,
  imports: [
    ContactDetailComponent,
    ContactsPageToolbarComponent,
    MatButtonModule,
    MatIconModule
],
  templateUrl: './contact-page.component.html',
  styleUrl: './contact-page.component.scss',
})
export class ContactPageComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private idParam$ = this.route.paramMap.pipe(map((p) => p.get('id')));

  contactId = toSignal(
    this.idParam$.pipe(
      map((id) => {
        if (id) {
          try {
            return { urn: URN.parse(id), isNew: false };
          } catch {
            return null;
          }
        }
        return {
          urn: URN.create('user', crypto.randomUUID(), 'contacts'),
          isNew: true,
        };
      })
    ),
    { initialValue: null }
  );

  onSaved(): void {
    this.router.navigate(['/contacts'], { queryParams: { tab: 'contacts' } });
  }

  onClose(): void {
    this.router.navigate(['/contacts'], { queryParams: { tab: 'contacts' } });
  }
}
