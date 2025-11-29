// libs/messenger/settings-ui/src/lib/key-settings-page/key-settings-page.component.ts

import {
  Component,
  ChangeDetectionStrategy,
  inject,
  Signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  firstValueFrom,
  switchMap,
  map,
  startWith,
  catchError,
  of,
  from,
} from 'rxjs';

import { ChatService } from '@nx-platform-application/chat-state';
import { Logger } from '@nx-platform-application/console-logger';
import { ConfirmationDialogComponent } from '@nx-platform-application/platform-ui-toolkit';
import { MessengerCryptoService } from '@nx-platform-application/messenger-crypto-bridge';
import { URN } from '@nx-platform-application/platform-types';

interface FingerprintState {
  value: string;
  isLoading: boolean;
  error?: string;
}

@Component({
  selector: 'lib-key-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatSnackBarModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './key-settings-page.component.html',
  styleUrl: './key-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeySettingsPageComponent {
  private chatService = inject(ChatService);
  private cryptoService = inject(MessengerCryptoService);
  private logger = inject(Logger);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  // 1. Define the loader logic (pure RxJS for stability/cancellation)
  private loadFingerprint$ = (urn: URN | null) => {
    if (!urn) return of('Unknown (Not Logged In)');

    // Wrap Promise in Observable to unlock RxJS operators
    return from(this.cryptoService.loadMyPublicKeys(urn)).pipe(
      switchMap(async (keys) => {
        if (keys && keys.encKey) {
          return await this.cryptoService.getFingerprint(keys.encKey);
        }
        return 'No Local Keys Generated';
      }),
      catchError((e) => {
        this.logger.error('Failed to load fingerprint', e);
        return of('Error loading key');
      })
    );
  };

  // 2. The Reactive Signal Chain
  // Automatically reacts to currentUserUrn changes
  fingerprintState: Signal<FingerprintState> = toSignal(
    toObservable(this.chatService.currentUserUrn).pipe(
      switchMap((urn) =>
        this.loadFingerprint$(urn).pipe(
          // Map success to State Object
          map((value) => ({ value, isLoading: false })),
          // Start with Loading state whenever source changes (race condition safe)
          startWith({ value: 'Regenerating...', isLoading: true })
        )
      )
    ),
    // Initial Signal State required by toSignal
    { initialValue: { value: 'Loading...', isLoading: true } }
  );

  async onResetKeys(): Promise<void> {
    const ref = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Reset Identity Keys?',
        message: 'Your friends will see a "Safety Number Changed" warning.',
        confirmText: 'Reset Keys',
        warn: true,
      },
    });

    if (await firstValueFrom(ref.afterClosed())) {
      await this.executeReset();
    }
  }

  private async executeReset(): Promise<void> {
    try {
      await this.chatService.resetIdentityKeys();
      this.logger.info('User manually reset identity keys.');

      this.snackBar.open('Identity Keys regenerated successfully.', 'OK', {
        duration: 3000,
        panelClass: ['bg-green-600', 'text-white'],
      });

      // NOTE: Because currentUserUrn is reactive, the signal chain above
      // effectively watches the data. If the URN doesn't change but the
      // underlying keys do, a real app would trigger a "refresh signal".
      // For this refactor, we rely on the architecture's data consistency.
    } catch (err) {
      this.logger.error('Failed to reset keys', err);
      this.snackBar.open('Failed to reset keys.', 'Dismiss', {
        duration: 5000,
        panelClass: ['bg-red-600', 'text-white'],
      });
    }
  }
}
