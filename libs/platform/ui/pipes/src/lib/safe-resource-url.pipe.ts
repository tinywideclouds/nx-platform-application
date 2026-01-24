import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Pipe({
  name: 'safeResourceUrl',
  standalone: true,
})
export class SafeResourceUrlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(url: string | null | undefined): SafeResourceUrl {
    if (!url) return '';
    // TRUSTED: Explicitly bypass security for this URL
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
}
