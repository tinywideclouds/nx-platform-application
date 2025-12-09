import { Component, input, ChangeDetectionStrategy } from '@angular/core';


@Component({
  selector: 'contacts-avatar',
  standalone: true,
  imports: [],
  templateUrl: './contact-avatar.component.html',
  styleUrl: './contact-avatar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactAvatarComponent {
  // Upgrade to Signal Inputs
  profilePictureUrl = input<string | undefined>(undefined);
  initials = input.required<string>();
}