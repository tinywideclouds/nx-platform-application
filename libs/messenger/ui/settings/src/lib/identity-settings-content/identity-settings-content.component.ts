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

// ✅ NEW: Correct State Layers
import { ChatDataService } from '@nx-platform-application/messenger-state-chat-data';
import { ChatIdentityFacade } from '@nx-platform-application/messenger-state-identity';

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
  isWizard = input(false);

  private authService = inject(IAuthService);
  private appState = inject(AppState);

  // ✅ Architecture Fixed
  private identity = inject(ChatIdentityFacade);
  private chatData = inject(ChatDataService);

  // --- WIZARD TOGGLE ---
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

  // ✅ CORRECT SOURCE: ChatDataService owns the connection
  connectionStatus = toSignal(this.chatData.liveConnection, {
    initialValue: 'disconnected',
  });

  // Load fingerprint via Facade
  fingerprintState = toSignal(from(this.loadFingerprint()), {
    initialValue: {
      value: 'Loading...',
      isLoading: true,
      success: false,
    } as FingerprintState,
  });

  private async loadFingerprint(): Promise<FingerprintState> {
    try {
      const fp = await this.identity.loadMyFingerprint();
      return { value: fp, isLoading: false, success: true };
    } catch (e) {
      return {
        value: 'Error loading fingerprint',
        isLoading: false,
        success: false,
      };
    }
  }
}
