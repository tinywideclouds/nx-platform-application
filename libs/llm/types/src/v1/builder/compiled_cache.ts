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
import { sessionAttachmentToProto } from './builder';

export function compiledCacheToProto(k: CompiledCache): CompiledCachePb {
  return create(CompiledCachePbSchema, {
    id: k.id.toString(),
    provider: k.provider ? k.provider.toString() : 'urn:llm:provider:gemini',
    attachmentsUsed: k.attachmentsUsed.map(sessionAttachmentToProto),
    createdAt: k.expiresAt, // Mocked for proto
    expiresAt: k.expiresAt,
  });
}

export function compiledCacheFromProto(pk: CompiledCachePb): CompiledCache {
  return {
    id: URN.parse(pk.id),
    expiresAt: pk.expiresAt as ISODateTimeString,
    attachmentsUsed: pk.attachmentsUsed.map((a) => ({
      id: URN.parse(a.id),
      cacheId: URN.parse(a.cacheId),
      profileId: a.profileId ? URN.parse(a.profileId) : undefined,
      target: 'compiled-cache',
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
