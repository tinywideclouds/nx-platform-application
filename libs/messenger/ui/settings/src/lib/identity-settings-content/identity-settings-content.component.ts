import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { toSignal } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';

import { IAuthService } from '@nx-platform-application/platform-infrastructure-auth-access';
import { AppState } from '@nx-platform-application/messenger-state-app';
import { MessengerCryptoService } from '@nx-platform-application/messenger-infrastructure-crypto-bridge';
import { ChatLiveDataService } from '@nx-platform-application/messenger-infrastructure-live-data';

export interface FingerprintState {
  value: string;
  isLoading: boolean;
  success: boolean;
}

@Component({
  selector: 'lib-identity-settings-content',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatSlideToggleModule,
  ],
  templateUrl: './identity-settings-content.component.html',
  styleUrl: './identity-settings-content.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentitySettingsContentComponent {
  // Controlled by Parent (Page vs Sticky Wizard)
  isWizard = input(false);

  private authService = inject(IAuthService);
  private appState = inject(AppState);
  private cryptoService = inject(MessengerCryptoService);
  private liveService = inject(ChatLiveDataService);

  // --- WIZARD TOGGLE ---
  // Connects directly to ChatService state
  wizardActive = this.appState.showWizard;

  onToggleWizard(active: boolean): void {
    this.appState.setWizardActive(active);
  }

  // --- IDENTITY STATE ---
  currentUser = this.authService.currentUser;

  initials = computed(() => {
    const user = this.currentUser();
    if (!user || !user.alias) return '?';
    return user.alias.slice(0, 2).toUpperCase();
  });

  connectionStatus = toSignal(this.liveService.status$, {
    initialValue: 'disconnected',
  });

  // Load fingerprint on init
  fingerprintState = toSignal(from(this.loadFingerprint()), {
    initialValue: {
      value: 'Loading...',
      isLoading: true,
      success: false,
    } as FingerprintState,
  });

  private async loadFingerprint(): Promise<FingerprintState> {
    const urn = this.currentUser()?.id;
    if (!urn)
      return { value: 'Not Logged In', isLoading: false, success: false };

    try {
      const keys = await this.cryptoService.loadMyPublicKeys(urn);
      if (keys?.encKey) {
        const fp = await this.cryptoService.getFingerprint(keys.encKey);
        return { value: fp, isLoading: false, success: true };
      }
      return {
        value: 'No Identity Keys Found',
        isLoading: false,
        success: false,
      };
    } catch (e) {
      return {
        value: 'Error loading fingerprint',
        isLoading: false,
        success: false,
      };
    }
  }
}
