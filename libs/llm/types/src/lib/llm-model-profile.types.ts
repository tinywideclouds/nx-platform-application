export interface LlmModelFeatures {
  supportsSystemInstructions: boolean;
  supportsTools: boolean; // Can it use the file-patching tools?
  supportsThinking: boolean; // Does it stream thought blocks?
  supportsSystemContext: boolean; // Can it handle massive background context?
}

export interface ModelVersion {
  provider: 'gemini' | 'openai' | 'anthropic' | 'local';
  major: number;
  minor: number;
  tier: 'lite' | 'flash' | 'pro' | 'ultra';
  apiName: string;
}

export interface LlmModelProfile {
  id: string; // e.g., 'gemini-3.1-pro-preview'
  displayName: string;
  description?: string;
  version: ModelVersion;
  // Context Limits
  maxInputTokens: number;
  maxOutputTokens: number;

  features: LlmModelFeatures;
}
