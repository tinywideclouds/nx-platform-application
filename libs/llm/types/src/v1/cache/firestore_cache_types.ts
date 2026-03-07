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
  CreateCacheRequestPbSchema,
  SyncRequestPbSchema,
  ProfileRequestPbSchema,
  CacheMetadataPbSchema,
  CacheMetadataPb,
  SyncResponsePbSchema,
  FileMetadataPbSchema,
  FileMetadataPb,
  ProfilePbSchema,
  ProfilePb,
} from '@nx-platform-application/llm-protos/cache/v1/cache_pb';
import {
  CacheBundle,
  SyncResponse,
  FileMetadata,
  FilterProfile,
  ProfileRequest,
  FilterRules,
} from '../../lib/data_source_types';

// --- SERIALIZERS ---

export function serializeCreateCacheRequest(
  repo: string,
  branch: string,
): string {
  const proto = create(CreateCacheRequestPbSchema, { repo, branch });
  return toJsonString(CreateCacheRequestPbSchema, proto);
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

function mapCacheBundleFromProto(pb: CacheMetadataPb): CacheBundle {
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

export function deserializeCacheBundle(jsonString: string): CacheBundle {
  const pb = fromJsonString(CacheMetadataPbSchema, jsonString);
  return mapCacheBundleFromProto(pb);
}

export function deserializeCacheBundleList(jsonString: string): CacheBundle[] {
  const raw = JSON.parse(jsonString);
  if (!raw.caches) return [];
  return raw.caches.map((c: any) =>
    mapCacheBundleFromProto(fromJson(CacheMetadataPbSchema, c)),
  );
}

export function deserializeSyncResponse(jsonString: string): SyncResponse {
  const pb = fromJsonString(SyncResponsePbSchema, jsonString);
  return {
    cacheId: URN.parse(pb.cacheId) as any, // Cast assuming types were updated to URN
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
