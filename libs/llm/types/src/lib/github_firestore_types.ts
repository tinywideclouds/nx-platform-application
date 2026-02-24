// libs/llm/features/data-sources/src/lib/data-sources.types.ts

export interface FileMetadata {
  path: string;
  sizeBytes: number;
  extension: string;
}

export interface FilterProfile {
  id: string;
  name: string;
  rulesYaml: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncRequest {
  repo: string;
  branch: string;
  cacheId?: string;
}

export interface SyncStreamEvent {
  stage: string;
  details: Record<string, any>;
}

export interface SyncResponse {
  cacheId: string;
  status: string;
  filesProcessed: number;
}

export interface ProfileRequest {
  name: string;
  rulesYaml: string;
}

export interface FilterRules {
  include: string[];
  exclude: string[];
}

export interface CacheAnalysis {
  totalFiles: number;
  totalSizeBytes: number;
  extensions: Record<string, number>;
}

export interface CacheBundle {
  id: string;
  repo: string;
  branch: string;
  commitSha?: string;
  syncedCommitSha?: string;
  lastSyncedAt: number;
  fileCount: number;
  status: 'unsynced' | 'syncing' | 'ready' | 'failed';
  analysis?: CacheAnalysis;
  ingestionRules?: FilterRules;
}

export interface SyncResponse {
  cacheId: string;
  status: string;
  filesProcessed: number;
}
