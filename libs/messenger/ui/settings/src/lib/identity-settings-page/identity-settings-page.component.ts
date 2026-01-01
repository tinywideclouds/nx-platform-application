import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { toSignal } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';
import { startWith } from 'rxjs/operators';

import { IAuthService } from '@nx-platform-application/platform-auth-access';
import { ChatService } from '@nx-platform-application/messenger-state-chat-session';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';

@Component({
  selector: 'lib-identity-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  templateUrl: './identity-settings-page.component.html',
  styleUrl: './identity-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentitySettingsPageComponent {
  private authService = inject(IAuthService);
  private chatService = inject(ChatService);
  private cryptoService = inject(MessengerCryptoService);
  private liveService = inject(ChatLiveDataService);

  // 1. Profile Data
  currentUser = this.authService.currentUser;

  initials = computed(() => {
    const user = this.currentUser();
    if (!user || !user.alias) return '?';
    return user.alias.slice(0, 2).toUpperCase();
  });

  // 2. Connection Status (From Routing Page)
  // Converting Observable to Signal
  connectionStatus = toSignal(this.liveService.status$, {
    initialValue: 'disconnected',
  });

  // Re-implementing the robust loader from KeyPage
  fingerprintState = toSignal(
    from(this.loadFingerprint()).pipe(
      startWith({ value: 'Loading...', isLoading: true }),
    ),
    { initialValue: { value: 'Loading...', isLoading: true } },
  );

  private async loadFingerprint() {
    const urn = this.currentUser()?.id;
    if (!urn) return { value: 'Not Logged In', isLoading: false };

    try {
      const keys = await this.cryptoService.loadMyPublicKeys(urn);
      if (keys?.encKey) {
        const fp = await this.cryptoService.getFingerprint(keys.encKey);
        return { value: fp, isLoading: false };
      }
      return { value: 'No Identity Keys Found', isLoading: false };
    } catch (e) {
      return { value: 'Error loading fingerprint', isLoading: false };
    }
  }
}
