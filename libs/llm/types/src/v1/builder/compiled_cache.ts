// libs/llm/types/src/v1/builder/compiled_cache.ts
import {
  CompiledCachePbSchema,
  CompiledCachePb,
} from '@nx-platform-application/llm-protos/builder/v1/builder_pb';
import { create, fromJsonString, toJsonString } from '@bufbuild/protobuf';
import {
  URN,
  ISODateTimeString,
} from '@nx-platform-application/platform-types';
import { CompiledCache } from '../../lib/session_types';

export function compiledCacheToProto(k: CompiledCache): CompiledCachePb {
  return create(CompiledCachePbSchema, {
    id: k.id.toString(),
    provider: k.provider ? k.provider.toString() : 'urn:llm:provider:gemini',
    // NEW: Map the pure sources array
    sources: k.sources.map((s) => ({
      dataSourceId: s.dataSourceId.toString(),
      profileId: s.profileId ? s.profileId.toString() : undefined,
    })),
    createdAt: k.createdAt,
    expiresAt: k.expiresAt,
  });
}

export function compiledCacheFromProto(pk: CompiledCachePb): CompiledCache {
  return {
    id: URN.parse(pk.id),
    provider: pk.provider as any,
    expiresAt: pk.expiresAt as ISODateTimeString,
    createdAt: pk.createdAt as ISODateTimeString,
    // NEW: Map back to FilteredDataSource
    sources: pk.sources.map((s) => ({
      dataSourceId: URN.parse(s.dataSourceId),
      profileId: s.profileId ? URN.parse(s.profileId) : undefined,
    })),
  };
}

export function serializeCompiledCache(cache: CompiledCache): string {
  return toJsonString(CompiledCachePbSchema, compiledCacheToProto(cache));
}

export function deserializeCompiledCache(jsonString: string): CompiledCache {
  const proto = fromJsonString(CompiledCachePbSchema, jsonString);
  return compiledCacheFromProto(proto);
}
