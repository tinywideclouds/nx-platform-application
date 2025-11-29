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
  private static readonly DEFAULT_NAMESPACE = 'app';
  private static readonly DELIMITER = ':';

  // --- Public, readonly properties ---
  public readonly namespace: string;
  public readonly entityType: string;
  public readonly entityId: string;
  /**
   * Creates a new URN
   * @param entityType The type of the entity (e.g., "user").
   * @param entityId The unique identifier for the entity.
   * @param namespace The namespace for the entity.
   * @throws {Error} if entityType or entityId are empty.
   */
  public static create(
    entityType: string,
    entityId: string,
    namespace?: string
  ): URN {
    if (!entityType) {
      throw new Error('Invalid URN format: entityType cannot be empty');
    }
    if (!entityId) {
      throw new Error('Invalid URN format: entityId cannot be empty');
    }
    const ns = namespace || URN.DEFAULT_NAMESPACE;

    return new URN(ns, entityType, entityId);
  }

  /**
   * Parses a canonical string representation into a URN object.
   * @param s The string to parse (e.g., "urn:contacts:user:12345").
   * @throws {Error} if the string format is invalid.
   */
  public static parse(s: string): URN {
    const parts = s.split(URN.DELIMITER);

    if (parts.length !== 4) {
      throw new Error(
        `Invalid URN format: expected 4 parts, but got ${parts.length}`
      );
    }
    if (parts[0] !== URN.SCHEME) {
      throw new Error(
        `Invalid URN format: invalid scheme '${parts[0]}', expected '${URN.SCHEME}'`
      );
    }

    const namespace = parts[1];
    const entityType = parts[2];
    const entityId = parts[3];

    if (!namespace) {
      throw new Error('Invalid URN format: namespace (part 2) cannot be empty');
    }
    if (!entityType) {
      throw new Error(
        'Invalid URN format: entityType (part 3) cannot be empty'
      );
    }
    if (!entityId) {
      throw new Error('Invalid URN format: entityId (part 4) cannot be empty');
    }

    // Use the constructor directly
    return new URN(namespace, entityType, entityId);
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
    return [URN.SCHEME, this.namespace, this.entityType, this.entityId].join(
      URN.DELIMITER
    );
  }

  /**
   * Provides the value to be used by JSON.stringify.
   */
  public toJSON(): string {
    return this.toString();
  }

  public equals(c: URN): boolean {
    return c.toString() === this.toString();
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
 * @param pb The UrnPb protobuf message.
 * @returns A URN class instance.
 */
export function urnFromPb(pb: UrnPb): URN {
  // Use 'create' to ensure validation logic is applied
  return URN.create(pb.entityType, pb.entityId);
}
