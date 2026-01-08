import { UrnPb } from '@nx-platform-application/platform-protos/net/v1/urn_pb.js';
/**
 * Represents a parsed, validated Uniform Resource Name (URN).
 * Instances should always be created via the static `create` or `parse` methods.
 */
export declare class URN {
    private static readonly SCHEME;
    private static readonly DEFAULT_NAMESPACE;
    private static readonly DELIMITER;
    readonly namespace: string;
    readonly entityType: string;
    readonly entityId: string;
    /**
     * Creates a new URN
     * @param entityType The type of the entity (e.g., "user").
     * @param entityId The unique identifier for the entity.
     * @param namespace The namespace for the entity.
     * @throws {Error} if entityType or entityId are empty.
     */
    static create(entityType: string, entityId: string, namespace?: string): URN;
    /**
     * Parses a canonical string representation into a URN object.
     * @param s The string to parse (e.g., "urn:contacts:user:12345").
     * @throws {Error} if the string format is invalid.
     */
    static parse(s: string): URN;
    private constructor();
    /**
     * Reassembles the URN into its canonical string representation.
     */
    toString(): string;
    /**
     * Provides the value to be used by JSON.stringify.
     */
    toJSON(): string;
    equals(c: URN): boolean;
}
/**
 * Maps an idiomatic URN (TS class) to a UrnPb (Proto object).
 * @param urn The URN class instance.
 * @returns A UrnPb protobuf message.
 */
export declare function urnToPb(urn: URN): UrnPb;
/**
 * Maps a UrnPb (Proto object) back to an idiomatic URN (TS class).
 * @param pb The UrnPb protobuf message.
 * @returns A URN class instance.
 */
export declare function urnFromPb(pb: UrnPb): URN;
