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
import { CompiledCache } from '../../lib/types';
import { FilteredDataSource } from '@nx-platform-application/data-sources-types';

/**
 * Maps a Domain CompiledCache to its Protobuf wire representation.
 * Explicitly types the mapping parameter 's' to resolve TS7006.
 */
export function compiledCacheToProto(k: CompiledCache): CompiledCachePb {
  return create(CompiledCachePbSchema, {
    id: k.id.toString(),
    // Ensures provider is a valid URN string for the wire; defaults to gemini
    provider: k.provider ? k.provider.toString() : 'urn:llm:provider:gemini',
    // Maps the physical sources array required for cache matching
    sources: k.sources.map((s: FilteredDataSource) => ({
      dataSourceId: s.dataSourceId.toString(),
      profileId: s.profileId ? s.profileId.toString() : undefined,
    })),
    createdAt: k.createdAt,
    expiresAt: k.expiresAt,
  });
}

/**
 * Hydrates a Domain CompiledCache from a Protobuf object.
 */
export function compiledCacheFromProto(pk: CompiledCachePb): CompiledCache {
  return {
    id: URN.parse(pk.id),
    // Re-calculates the model based on the record context (or default if missing in proto)
    model: (pk as any).model || 'gemini-1.5-pro',
    provider: pk.provider as any,
    expiresAt: pk.expiresAt as ISODateTimeString,
    createdAt: pk.createdAt as ISODateTimeString,
    sources: pk.sources.map((s) => ({
      dataSourceId: URN.parse(s.dataSourceId),
      profileId: s.profileId ? URN.parse(s.profileId) : undefined,
    })),
  };
}

/**
 * Serializes a CompiledCache to a proto3-compliant JSON string.
 */
export function serializeCompiledCache(cache: CompiledCache): string {
  return toJsonString(CompiledCachePbSchema, compiledCacheToProto(cache));
}

/**
 * Deserializes a proto3 JSON string into a Domain CompiledCache object.
 */
export function deserializeCompiledCache(jsonString: string): CompiledCache {
  const proto = fromJsonString(CompiledCachePbSchema, jsonString);
  return compiledCacheFromProto(proto);
}
