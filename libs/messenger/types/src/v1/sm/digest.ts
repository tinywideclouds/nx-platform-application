import { create, fromJson } from "@bufbuild/protobuf";
import { URN } from '@nx-platform-application/platform-types';

// --- Protobuf Imports (Only allowed in this library) ---
import {
  EncryptedDigestItemPb,
  EncryptedDigestItemPbSchema,
  EncryptedDigestPbSchema,
} from '@nx-platform-application/messenger-protos/envelope/v1/digest_pb.js'; // Assumed path

// --- Smart Interfaces ---

export interface EncryptedDigestItem {
  conversationUrn: URN;
  encryptedSnippet: Uint8Array;
}

export interface EncryptedDigest {
  items: EncryptedDigestItem[];
}

// --- Internal Mappers (Smart <-> Proto) ---

/**
 * Maps a smart EncryptedDigestItem to its Protobuf representation.
 * (Internal helper)
 */
function digestItemToProto(item: EncryptedDigestItem): EncryptedDigestItemPb {
  return create(EncryptedDigestItemPbSchema, {
    conversationUrn: item.conversationUrn.toString(),
    encryptedSnippet: item.encryptedSnippet,
  });
}

/**
 * Maps a Protobuf EncryptedDigestItemPb to the smart interface.
 * (Internal helper)
 */
function digestItemFromProto(itemPb: EncryptedDigestItemPb): EncryptedDigestItem {
  return {
    conversationUrn: URN.parse(itemPb.conversationUrn),
    encryptedSnippet: itemPb.encryptedSnippet,
  };
}

// --- Public Deserializer (JSON -> Smart) ---

/**
 * PUBLIC API:
 * Deserializes a JSON response object (matching EncryptedDigestPb schema)
 * into a "smart" EncryptedDigest object.
 */
export function deserializeJsonToDigest(json: any): EncryptedDigest {
  // 1. Parse raw JSON object into Proto List object
  const protoDigest = fromJson(EncryptedDigestPbSchema, json);

  // 2. Map Proto items to Smart items
  return {
    items: protoDigest.items.map(digestItemFromProto),
  };
}

// NOTE: We don't need a public *serializer* for the Digest,
// as the client only *fetches* digests, it never *sends* them.
