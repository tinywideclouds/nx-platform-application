import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LlmModelProfile } from '@nx-platform-application/llm-types';
import { Logger } from '@nx-platform-application/platform-tools-console-logger';

@Injectable({ providedIn: 'root' })
export class LlmModelRegistryService {
  private http = inject(HttpClient);
  private logger = inject(Logger);

  // Private mutable state
  private _profiles = signal<LlmModelProfile[]>([]);

  // Public immutable state
  readonly profiles = this._profiles.asReadonly();

  // Helper to quickly grab a specific profile
  readonly profileMap = computed(() => {
    const map = new Map<string, LlmModelProfile>();
    for (const p of this._profiles()) {
      map.set(p.id, p);
    }
    return map;
  });

  async loadProfiles(): Promise<void> {
    try {
      // Fetch the JSON from the assets folder
      const data = await firstValueFrom(
        this.http.get<LlmModelProfile[]>('/assets/models/gemini-profiles.json'),
      );
      this._profiles.set(data);
      this.logger.debug(
        `[Model Registry] Loaded ${data.length} model profiles.`,
      );
    } catch (error) {
      this.logger.error(
        '[Model Registry] Failed to load model profiles.',
        error,
      );
      // Fallback state so the app doesn't crash completely
      this._profiles.set([this.getEmergencyFallback()]);
    }
  }

  getProfile(modelId: string): LlmModelProfile | undefined {
    return this.profileMap().get(modelId);
  }

  getEmergencyFallback(): LlmModelProfile {
    return {
      id: 'gemini-3-flash-preview',
      displayName: 'Gemini 3 Flash (Fallback)',
      version: {
        major: 3,
        minor: 0,
        provider: 'gemini',
        tier: 'flash',
        apiName: 'gemini-3-flash-preview',
      },
      maxInputTokens: 1000000,
      maxOutputTokens: 8192,
      features: {
        supportsSystemInstructions: true,
        supportsTools: false,
        supportsThinking: false,
        supportsSystemContext: false,
      },
    };
  }
}
