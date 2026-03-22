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

export function compiledCacheToProto(k: CompiledCache): CompiledCachePb {
  return create(CompiledCachePbSchema, {
    id: k.id.toString(),
    provider: k.provider ? k.provider.toString() : 'urn:llm:provider:gemini',
    sources: k.sources.map((s) => ({
      dataSourceId: s.toString(),
    })),
    createdAt: k.createdAt,
    expiresAt: k.expiresAt,
  });
}

export function compiledCacheFromProto(pk: CompiledCachePb): CompiledCache {
  return {
    id: URN.parse(pk.id),
    model: (pk as any).model,
    provider: pk.provider as any,
    expiresAt: pk.expiresAt as ISODateTimeString,
    createdAt: pk.createdAt as ISODateTimeString,
    sources: pk.sources.map((s) => URN.parse(s.dataSourceId)),
  };
}

export function serializeCompiledCache(cache: CompiledCache): string {
  return toJsonString(CompiledCachePbSchema, compiledCacheToProto(cache));
}

export function deserializeCompiledCache(jsonString: string): CompiledCache {
  const proto = fromJsonString(CompiledCachePbSchema, jsonString);
  return compiledCacheFromProto(proto);
}
