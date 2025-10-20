import { create } from '@bufbuild/protobuf';
// Import the generated proto types from the "buddy" library
import {
  UrnPb,
  UrnPbSchema,
} from '@nx-platform-application/platform-protos/net/v1/urn_pb.js';

/**
 * Represents a parsed, validated Uniform Resource Name (URN).
 * Instances should always be created via the static `create` or `parse` methods.
 */
export class URN {
  private static readonly SCHEME = 'urn';
  private static readonly NAMESPACE = 'sm'; // Secure Messaging
  private static readonly DELIMITER = ':';

  // --- Public, readonly properties ---
  public readonly namespace: string;
  public readonly entityType: string;
  public readonly entityId: string;
  /**
   * Creates a new URN with the 'sm' namespace.
   * @param entityType The type of the entity (e.g., "user").
   * @param entityId The unique identifier for the entity.
   * @throws {Error} if entityType or entityId are empty.
   */
  public static create(entityType: string, entityId: string): URN {
    if (!entityType) {
      throw new Error('Invalid URN format: entityType cannot be empty');
    }
    if (!entityId) {
      throw new Error('Invalid URN format: entityId cannot be empty');
    }
    return new URN(URN.NAMESPACE, entityType, entityId);
  }

  /**
   * Parses a raw string into a structured URN, validating its format.
   * @param s The URN string to parse (e.g., "urn:sm:user:alice").
   * @throws {Error} if the string format is invalid.
   */
  public static parse(s: string): URN {
    const parts = s.split(URN.DELIMITER);
    if (parts.length !== 4) {
      throw new Error(`Invalid URN format: expected 4 parts, but got ${parts.length}`);
    }
    if (parts[0] !== URN.SCHEME) {
      throw new Error(`Invalid URN format: invalid scheme '${parts[0]}', expected '${URN.SCHEME}'`);
    }
    // Delegate final validation to the constructor via create()
    return URN.create(parts[2], parts[3]);
  }

  private constructor(namespace: string, entityType: string, entityId: string) {
    this.namespace = namespace;
    this.entityType = entityType;
    this.entityId = entityId;
  }

  /**
   * Reassembles the URN into its canonical string representation.
   */
  public toString(): string {
    return [URN.SCHEME, this.namespace, this.entityType, this.entityId].join(URN.DELIMITER);
  }

  /**
   * Provides the value to be used by JSON.stringify.
   */
  public toJSON(): string {
    return this.toString();
  }
}

// --- NEW HELPER FUNCTIONS ---

/**
 * Maps an idiomatic URN (TS class) to a UrnPb (Proto object).
 * @param urn The URN class instance.
 * @returns A UrnPb protobuf message.
 */
export function urnToPb(urn: URN): UrnPb {
  return create(UrnPbSchema, {
    namespace: urn.namespace,
    entityType: urn.entityType,
    entityId: urn.entityId,
  });
}

/**
 * Maps a UrnPb (Proto object) back to an idiomatic URN (TS class).
 * Uses the URN.create factory to ensure class invariants.
 * @param urnPb The UrnPb protobuf message.
 * @returns A URN class instance.
 */
export function urnFromPb(urnPb: UrnPb): URN {
  // Uses the static factory, which ensures the namespace is 'sm'
  // just like the URN.parse() and URN.create() methods.
  return URN.create(urnPb.entityType, urnPb.entityId);
}
