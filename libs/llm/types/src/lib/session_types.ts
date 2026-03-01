import {
  ISODateTimeString,
  URN,
} from '@nx-platform-application/platform-types';

// Define the specific strategies we can use to pass context to the LLM
export type ContextInjectionTarget =
  | 'gemini-cache'
  | 'system-instruction'
  | 'inline-context';

export interface SessionAttachment {
  id: string; // A unique ID for the UI to track this specific attachment (e.g., UUID)
  cacheId: URN; // The URN of the synced GitHub repository
  profileId?: URN; // Optional: The URN of the filter profile (if undefined, include all files)
  target: ContextInjectionTarget;
}

export interface LlmSession {
  id: URN;
  title: string;
  lastModified: ISODateTimeString;

  //explicit reference to an optional Gemini cache for sessions that are tied to a specific codebase snapshot. This allows the UI to display relevant info and also enables future features like automatic cache refreshing or invalidation when the underlying code changes.
  geminiCache?: string;
  llmModel?: string;

  // --- NEW ---
  attachments: SessionAttachment[];

  // --- EXISTING ---
  contextGroups?: Record<string, string>;
}
