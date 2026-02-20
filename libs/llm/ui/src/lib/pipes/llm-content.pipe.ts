import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'llmContent',
  standalone: true,
  pure: true,
})
export class LlmContentPipe implements PipeTransform {
  private decoder = new TextDecoder();

  transform(value: any): string {
    // robust check for the domain object shape
    if (!value || !value.payloadBytes) return '';

    // Decode Uint8Array -> String
    return this.decoder.decode(value.payloadBytes);
  }
}
