import { URN } from '@nx-platform-application/platform-types';

export interface FileMetadata {
  path: string;
  sizeBytes: number;
  extension: string;
}

export interface FilterProfile {
  id: URN;
  name: string;
  rulesYaml: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilteredDataSource {
  dataSourceId: URN;
  profileId?: URN;
}

export interface SyncRequest {
  repo: string;
  branch: string;
  dataSourceId?: string;
}

export interface SyncResponse {
  dataSourceId: string;
  status: string;
  filesProcessed: number;
}

export interface SyncStreamEvent {
  stage: string;
  details: Record<string, any>;
}

export interface ProfileRequest {
  name: string;
  rulesYaml: string;
}

export interface FilterRules {
  include: string[];
  exclude: string[];
}

export interface DataSourceAnalysis {
  totalFiles: number;
  totalSizeBytes: number;
  extensions: Record<string, number>;
}

export interface DataSourceBundle {
  id: URN;
  repo: string;
  branch: string;
  commitSha?: string;
  syncedCommitSha?: string;
  lastSyncedAt: number;
  fileCount: number;
  status: 'unsynced' | 'syncing' | 'ready' | 'failed';
  analysis?: DataSourceAnalysis;
  ingestionRules?: FilterRules;
}
