// libs/llm/types/src/v1/cache/cache.ts
import {
  create,
  fromJson,
  toJsonString,
  fromJsonString,
} from '@bufbuild/protobuf';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import {
  CreateDataSourceRequestPbSchema,
  DataSourceMetadataPbSchema,
  DataSourceMetadataPb,
  SyncRequestPbSchema,
  ProfileRequestPbSchema,
  SyncResponsePbSchema,
  FileMetadataPbSchema,
  FileMetadataPb,
  ProfilePbSchema,
  ProfilePb,
} from '@nx-platform-application/data-sources-protos/types/v1/data-source_pb';
import {
  DataSourceBundle,
  SyncResponse,
  FileMetadata,
  FilterProfile,
  ProfileRequest,
  FilterRules,
} from '../lib/data-sources';

// --- SERIALIZERS ---

export function serializeCreateDataSourceRequest(
  repo: string,
  branch: string,
): string {
  const proto = create(CreateDataSourceRequestPbSchema, { repo, branch });
  return toJsonString(CreateDataSourceRequestPbSchema, proto);
}

export function serializeSyncRequest(rules: FilterRules): string {
  const proto = create(SyncRequestPbSchema, {
    ingestionRules: { include: rules.include, exclude: rules.exclude },
  });
  return toJsonString(SyncRequestPbSchema, proto);
}

export function serializeProfileRequest(req: ProfileRequest): string {
  const proto = create(ProfileRequestPbSchema, {
    name: req.name,
    rulesYaml: req.rulesYaml,
  });
  return toJsonString(ProfileRequestPbSchema, proto);
}

// --- INTERNAL PROTO MAPPERS ---

function mapDataSourceBundleFromProto(
  pb: DataSourceMetadataPb,
): DataSourceBundle {
  return {
    id: URN.parse(pb.id),
    repo: pb.repo,
    branch: pb.branch,
    syncedCommitSha: pb.syncedCommitSha,
    lastSyncedAt: Number(pb.lastSyncedAt),
    fileCount: pb.fileCount,
    status: pb.status as any,
    analysis: pb.analysis
      ? {
          totalFiles: pb.analysis.totalFiles,
          totalSizeBytes: pb.analysis.totalSizeBytes,
          extensions: pb.analysis.extensions as Record<string, number>,
        }
      : undefined,
  };
}

function mapFileMetadataFromProto(pb: FileMetadataPb): FileMetadata {
  return {
    path: pb.path,
    sizeBytes: pb.sizeBytes,
    extension: pb.extension,
  };
}

function mapFilterProfileFromProto(pb: ProfilePb): FilterProfile {
  return {
    id: URN.parse(pb.id), // Strictly mapped to URN
    name: pb.name,
    rulesYaml: pb.rulesYaml,
    createdAt: pb.createdAt as ISODateTimeString,
    updatedAt: pb.updatedAt as ISODateTimeString,
  };
}

// --- DESERIALIZERS ---

export function deserializeDataSourceBundle(
  jsonString: string,
): DataSourceBundle {
  const pb = fromJsonString(DataSourceMetadataPbSchema, jsonString);
  return mapDataSourceBundleFromProto(pb);
}

export function deserializeDataSourceBundleList(
  jsonString: string,
): DataSourceBundle[] {
  const raw = JSON.parse(jsonString);
  if (!raw.caches) return [];
  return raw.caches.map((c: any) =>
    mapDataSourceBundleFromProto(fromJson(DataSourceMetadataPbSchema, c)),
  );
}

export function deserializeSyncResponse(jsonString: string): SyncResponse {
  const pb = fromJsonString(SyncResponsePbSchema, jsonString);
  return {
    dataSourceId: URN.parse(pb.cacheId) as any, // Cast assuming types were updated to URN
    status: pb.status,
    filesProcessed: pb.filesProcessed,
  };
}

export function deserializeFileMetadataList(
  jsonString: string,
): FileMetadata[] {
  const raw = JSON.parse(jsonString);
  if (!raw.files) return [];
  return raw.files.map((f: any) =>
    mapFileMetadataFromProto(fromJson(FileMetadataPbSchema, f)),
  );
}

export function deserializeFilterProfile(jsonString: string): FilterProfile {
  const pb = fromJsonString(ProfilePbSchema, jsonString);
  return mapFilterProfileFromProto(pb);
}

export function deserializeFilterProfileList(
  jsonString: string,
): FilterProfile[] {
  const raw = JSON.parse(jsonString);
  if (!raw.profiles) return [];
  return raw.profiles.map((p: any) =>
    mapFilterProfileFromProto(fromJson(ProfilePbSchema, p)),
  );
}
