// libs/contacts/contacts-ui/src/lib/components/contact-group-list-item/contact-group-list-item.component.ts

import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';

import { ContactGroup } from '@nx-platform-application/contacts-types';

@Component({
  selector: 'contacts-group-list-item',
  standalone: true,
  imports: [],
  templateUrl: './contact-group-list-item.component.html',
  styleUrl: './contact-group-list-item.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // v20: Bind click directly on the host
  host: {
    '(click)': 'onHostClick()',
    class: 'block', // You can even move the :host { display: block } here via Tailwind
  },
})
export class ContactGroupListItemComponent {
  // v20: Signal Input
  group = input.required<ContactGroup>();

  // v20: Output Function
  select = output<ContactGroup>();

  // v20: Computed Signal (Memoized)
  // Replaces the 'get memberCount()' which runs on every CD cycle
  memberCount = computed(() => this.group().members.length);

  onHostClick(): void {
    this.select.emit(this.group());
  }
}
