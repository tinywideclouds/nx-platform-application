import { Pipe, PipeTransform, inject } from '@angular/core';
import { URN } from '@nx-platform-application/platform-types';
import { ContactsStateService } from '@nx-platform-application/contacts-state';

@Pipe({
  name: 'contactName',
  standalone: true,
  pure: false, // ✅ Required to react to Signal updates
})
export class ContactNamePipe implements PipeTransform {
  private state = inject(ContactsStateService);

  transform(value: URN | string | null | undefined): string {
    // 1. Get the reactive signal for this URN
    const nameSignal = this.state.resolveContactName(value);

    // 2. Read the value immediately.
    // Since this is a Signal, and the pipe is pure: false,
    // this effectively keeps the view in sync with the state.
    return nameSignal();
  }
}
