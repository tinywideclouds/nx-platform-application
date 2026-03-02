import { URN } from '@nx-platform-application/platform-types';
import { Temporal } from '@js-temporal/polyfill';

export type ScrollAlignment = 'start' | 'end' | 'center' | 'stretch';

/**
 * The core identity contract for any entity in the scrollspace.
 * Shared by Actors (Senders) and Cursors (Readers).
 */
export interface ScrollIdentity {
  id: URN;
  displayName: string;
  avatarUrl?: string;
}

/**
 * Represents the entity responsible for the content row.
 */
export interface ScrollActor extends ScrollIdentity {
  isSelf?: boolean; // Drives palette defaults (e.g. Gray vs Color)
}

/**
 * Represents ephemeral presence indicators (Read receipts, typing ghosts).
 */
export interface ScrollCursor extends ScrollIdentity {
  color?: string; // Visual override for the cursor ring/bg
}

/**
 * Defines the structural flow of the item.
 */
export interface ScrollLayout {
  alignment: ScrollAlignment;
  /**
   * True if this item is part of a temporal cluster (e.g., < 5s).
   * UI should suppress the header and collapse margins.
   */
  isContinuous: boolean;
  fullWidth?: boolean;

  selectable?: boolean;

  // Tells the row how to stitch its border-radius for grouped messages
  positionInGroup?: 'first' | 'middle' | 'last';
}

/**
 * Container for UI metadata managed by the Core Lib.
 */
export interface ScrollAdornments {
  cursors?: ScrollCursor[];
  statusBadge?: string; // e.g. 'HD', 'Sending...', 'Read'
}

/**
 * The primary unit of the ScrollSpace.
 * @template T The domain-specific payload (e.g., ChatMessage | TokenGroup)
 */
export interface ScrollItem<T> {
  // Viewport tracking ID (Keep as string for high-perf trackBy)
  id: string;
  type: 'content' | 'date-header' | 'new-items-marker' | 'system';
  timestamp: Temporal.Instant;

  // ✅ Infrastructure Data (Hoisted for Type Safety)
  actor?: ScrollActor;
  layout: ScrollLayout;
  adornments?: ScrollAdornments;

  /**
   * Self-calculated weight for pruning logic.
   * Default: 1. Updated by content renderers via the Weight Protocol.
   */
  renderingWeight: number;

  // ✅ Domain Data (Opaque to the Row)
  data: T;
}

export interface WeightUpdate {
  itemId: string;
  newWeight: number;
}

export interface ScrollBubbleStyle {
  backgroundColor: string;
  color: string;
  borderColor?: string;
}
/**
 * A generic payload emitted by the generic Input component.
 * The consumer (Messenger) is responsible for uploading files and formatting the final message.
 */
export interface ScrollspaceInputDraft {
  text: string;
  files: File[];
}

export interface ScrollspaceInputConfig {
  placeholder?: string;
  maxFiles?: number;
  accept?: string; // e.g. "image/*, .pdf"
}
