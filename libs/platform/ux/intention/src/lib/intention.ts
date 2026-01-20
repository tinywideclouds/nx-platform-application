/**
 * THE INTENTION SYSTEM
 * "Intention over Implementation"
 * * This library defines the cognitive timing for the application.
 * It is consumed by both CSS (via generated vars) and Angular Animations.
 */

export const UX_TIMING = {
  /**
   * DURATION (ms)
   * The "Heartbeat" of the UI.
   */
  DURATION: {
    INSTANT: 0,
    /** 200ms: Used for high-confidence, direct interactions (e.g. User clicks Delete) */
    CONFIDENT: 200,
    /** 300ms: Used for peripheral or complex changes (e.g. List reordering, Filtering) */
    DELIBERATE: 300,
    /** 500ms: Used for major context shifts (e.g. Page navigation) */
    SUSTAINED: 500,
  },
  /**
   * EASING CURVES
   * The "Personality" of the movement.
   */
  EASE: {
    /** Standard Ease: Natural, predictable. */
    DEFAULT: 'cubic-bezier(0, 0, 0.2, 1)',
    /** Expressive Ease: Starts fast, slows gently. Good for attention. */
    EXPRESSIVE: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

/**
 * INTENT REGISTRY
 * Maps human intent to physics constants.
 */
export const UX_INTENT = {
  DISCARD: {
    /** * Direct action by the user (Click 'X').
     * Needs to feel responsive but respectful.
     */
    CONFIDENT: {
      duration: UX_TIMING.DURATION.CONFIDENT,
      easing: UX_TIMING.EASE.DEFAULT,
    },
    /** * Indirect action (e.g. Filter applied).
     * Needs to draw the eye to the change.
     */
    PERIPHERAL: {
      duration: UX_TIMING.DURATION.DELIBERATE,
      easing: UX_TIMING.EASE.EXPRESSIVE,
    },
  },
} as const;
