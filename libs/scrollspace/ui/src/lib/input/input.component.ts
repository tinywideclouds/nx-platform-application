import {
  Component,
  ChangeDetectionStrategy,
  signal,
  input,
  output,
  viewChild,
  ElementRef,
  inject,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ScrollspaceInputConfig,
  ScrollspaceInputDraft,
} from '@nx-platform-application/scrollspace-types';

interface LocalAttachment {
  id: string;
  file: File;
  previewUrl: string;
}

@Component({
  selector: 'scrollspace-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './input.component.html',
  styleUrl: './input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollspaceInputComponent {
  // --- Inputs ---
  disabled = input(false);
  config = input<ScrollspaceInputConfig>({});

  // --- Outputs ---
  send = output<ScrollspaceInputDraft>();
  typing = output<void>();

  // --- Internals ---
  text = signal('');
  attachments = signal<LocalAttachment[]>([]);

  fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');
  messageBox =
    viewChild.required<ElementRef<HTMLTextAreaElement>>('messageBox');

  // ✅ Modern Cleanup Injection
  private destroyRef = inject(DestroyRef);

  constructor() {
    // Revoke object URLs when component is destroyed to prevent memory leaks
    this.destroyRef.onDestroy(() => {
      this.attachments().forEach((a) => URL.revokeObjectURL(a.previewUrl));
    });
  }

  // --- Logic ---

  onInput(event: Event): void {
    const target = event.target as HTMLTextAreaElement;
    this.text.set(target.value);
    this.adjustHeight(target);
    this.typing.emit();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.triggerSend();
    } else {
      this.typing.emit();
    }
  }

  onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;

    let handled = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          this.addFile(blob);
          handled = true;
        }
      }
    }
    if (handled) event.preventDefault();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      Array.from(input.files).forEach((file) => this.addFile(file));
      input.value = '';
    }
  }

  removeAttachment(id: string): void {
    this.attachments.update((current) => {
      const target = current.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((a) => a.id !== id);
    });
  }

  triggerSend(): void {
    if (!this.canSend()) return;

    const payload: ScrollspaceInputDraft = {
      text: this.text().trim(),
      files: this.attachments().map((a) => a.file),
    };

    this.send.emit(payload);
    this.reset();
  }

  canSend(): boolean {
    return (
      (this.text().trim().length > 0 || this.attachments().length > 0) &&
      !this.disabled()
    );
  }

  private addFile(file: File): void {
    const url = URL.createObjectURL(file);
    const newItem: LocalAttachment = {
      id: crypto.randomUUID(),
      file,
      previewUrl: url,
    };
    this.attachments.update((curr) => [...curr, newItem]);
  }

  private reset(): void {
    this.text.set('');
    // Cleanup internal previews immediately on send
    this.attachments().forEach((a) => URL.revokeObjectURL(a.previewUrl));
    this.attachments.set([]);

    const el = this.messageBox().nativeElement;
    el.style.height = 'auto';
  }

  private adjustHeight(el: HTMLElement): void {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }
}
