import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
// No longer imports Contact

@Component({
  selector: 'lib-contact-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './contact-avatar.component.html',
  styleUrl: './contact-avatar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactAvatarComponent {
  // New simplified API
  @Input() profilePictureUrl?: string;
  @Input({ required: true }) initials!: string;
}