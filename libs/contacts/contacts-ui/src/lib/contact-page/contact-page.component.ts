import { Component, inject, output } from '@angular/core';
import { ActivatedRoute } from '@angular/router'; // ActivatedRoute is safe (Read-Only)
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { URN } from '@nx-platform-application/platform-types';
import { ContactDetailComponent } from '../contact-detail/contact-detail.component';
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
    MatIconModule,
  ],
  templateUrl: './contact-page.component.html',
  styleUrl: './contact-page.component.scss',
})
export class ContactPageComponent {
  private route = inject(ActivatedRoute);

  // ✅ 1. Define Outputs (No Router!)
  saved = output<void>();
  cancelled = output<void>();

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
      }),
    ),
    { initialValue: null },
  );

  onSaved(): void {
    // ✅ 2. Emit Event instead of Navigating
    this.saved.emit();
  }

  onClose(): void {
    // ✅ 2. Emit Event instead of Navigating
    this.cancelled.emit();
  }
}
