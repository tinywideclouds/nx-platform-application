import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';

export interface FileMetadata {
  path: string;
  sizeBytes: number;
  extension: string;
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

// --- THE LAKE ---

export interface GithubIngestionTarget {
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

// --- THE STREAM ---

export interface DataSource {
  id: URN;
  name: string;
  rulesYaml: string;
  createdAt: string;
  updatedAt: string;
}

// --- THE BLUEPRINT ---

export interface DataGroup {
  id: URN;
  name: string;
  description?: string;
  dataSourceIds: URN[]; // Simplified! No more tuples.
  metadata?: Record<string, string>;
  createdAt?: ISODateTimeString;
  updatedAt?: ISODateTimeString;
}

// --- API Requests & Responses ---

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

export interface DataSourceRequest {
  name: string;
  rulesYaml: string;
}

export interface DataGroupRequest {
  name: string;
  description?: string;
  dataSourceIds: URN[];
  metadata?: Record<string, string>;
}
