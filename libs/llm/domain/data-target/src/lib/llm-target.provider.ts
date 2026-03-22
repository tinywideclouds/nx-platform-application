import { URN } from '@nx-platform-application/platform-types';

/**
 * An abstract provider representing the LLM's Write Destination (Sandbox).
 * The Workspace uses this to JIT-load base files for diffing without
 * knowing where the files actually come from.
 */
export abstract class LlmTargetProvider {
  /**
   * Fetches the base content of a file from the target destination.
   * @param targetUrn The URN representing the destination sandbox.
   * @param filePath The relative path of the file.
   * @returns The raw text content, or null if the file does not exist (e.g. a proposed new file).
   */
  abstract getBaseFileContent(
    targetUrn: URN,
    filePath: string,
  ): Promise<string | null>;
}
