import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'messenger-chat-group-intro',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './chat-group-intro.component.html',
  styleUrl: './chat-group-intro.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatGroupIntroComponent {
  groupName = input.required<string>();
  memberCount = input.required<number>();

  startBroadcast = output<void>();
  createGroupChat = output<void>();
}
